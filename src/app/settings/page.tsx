'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FolderOpen, Monitor, Moon, RefreshCw, Sun, Trash2 } from 'lucide-react';
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
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
            {folder ?? 'Aucun dossier'}
          </span>
          <Button onClick={chooseFolder} disabled={busy}>
            <FolderOpen />
            Choisir
          </Button>
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
