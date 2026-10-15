'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { db, ingestFile } from '@/lib/db';
import {
  cloudNeedsFullPush,
  getAccessKey,
  isCloudWeb,
  pullFromCloud,
  pushAllToCloud,
  pushChanges,
} from '@/lib/cloud/client';
import type { CloudStatus } from '@/types/pokhair';

const FOLDER_KEY = 'pokhair.folder';

export type SyncStatus = 'no-folder' | 'idle' | 'syncing' | 'error';

interface SyncState {
  isDesktop: boolean;
  /** PWA served by Vercel: data comes from Turso. */
  isCloudWeb: boolean;
  folder: string | null;
  status: SyncStatus;
  progress: { done: number; total: number };
  lastSync: Date | null;
  error: string | null;
  /** Desktop only: Turso connection (null until loaded). */
  cloud: CloudStatus | null;
  cloudError: string | null;
  chooseFolder: () => Promise<void>;
  resync: (full?: boolean) => Promise<void>;
  refreshCloud: () => Promise<void>;
  pushAll: () => Promise<void>;
  pullCloud: () => Promise<void>;
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
  const [cloudWeb, setCloudWeb] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>('no-folder');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cloud, setCloud] = useState<CloudStatus | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const running = useRef(false);
  const pending = useRef(false);
  const cloudOn = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /** Cloud failures never block the local sync: they are reported separately. */
  const pushSafely = useCallback(async (push: () => Promise<void>) => {
    if (!cloudOn.current) return;
    try {
      await push();
      setCloudError(null);
    } catch (err) {
      setCloudError((err as Error).message);
    }
  }, []);

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
      if (cloudNeedsFullPush()) await pushSafely(() => pushAllToCloud());
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
          const changes = await ingestFile(changed[i], await api.readFile(changed[i].path));
          await pushSafely(() => pushChanges(changes));
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
  }, [pushSafely]);

  /** PWA: incremental download from Turso through /api/cloud. */
  const pullCloud = useCallback(async () => {
    if (running.current || !getAccessKey()) return;
    running.current = true;
    setStatus('syncing');
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      await pullFromCloud((hands) => setProgress({ done: hands, total: 0 }));
      setLastSync(new Date());
      setStatus('idle');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    } finally {
      running.current = false;
    }
  }, []);

  const refreshCloud = useCallback(async () => {
    const api = window.pokhair;
    if (!api) return;
    const next = await api.cloudStatus();
    cloudOn.current = next.configured;
    setCloud(next);
  }, []);

  const pushAll = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setStatus('syncing');
    try {
      await pushSafely(() => pushAllToCloud((done, total) => setProgress({ done, total })));
    } finally {
      running.current = false;
      setStatus('idle');
    }
  }, [pushSafely]);

  /** Browser fallback (no Electron): one-shot import through a directory picker. */
  const importBrowserFiles = useCallback(async (list: FileList | null) => {
    const files = [...(list ?? [])].filter((f) => f.name.toLowerCase().endsWith('.txt'));
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
    if (isCloudWeb()) {
      setCloudWeb(true);
      setFolder('Cloud Turso');
      void pullCloud();
      // Home-screen apps are resumed rather than reloaded: refresh when brought back to the foreground.
      const onVisible = () => document.visibilityState === 'visible' && void pullCloud();
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }
    if (!api) return;
    const saved = localStorage.getItem(FOLDER_KEY);
    void refreshCloud().finally(() => {
      if (saved) void syncFolder(saved);
    });
    if (saved) setFolder(saved);
    return api.onFolderChanged(() => {
      const current = localStorage.getItem(FOLDER_KEY);
      if (current) void syncFolder(current);
    });
  }, [syncFolder, pullCloud, refreshCloud]);

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
    <SyncContext.Provider
      value={{
        isDesktop,
        isCloudWeb: cloudWeb,
        folder,
        status,
        progress,
        lastSync,
        error,
        cloud,
        cloudError,
        chooseFolder,
        resync,
        refreshCloud,
        pushAll,
        pullCloud,
      }}
    >
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
