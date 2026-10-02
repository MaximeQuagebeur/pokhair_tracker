import Dexie, { type Table } from 'dexie';
import { parseWinamaxFile } from './poker/winamax-parser';
import type { HandRecord } from './poker/types';

export interface FileRecord {
  path: string;
  size: number;
  mtimeMs: number;
  hands: number;
}

class PokhairDB extends Dexie {
  hands!: Table<HandRecord, string>;
  files!: Table<FileRecord, string>;

  constructor() {
    super('pokhair');
    this.version(1).stores({
      hands: 'id, timestamp, hero, sourceFile',
      files: 'path',
    });
    // v2 parses every game type: force a full re-import.
    this.version(2)
      .stores({ hands: 'id, timestamp, hero, sourceFile, gameType, limit', files: 'path' })
      .upgrade(async (tx) => {
        await tx.table('hands').clear();
        await tx.table('files').clear();
      });
  }
}

export const db = new PokhairDB();

/** Parses a hand-history file and upserts its hands (idempotent by HandId). */
export async function ingestFile(file: { path: string; size: number; mtimeMs: number }, text: string) {
  const { hands, errors } = parseWinamaxFile(text, file.path);
  if (errors.length) console.warn(`[parser] ${file.path}`, errors);
  await db.transaction('rw', db.hands, db.files, async () => {
    await db.hands.bulkPut(hands);
    await db.files.put({ ...file, hands: hands.length });
  });
  return hands.length;
}

export async function clearDatabase() {
  await db.transaction('rw', db.hands, db.files, async () => {
    await db.hands.clear();
    await db.files.clear();
  });
}
