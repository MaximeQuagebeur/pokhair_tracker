'use client';

import { AlertTriangle, CheckCircle2, FolderOpen, FolderX, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSync } from '@/components/providers/sync-provider';

function SyncIndicator() {
  const { status, progress, lastSync, error } = useSync();
  switch (status) {
    case 'syncing':
      return (
        <span className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <Loader2 className="size-4 animate-spin" />
          Synchronisation… {progress.total > 0 && `${progress.done}/${progress.total} fichiers`}
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400" title={error ?? undefined}>
          <AlertTriangle className="size-4" />
          Erreur de synchronisation
        </span>
      );
    case 'idle':
      return (
        <span className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          Synchronisé {lastSync && `à ${lastSync.toLocaleTimeString('fr-FR')}`}
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderX className="size-4" />
          Aucun dossier sélectionné
        </span>
      );
  }
}

export function TopBar() {
  const { folder, status, isDesktop, chooseFolder, resync } = useSync();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-6">
      <SyncIndicator />
      <div className="flex min-w-0 items-center gap-2">
        {folder && (
          <span className="truncate rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground" title={folder}>
            {folder}
          </span>
        )}
        {isDesktop && folder && (
          <Button variant="ghost" size="icon" onClick={() => resync()} disabled={status === 'syncing'} title="Resynchroniser">
            <RefreshCw />
          </Button>
        )}
        <Button size="sm" onClick={chooseFolder} disabled={status === 'syncing'}>
          <FolderOpen />
          Choisir un dossier
        </Button>
      </div>
    </header>
  );
}
