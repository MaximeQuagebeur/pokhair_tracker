import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client, type InStatement } from '@libsql/client/web';

/** Same schema as src/lib/cloud/db.ts: records are stored as JSON so parser changes need no migration. */
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS hands (id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL, updated_at INTEGER NOT NULL, data TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS hands_updated_at ON hands (updated_at)',
  'CREATE TABLE IF NOT EXISTS hand_texts (id TEXT PRIMARY KEY, text TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS tournaments (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, data TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS tournaments_updated_at ON tournaments (updated_at)',
];
const BATCH_SIZE = 200;

export interface CloudPayload {
  hands: { id: string; timestamp: number }[];
  texts: { id: string; text: string }[];
  tournaments: { id: string }[];
}

interface StoredConfig {
  url: string;
  /** Base64 of the safeStorage-encrypted token (plain text when encryption is unavailable). */
  token: string;
  encrypted: boolean;
}

const configPath = () => path.join(app.getPath('userData'), 'cloud.json');
let client: Client | null = null;
let schemaReady = false;

function readConfig(): { url: string; authToken: string } | null {
  // Dev override: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in the environment.
  if (process.env.TURSO_DATABASE_URL) {
    return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN ?? '' };
  }
  try {
    const stored = JSON.parse(fs.readFileSync(configPath(), 'utf-8')) as StoredConfig;
    const authToken = stored.encrypted
      ? safeStorage.decryptString(Buffer.from(stored.token, 'base64'))
      : stored.token;
    return { url: stored.url, authToken };
  } catch {
    return null;
  }
}

function getClient(): Client | null {
  if (client) return client;
  const config = readConfig();
  if (!config) return null;
  client = createClient(config);
  return client;
}

async function ensureSchema(db: Client) {
  if (schemaReady) return;
  await db.batch(SCHEMA, 'write');
  schemaReady = true;
}

export function cloudStatus() {
  const config = readConfig();
  return { configured: !!config, url: config?.url ?? null };
}

/** Validates the credentials against Turso before persisting them. */
export async function configureCloud(url: string, authToken: string) {
  if (!/^(libsql|https|wss):\/\//.test(url)) throw new Error('URL invalide : elle doit commencer par libsql://');
  const candidate = createClient({ url, authToken });
  await candidate.execute('SELECT 1');
  const encrypted = safeStorage.isEncryptionAvailable();
  const token = encrypted ? safeStorage.encryptString(authToken).toString('base64') : authToken;
  const stored: StoredConfig = { url, token, encrypted };
  await fs.promises.writeFile(configPath(), JSON.stringify(stored), { mode: 0o600 });
  client?.close();
  client = candidate;
  schemaReady = false;
  return cloudStatus();
}

export async function disconnectCloud() {
  client?.close();
  client = null;
  schemaReady = false;
  await fs.promises.rm(configPath(), { force: true });
}

/** Upserts parsed records into Turso. No-op when the cloud is not configured. */
export async function pushToCloud(payload: CloudPayload): Promise<number> {
  const db = getClient();
  if (!db) return 0;
  await ensureSchema(db);
  const statements: ((stamp: number) => InStatement)[] = [
    ...payload.hands.map((h) => (stamp: number) => ({
      sql: 'INSERT OR REPLACE INTO hands (id, timestamp, updated_at, data) VALUES (?, ?, ?, ?)',
      args: [h.id, h.timestamp, stamp, JSON.stringify(h)],
    })),
    ...payload.texts.map((t) => () => ({
      sql: 'INSERT OR REPLACE INTO hand_texts (id, text) VALUES (?, ?)',
      args: [t.id, t.text],
    })),
    ...payload.tournaments.map((t) => (stamp: number) => ({
      sql: 'INSERT OR REPLACE INTO tournaments (id, updated_at, data) VALUES (?, ?, ?)',
      args: [t.id, stamp, JSON.stringify(t)],
    })),
  ];
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    // Strictly increasing per batch so the mobile pull cursor never skips a transaction committed mid-pull.
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    const stamp = lastStamp;
    await db.batch(statements.slice(i, i + BATCH_SIZE).map((build) => build(stamp)), 'write');
  }
  return payload.hands.length;
}

let lastStamp = 0;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** IPC boundary: keeps only well-formed records. */
export function sanitizePayload(input: unknown): CloudPayload {
  const list = (key: string) => (isRecord(input) && Array.isArray(input[key]) ? (input[key] as unknown[]) : []);
  return {
    hands: list('hands').filter(
      (h): h is CloudPayload['hands'][number] => isRecord(h) && typeof h.id === 'string' && typeof h.timestamp === 'number',
    ),
    texts: list('texts').filter(
      (t): t is CloudPayload['texts'][number] => isRecord(t) && typeof t.id === 'string' && typeof t.text === 'string',
    ),
    tournaments: list('tournaments').filter(
      (t): t is CloudPayload['tournaments'][number] => isRecord(t) && typeof t.id === 'string',
    ),
  };
}
