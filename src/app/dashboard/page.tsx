'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FolderOpen } from 'lucide-react';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { StatCards } from '@/components/dashboard/stat-cards';
import { useSync } from '@/components/providers/sync-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { db } from '@/lib/db';
import { buildCurves, computeStats, type Unit } from '@/lib/poker/stats';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const [unit, setUnit] = useState<Unit>('eur');
  const { chooseFolder } = useSync();
  const hands = useLiveQuery(() => db.hands.orderBy('timestamp').toArray(), []);

  const sorted = useMemo(
    () => (hands ?? []).slice().sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)),
    [hands],
  );
  const stats = useMemo(() => computeStats(sorted), [sorted]);
  const curves = useMemo(() => buildCurves(sorted, unit, 400), [sorted, unit]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statistiques & Graphiques</h1>
          <p className="text-sm text-muted-foreground">Winamax · Cash Game</p>
        </div>
        <div className="flex rounded-md border p-0.5">
          {(['eur', 'bb'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={cn(
                'rounded px-3 py-1 text-sm transition-colors',
                unit === u ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {u === 'eur' ? '€' : 'BB'}
            </button>
          ))}
        </div>
      </div>

      {hands && hands.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <p className="text-muted-foreground">
            Aucune main importée. Sélectionnez votre dossier d&apos;historique Winamax pour commencer.
          </p>
          <Button onClick={chooseFolder}>
            <FolderOpen />
            Choisir un dossier
          </Button>
        </Card>
      ) : (
        <>
          <StatCards stats={stats} unit={unit} />
          <PerformanceChart data={curves} unit={unit} />
        </>
      )}
    </div>
  );
}
