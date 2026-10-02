'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FolderOpen, Info } from 'lucide-react';
import { FiltersBar } from '@/components/dashboard/filters-bar';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { StatCards } from '@/components/dashboard/stat-cards';
import { useSync } from '@/components/providers/sync-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { db } from '@/lib/db';
import { availableLimits, filterHands, type HandFilters } from '@/lib/poker/filters';
import { buildCurves, computeStats, isMoneyHand, type Unit } from '@/lib/poker/stats';

const UNIT_OPTIONS = [
  { value: 'eur', label: '€' },
  { value: 'bb', label: 'BB' },
] as const;

export default function DashboardPage() {
  const [unit, setUnit] = useState<Unit>('eur');
  const [filters, setFilters] = useState<HandFilters>({ date: 'all', game: 'all', limit: 'all' });
  const { chooseFolder } = useSync();
  const hands = useLiveQuery(() => db.hands.orderBy('timestamp').toArray(), []);

  const sorted = useMemo(
    () => (hands ?? []).slice().sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)),
    [hands],
  );
  const limits = useMemo(() => availableLimits(sorted, filters.game), [sorted, filters.game]);
  const limit = limits.includes(filters.limit) ? filters.limit : 'all';
  const filtered = useMemo(
    () => filterHands(sorted, { date: filters.date, game: filters.game, limit }),
    [sorted, filters.date, filters.game, limit],
  );
  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const curves = useMemo(() => buildCurves(filtered, unit, 400), [filtered, unit]);
  const hasChipHands = unit === 'eur' && filtered.some((h) => !isMoneyHand(h));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statistiques & Graphiques</h1>
          <p className="text-sm text-muted-foreground">Winamax</p>
        </div>
        <Segmented value={unit} options={UNIT_OPTIONS} onChange={setUnit} />
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
          <FiltersBar filters={{ ...filters, limit }} limits={limits} onChange={setFilters} />
          {hasChipHands && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="size-3.5" />
              Les mains de tournoi et d&apos;Expresso sont en jetons : elles comptent en BB mais pas dans les gains en €.
            </p>
          )}
          {hands && filtered.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">Aucune main pour ces filtres.</Card>
          ) : (
            <>
              <StatCards stats={stats} unit={unit} />
              <PerformanceChart data={curves} unit={unit} />
            </>
          )}
        </>
      )}
    </div>
  );
}
