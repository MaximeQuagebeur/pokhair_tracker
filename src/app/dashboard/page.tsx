'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { Info, Settings } from 'lucide-react';
import { FiltersBar } from '@/components/dashboard/filters-bar';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { StatCards, type StatsMode } from '@/components/dashboard/stat-cards';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { db } from '@/lib/db';
import { availableLimits, filterHands, filterTournaments } from '@/lib/poker/filters';
import { buildCurves, buildTournamentCurve, computeStats, type Unit } from '@/lib/poker/stats';
import { useDashboardStore } from '@/stores/useDashboardStore';

const UNIT_OPTIONS = [
  { value: 'eur', label: '€' },
  { value: 'bb', label: 'BB' },
] as const;

export default function DashboardPage() {
  const { unit, setUnit, filters, setFilters, axis, setAxis } = useDashboardStore();
  useEffect(() => {
    useDashboardStore.persist.rehydrate();
  }, []);
  const hands = useLiveQuery(() => db.hands.orderBy('timestamp').toArray(), []);
  const tournaments = useLiveQuery(() => db.tournaments.toArray(), []);

  const sorted = useMemo(
    () => (hands ?? []).slice().sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)),
    [hands],
  );
  const allTournaments = useMemo(() => tournaments ?? [], [tournaments]);
  const limits = useMemo(
    () => availableLimits(sorted, allTournaments, filters.game),
    [sorted, allTournaments, filters.game],
  );
  const limit = limits.includes(filters.limit) ? filters.limit : 'all';
  const filtered = useMemo(
    () => filterHands(sorted, { date: filters.date, game: filters.game, limit }),
    [sorted, filters.date, filters.game, limit],
  );
  const filteredTournaments = useMemo(
    () => filterTournaments(allTournaments, { date: filters.date, game: filters.game, limit }),
    [allTournaments, filters.date, filters.game, limit],
  );

  const mode: StatsMode = filters.game === 'cash' ? 'cash' : filters.game === 'all' ? 'all' : 'tournament';
  // Tournament profit only exists in € (chip counts are not money).
  const effectiveUnit: Unit = mode === 'tournament' ? 'eur' : unit;
  const stats = useMemo(() => computeStats(filtered, filteredTournaments), [filtered, filteredTournaments]);
  const curves = useMemo(
    () =>
      mode === 'tournament'
        ? buildTournamentCurve(filteredTournaments, 400)
        : buildCurves(filtered, filteredTournaments, effectiveUnit, 400),
    [mode, filtered, filteredTournaments, effectiveUnit],
  );
  const tournamentsHiddenInBB = effectiveUnit === 'bb' && filteredTournaments.length > 0;
  const isEmpty = hands?.length === 0 && tournaments?.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statistiques & Graphiques</h1>
          <p className="text-sm text-muted-foreground">Winamax</p>
        </div>
        <div className="flex items-center gap-3">
          <Segmented
            value={axis}
            options={[
              { value: 'count', label: mode === 'tournament' ? 'Tournois' : 'Mains' },
              { value: 'date', label: 'Dates' },
            ]}
            onChange={setAxis}
          />
          {mode !== 'tournament' && <Segmented value={unit} options={UNIT_OPTIONS} onChange={setUnit} />}
        </div>
      </div>

      {isEmpty ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <p className="text-muted-foreground">
            Aucune main importée. Sélectionnez votre dossier d&apos;historique Winamax dans les réglages pour commencer.
          </p>
          <Link href="/settings" className={buttonVariants()}>
            <Settings />
            Ouvrir les réglages
          </Link>
        </Card>
      ) : (
        <>
          <FiltersBar filters={{ ...filters, limit }} limits={limits} onChange={setFilters} />
          {tournamentsHiddenInBB && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="size-3.5" />
              En BB, seuls les résultats cash sont affichés : les tournois et Expresso sont comptés en €.
            </p>
          )}
          {filtered.length === 0 && filteredTournaments.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">Aucune main pour ces filtres.</Card>
          ) : (
            <>
              <StatCards stats={stats} unit={effectiveUnit} mode={mode} />
              <PerformanceChart
                key={mode}
                data={curves}
                unit={effectiveUnit}
                xAxis={mode === 'tournament' ? 'tournament' : 'hand'}
                showDates={axis === 'date'}
                series={mode === 'tournament' ? ['net'] : undefined}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
