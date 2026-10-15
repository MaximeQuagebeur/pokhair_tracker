import Dexie, { type Table } from 'dexie';
import { parseWinamaxFile } from './poker/winamax-parser';
import type { HandRecord, HandText, TournamentRecord } from './poker/types';

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
  handTexts!: Table<HandText, string>;
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
    // v6 adds positions / replayer fields and stores the raw text of each hand: rebuild everything.
    this.version(6)
      .stores({ handTexts: 'id' })
      .upgrade(async (tx) => {
        await tx.table('hands').clear();
        await tx.table('tournaments').clear();
        await tx.table('files').clear();
      });
    // v7 labels positions from the button backwards (HJ added): re-parse every file.
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('files').clear();
      });
    // v8 adds `heroAllIn`: re-parse every file.
    this.version(8)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('files').clear();
      });
  }
}

export const db = new PokhairDB();

const sameRecord = (a: unknown, b: unknown) => a !== undefined && JSON.stringify(a) === JSON.stringify(b);

/**
 * Parses a history file and upserts its hands / tournament results (idempotent by id).
 * Returns only the records that are new or changed, to be pushed to the cloud.
 */
export async function ingestFile(file: { path: string; size: number; mtimeMs: number }, text: string) {
  const { hands, texts, tournaments, errors } = parseWinamaxFile(text, file.path);
  if (errors.length) console.warn(`[parser] ${file.path}`, errors);
  return db.transaction('rw', [db.hands, db.handTexts, db.tournaments, db.files], async () => {
    const [oldHands, oldTexts, oldTournaments] = await Promise.all([
      db.hands.bulkGet(hands.map((h) => h.id)),
      db.handTexts.bulkGet(texts.map((t) => t.id)),
      db.tournaments.bulkGet(tournaments.map((t) => t.id)),
    ]);
    await db.hands.bulkPut(hands);
    await db.handTexts.bulkPut(texts);
    await db.tournaments.bulkPut(tournaments);
    await db.files.put({ ...file, hands: hands.length, tournaments: tournaments.length, parsedAt: Date.now() });
    return {
      hands: hands.filter((h, i) => !sameRecord(oldHands[i], h)),
      texts: texts.filter((t, i) => oldTexts[i]?.text !== t.text),
      tournaments: tournaments.filter((t, i) => !sameRecord(oldTournaments[i], t)),
    };
  });
}

export async function clearDatabase() {
  await db.transaction('rw', [db.hands, db.handTexts, db.tournaments, db.files], async () => {
    await db.hands.clear();
    await db.handTexts.clear();
    await db.tournaments.clear();
    await db.files.clear();
  });
}
