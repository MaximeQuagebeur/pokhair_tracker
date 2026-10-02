import Dexie, { type Table } from 'dexie';
import { parseWinamaxFile } from './poker/winamax-parser';
import type { HandRecord, TournamentRecord } from './poker/types';

export interface FileRecord {
  path: string;
  size: number;
  mtimeMs: number;
  hands: number;
  tournaments: number;
  parsedAt: number;
}

class PokhairDB extends Dexie {
  hands!: Table<HandRecord, string>;
  tournaments!: Table<TournamentRecord, string>;
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
    // v3 reads tournament summary files: re-scan every file.
    this.version(3)
      .stores({
        hands: 'id, timestamp, hero, sourceFile, gameType, limit',
        tournaments: 'id, startTime, gameType, limit',
        files: 'path',
      })
      .upgrade(async (tx) => {
        await tx.table('files').clear();
      });
    // v4: strict Net Won (collected - invested): recompute every hand.
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('files').clear();
      });
    // v5 stores invested / collected / net explicitly and drops play money: rebuild everything.
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('hands').clear();
        await tx.table('tournaments').clear();
        await tx.table('files').clear();
      });
  }
}

export const db = new PokhairDB();

/** Parses a history file and upserts its hands / tournament results (idempotent by id). */
export async function ingestFile(file: { path: string; size: number; mtimeMs: number }, text: string) {
  const { hands, tournaments, errors } = parseWinamaxFile(text, file.path);
  if (errors.length) console.warn(`[parser] ${file.path}`, errors);
  await db.transaction('rw', db.hands, db.tournaments, db.files, async () => {
    await db.hands.bulkPut(hands);
    await db.tournaments.bulkPut(tournaments);
    await db.files.put({ ...file, hands: hands.length, tournaments: tournaments.length, parsedAt: Date.now() });
  });
  return hands.length;
}

export async function clearDatabase() {
  await db.transaction('rw', db.hands, db.tournaments, db.files, async () => {
    await db.hands.clear();
    await db.tournaments.clear();
    await db.files.clear();
  });
}
