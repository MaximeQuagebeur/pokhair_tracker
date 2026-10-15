import { createClient, type Client } from '@libsql/client/web';
import type { HandRecord, TournamentRecord } from '@/lib/poker/types';

/**
 * Turso (libSQL) access over HTTP: `@libsql/client/web` only relies on `fetch`,
 * so it runs in Node (Electron main, Vercel functions) and on the Edge runtime.
 * Server-only: never import it from a client component (the auth token would be required in the bundle).
 */

/** Keep in sync with electron/cloud.ts (writer side). */
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS hands (id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL, updated_at INTEGER NOT NULL, data TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS hands_updated_at ON hands (updated_at)',
  'CREATE TABLE IF NOT EXISTS hand_texts (id TEXT PRIMARY KEY, text TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS tournaments (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, data TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS tournaments_updated_at ON tournaments (updated_at)',
];

let client: Client | null = null;
let schemaReady: Promise<unknown> | null = null;

export function getCloudDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error('TURSO_DATABASE_URL manquant');
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

async function ready(): Promise<Client> {
  const db = getCloudDb();
  schemaReady ??= db.batch(SCHEMA, 'write').catch((err) => {
    schemaReady = null;
    throw err;
  });
  await schemaReady;
  return db;
}

export type CloudKind = 'hands' | 'tournaments';
interface CloudRecords {
  hands: HandRecord;
  tournaments: TournamentRecord;
}

/** Position in the change feed: rows are ordered by (updated_at, id). */
export interface CloudCursor {
  stamp: number;
  id: string;
}

export interface CloudPage<T> {
  rows: T[];
  /** Resume point for the next call (unchanged when there were no new rows). */
  cursor: CloudCursor;
  done: boolean;
}

/** Records modified after `cursor`, oldest first. */
export async function readChanges<K extends CloudKind>(
  kind: K,
  cursor: CloudCursor,
  limit: number,
): Promise<CloudPage<CloudRecords[K]>> {
  const db = await ready();
  const table = kind === 'hands' ? 'hands' : 'tournaments';
  const { rows } = await db.execute({
    sql: `SELECT id, updated_at, data FROM ${table}
          WHERE updated_at > ? OR (updated_at = ? AND id > ?)
          ORDER BY updated_at, id LIMIT ?`,
    args: [cursor.stamp, cursor.stamp, cursor.id, limit],
  });
  const last = rows.at(-1);
  return {
    rows: rows.map((r) => JSON.parse(String(r.data))),
    cursor: last ? { stamp: Number(last.updated_at), id: String(last.id) } : cursor,
    done: rows.length < limit,
  };
}

export async function readHandText(id: string): Promise<string | null> {
  const db = await ready();
  const { rows } = await db.execute({ sql: 'SELECT text FROM hand_texts WHERE id = ?', args: [id] });
  return rows[0] ? String(rows[0].text) : null;
}
