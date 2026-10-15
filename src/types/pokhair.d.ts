import type { HandRecord, HandText, TournamentRecord } from '@/lib/poker/types';

export interface HandFileInfo {
  path: string;
  size: number;
  mtimeMs: number;
}

export interface CloudStatus {
  configured: boolean;
  url: string | null;
}

/** API exposed by electron/preload.ts. Undefined when running in a plain browser. */
export interface PokhairApi {
  selectFolder(): Promise<string | null>;
  openFolder(dir: string): Promise<HandFileInfo[]>;
  readFile(filePath: string): Promise<string>;
  cloudStatus(): Promise<CloudStatus>;
  /** Validates then stores the Turso credentials (token encrypted in the main process, never returned). */
  configureCloud(url: string, token: string): Promise<CloudStatus>;
  disconnectCloud(): Promise<void>;
  /** Upserts records into Turso; resolves with the number of hands sent (0 when not configured). */
  pushToCloud(payload: { hands: HandRecord[]; texts: HandText[]; tournaments: TournamentRecord[] }): Promise<number>;
  onFolderChanged(callback: () => void): () => void;
}

declare global {
  interface Window {
    pokhair?: PokhairApi;
  }
}
