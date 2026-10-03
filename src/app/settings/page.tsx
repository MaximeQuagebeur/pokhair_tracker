'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CheckCircle2, FolderOpen, FolderX, Loader2, Monitor, Moon, RefreshCw, Sun, Trash2 } from 'lucide-react';
import { useSync } from '@/components/providers/sync-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clearDatabase, db } from '@/lib/db';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme';
import { cn } from '@/lib/utils';

const THEME_OPTIONS = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Monitor },
] as const;

function ThemeSelector() {
  const [theme, setTheme] = useState<ThemePreference | null>(null);
  useEffect(() => setTheme(getThemePreference()), []);

  return (
    <div className="flex w-fit rounded-md border p-0.5">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => {
            setThemePreference(value);
            setTheme(value);
          }}
          className={cn(
            'flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors',
            theme === value ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

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

export default function SettingsPage() {
  const { folder, isDesktop, status, chooseFolder, resync } = useSync();
  const handCount = useLiveQuery(() => db.hands.count(), []);
  const tournamentCount = useLiveQuery(() => db.tournaments.count(), []);
  const fileCount = useLiveQuery(() => db.files.count(), []);
  const busy = status === 'syncing';

  const onClear = async () => {
    if (!window.confirm('Supprimer toutes les mains importées ? Les fichiers source ne sont pas modifiés.')) return;
    await clearDatabase();
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>

      <Card>
        <CardHeader>
          <CardTitle>Apparence</CardTitle>
          <CardDescription>Thème de l&apos;application.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dossier d&apos;historique</CardTitle>
          <CardDescription>
            Dossier <span className="font-mono">history</span> de Winamax, surveillé en temps réel.
            <br />
            macOS : <span className="font-mono">~/Library/Application Support/winamax/documents/accounts/&lt;pseudo&gt;/history</span>
            <br />
            Windows : <span className="font-mono">%APPDATA%\winamax\documents\accounts\&lt;pseudo&gt;\history</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs" title={folder ?? undefined}>
              {folder ?? 'Aucun dossier'}
            </span>
            {isDesktop && folder && (
              <Button variant="outline" size="icon" onClick={() => resync()} disabled={busy} title="Resynchroniser">
                <RefreshCw />
              </Button>
            )}
            <Button onClick={chooseFolder} disabled={busy}>
              <FolderOpen />
              Choisir
            </Button>
          </div>
          <SyncIndicator />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Base de données locale</CardTitle>
          <CardDescription>
            {(handCount ?? 0).toLocaleString('fr-FR')} mains · {(tournamentCount ?? 0).toLocaleString('fr-FR')}{' '}
            tournois · {(fileCount ?? 0).toLocaleString('fr-FR')} fichiers
            analysés
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {isDesktop && (
            <Button variant="outline" onClick={() => resync(true)} disabled={busy || !folder}>
              <RefreshCw />
              Réanalyser tous les fichiers
            </Button>
          )}
          <Button variant="destructive" onClick={onClear} disabled={busy}>
            <Trash2 />
            Vider la base
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
