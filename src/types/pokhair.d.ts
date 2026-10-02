export interface HandFileInfo {
  path: string;
  size: number;
  mtimeMs: number;
}

/** API exposed by electron/preload.ts. Undefined when running in a plain browser. */
export interface PokhairApi {
  selectFolder(): Promise<string | null>;
  openFolder(dir: string): Promise<HandFileInfo[]>;
  readFile(filePath: string): Promise<string>;
  onFolderChanged(callback: () => void): () => void;
}

declare global {
  interface Window {
    pokhair?: PokhairApi;
  }
}
