'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { db, ingestFile } from '@/lib/db';

const FOLDER_KEY = 'pokhair.folder';

export type SyncStatus = 'no-folder' | 'idle' | 'syncing' | 'error';

interface SyncState {
  isDesktop: boolean;
  folder: string | null;
  status: SyncStatus;
  progress: { done: number; total: number };
  lastSync: Date | null;
  error: string | null;
  chooseFolder: () => Promise<void>;
  resync: (full?: boolean) => Promise<void>;
}

const SyncContext = createContext<SyncState | null>(null);

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}

const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));
const RECENT_MS = 24 * 60 * 60 * 1000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>('no-folder');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const pending = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const syncFolder = useCallback(async (dir: string, full = false, rereadRecent = false) => {
    const api = window.pokhair;
    if (!api) return;
    if (running.current) {
      pending.current = true;
      return;
    }
    running.current = true;
    setStatus('syncing');
    setError(null);
    try {
      do {
        pending.current = false;
        if (full) await db.files.clear();
        const files = await api.openFolder(dir);
        const known = new Map((await db.files.toArray()).map((f) => [f.path, f]));
        const changed = files.filter((f) => {
          const k = known.get(f.path);
          // Files of active tables may report stale metadata on Windows: a manual refresh re-reads them anyway.
          if (rereadRecent && Date.now() - f.mtimeMs < RECENT_MS) return true;
          return !k || k.size !== f.size || k.mtimeMs !== f.mtimeMs;
        });
        setProgress({ done: 0, total: changed.length });
        for (let i = 0; i < changed.length; i++) {
          await ingestFile(changed[i], await api.readFile(changed[i].path));
          setProgress({ done: i + 1, total: changed.length });
          await yieldToUi();
        }
        full = false;
        rereadRecent = false;
      } while (pending.current);
      setLastSync(new Date());
      setStatus('idle');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    } finally {
      running.current = false;
    }
  }, []);

  /** Browser fallback (no Electron): one-shot import through a directory picker. */
  const importBrowserFiles = useCallback(async (list: FileList | null) => {
    const files = [...(list ?? [])].filter((f) => f.name.toLowerCase().endsWith('.txt') && !/summary/i.test(f.name));
    if (!files.length) return;
    setStatus('syncing');
    setError(null);
    setFolder(files[0].webkitRelativePath.split('/')[0] || 'Import navigateur');
    try {
      setProgress({ done: 0, total: files.length });
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        await ingestFile({ path: f.webkitRelativePath || f.name, size: f.size, mtimeMs: f.lastModified }, await f.text());
        setProgress({ done: i + 1, total: files.length });
        await yieldToUi();
      }
      setLastSync(new Date());
      setStatus('idle');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const api = window.pokhair;
    setIsDesktop(!!api);
    if (!api) return;
    const saved = localStorage.getItem(FOLDER_KEY);
    if (saved) {
      setFolder(saved);
      void syncFolder(saved);
    }
    return api.onFolderChanged(() => {
      const current = localStorage.getItem(FOLDER_KEY);
      if (current) void syncFolder(current);
    });
  }, [syncFolder]);

  const chooseFolder = useCallback(async () => {
    const api = window.pokhair;
    if (!api) {
      fileInput.current?.click();
      return;
    }
    const dir = await api.selectFolder();
    if (!dir) return;
    localStorage.setItem(FOLDER_KEY, dir);
    setFolder(dir);
    await syncFolder(dir);
  }, [syncFolder]);

  const resync = useCallback(
    async (full = false) => {
      if (folder && window.pokhair) await syncFolder(folder, full, true);
    },
    [folder, syncFolder],
  );

  return (
    <SyncContext.Provider value={{ isDesktop, folder, status, progress, lastSync, error, chooseFolder, resync }}>
      {children}
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        {...{ webkitdirectory: '' }}
        onChange={(e) => {
          void importBrowserFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </SyncContext.Provider>
  );
}
