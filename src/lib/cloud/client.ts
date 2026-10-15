import { db } from '@/lib/db';
import type { HandRecord, HandText, TournamentRecord } from '@/lib/poker/types';

/** Browser side of the cloud sync: the desktop pushes through Electron, the PWA pulls through /api/cloud. */

const ACCESS_KEY = 'pokhair.cloudKey';
const CURSOR_KEY = (kind: string) => `pokhair.cloudCursor.${kind}`;
const DIRTY_KEY = 'pokhair.cloudDirty';
const PUSH_CHUNK = 500;

export interface CloudPayload {
  hands: HandRecord[];
  texts: HandText[];
  tournaments: TournamentRecord[];
}

/** Web build deployed on Vercel (not the Electron app). */
export const isCloudWeb = () => process.env.NEXT_PUBLIC_CLOUD === '1' && typeof window !== 'undefined' && !window.pokhair;

export const getAccessKey = () => localStorage.getItem(ACCESS_KEY);
export const setAccessKey = (key: string) => localStorage.setItem(ACCESS_KEY, key.trim());

export function resetCloudCursors() {
  localStorage.removeItem(CURSOR_KEY('hands'));
  localStorage.removeItem(CURSOR_KEY('tournaments'));
}

async function api<T>(params: Record<string, string>): Promise<T> {
  const key = getAccessKey();
  if (!key) throw new Error('Clé d’accès manquante : renseignez-la dans les réglages.');
  const res = await fetch(`/api/cloud/?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
  return body as T;
}

interface Page<T> {
  rows: T[];
  cursor: { stamp: number; id: string };
  done: boolean;
}

/** Downloads every record changed since the last pull into IndexedDB. Returns the number of hands received. */
export async function pullFromCloud(onProgress?: (hands: number) => void): Promise<number> {
  let received = 0;
  for (const kind of ['tournaments', 'hands'] as const) {
    let cursor = JSON.parse(localStorage.getItem(CURSOR_KEY(kind)) ?? '{"stamp":0,"id":""}');
    for (;;) {
      const page = await api<Page<HandRecord | TournamentRecord>>({ kind, stamp: String(cursor.stamp), id: cursor.id });
      if (kind === 'hands') {
        await db.hands.bulkPut(page.rows as HandRecord[]);
        received += page.rows.length;
        onProgress?.(received);
      } else {
        await db.tournaments.bulkPut(page.rows as TournamentRecord[]);
      }
      cursor = page.cursor;
      localStorage.setItem(CURSOR_KEY(kind), JSON.stringify(cursor));
      if (page.done) break;
    }
  }
  return received;
}

/** Raw hand history for the replayer, fetched on demand to keep the phone storage small. */
export async function fetchHandText(id: string): Promise<HandText | null> {
  try {
    const text = await api<HandText>({ kind: 'text', id });
    await db.handTexts.put(text);
    return text;
  } catch {
    return null;
  }
}

/** Desktop: pushes changed records; on failure, flags a full re-upload for the next sync. */
export async function pushChanges(payload: CloudPayload) {
  const api = window.pokhair;
  if (!api || (!payload.hands.length && !payload.texts.length && !payload.tournaments.length)) return;
  try {
    await api.pushToCloud(payload);
  } catch (err) {
    localStorage.setItem(DIRTY_KEY, '1');
    throw err;
  }
}

export const cloudNeedsFullPush = () => localStorage.getItem(DIRTY_KEY) === '1';

/** Desktop: re-uploads the whole local database (first connection, or after a failed push). */
export async function pushAllToCloud(onProgress?: (done: number, total: number) => void) {
  const api = window.pokhair;
  if (!api) return;
  const total = await db.hands.count();
  await api.pushToCloud({ hands: [], texts: [], tournaments: await db.tournaments.toArray() });
  let lastId = '';
  let done = 0;
  for (;;) {
    const hands = await db.hands.where(':id').above(lastId).limit(PUSH_CHUNK).toArray();
    if (!hands.length) break;
    const texts = (await db.handTexts.bulkGet(hands.map((h) => h.id))).filter((t): t is HandText => !!t);
    await api.pushToCloud({ hands, texts, tournaments: [] });
    lastId = hands[hands.length - 1].id;
    done += hands.length;
    onProgress?.(done, total);
  }
  localStorage.removeItem(DIRTY_KEY);
}
