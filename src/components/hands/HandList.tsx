'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, FolderOpen, RotateCcw, Shuffle } from 'lucide-react';
import { HandTable } from '@/components/hands/HandTable';
import { PokerTableReplayer } from '@/components/hands/PokerTableReplayer';
import { useSync } from '@/components/providers/sync-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { db } from '@/lib/db';
import { availableLimits, GAME_OPTIONS } from '@/lib/poker/filters';
import {
  ENDING_OPTIONS,
  HAND_DATE_OPTIONS,
  netBB,
  POSITION_OPTIONS,
  POT_OPTIONS,
  PREFLOP_OPTIONS,
  RESULT_OPTIONS,
  searchHands,
  SORT_OPTIONS,
  type SortDir,
  type SortKey,
} from '@/lib/poker/hand-search';
import { cn, formatNumber } from '@/lib/utils';
import { useHandFilterStore } from '@/stores/useHandFilterStore';

const PAGE_SIZE = 100;
const controlClass =
  'h-[34px] rounded-md border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={controlClass} aria-label={label}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function HandList() {
  const { chooseFolder } = useSync();
  const { filters, setFilter, resetFilters, selectedHandId, selectHand } = useHandFilterStore();
  const hands = useLiveQuery(() => db.hands.toArray(), []);
  const [page, setPage] = useState(0);

  const all = useMemo(() => hands ?? [], [hands]);
  const limits = useMemo(() => availableLimits(all, [], filters.game), [all, filters.game]);
  const limit = limits.includes(filters.limit) ? filters.limit : 'all';
  const filtered = useMemo(() => searchHands(all, { ...filters, limit }), [all, filters, limit]);

  const selectedIndex = selectedHandId ? filtered.findIndex((h) => h.id === selectedHandId) : -1;
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : all.find((h) => h.id === selectedHandId);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const randomHand = () => {
    const pool = filtered.length > 1 ? filtered.filter((h) => h.id !== selectedHandId) : filtered;
    if (pool.length) selectHand(pool[Math.floor(Math.random() * pool.length)].id);
  };
  useEffect(() => setPage(0), [filters]);
  // Keep the replayed hand visible in the list while navigating hand by hand.
  useEffect(() => {
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / PAGE_SIZE));
  }, [selectedIndex]);

  const totals = useMemo(() => {
    const cash = filtered.filter((h) => h.gameType === 'cash');
    return { net: cash.reduce((a, h) => a + h.net, 0), bb: cash.reduce((a, h) => a + netBB(h), 0), cash: cash.length };
  }, [filtered]);

  if (hands?.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-4 p-12 text-center">
        <p className="text-muted-foreground">Aucune main importée.</p>
        <Button onClick={chooseFolder}>
          <FolderOpen />
          Choisir un dossier
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={filters.date} options={HAND_DATE_OPTIONS} onChange={(v) => setFilter('date', v)} />
          {filters.date === 'custom' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilter('from', e.target.value)}
                className={controlClass}
                aria-label="Du"
              />
              →
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilter('to', e.target.value)}
                className={controlClass}
                aria-label="Au"
              />
            </div>
          )}
          <Segmented value={filters.game} options={GAME_OPTIONS} onChange={(v) => setFilter('game', v)} />
          <select
            value={limit}
            onChange={(e) => setFilter('limit', e.target.value)}
            className={controlClass}
            aria-label="Limite"
          >
            <option value="all">Toutes les limites</option>
            {limits.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={filters.result} options={RESULT_OPTIONS} onChange={(v) => setFilter('result', v)} />
          <Segmented value={filters.position} options={POSITION_OPTIONS} onChange={(v) => setFilter('position', v)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select label="Situation préflop" value={filters.preflop} options={PREFLOP_OPTIONS} onChange={(v) => setFilter('preflop', v)} />
          <Select label="Fin de la main" value={filters.ending} options={ENDING_OPTIONS} onChange={(v) => setFilter('ending', v)} />
          <Select label="Taille du pot" value={filters.pot} options={POT_OPTIONS} onChange={(v) => setFilter('pot', v)} />
          <Select
            label="Tri"
            value={`${filters.sortKey}-${filters.sortDir}` as const}
            options={SORT_OPTIONS}
            onChange={(v) => {
              const [key, dir] = v.split('-') as [SortKey, SortDir];
              setFilter('sortKey', key);
              setFilter('sortDir', dir);
            }}
          />
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw />
            Réinitialiser
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {filtered.length.toLocaleString('fr-FR')} main{filtered.length > 1 ? 's' : ''}
          {totals.cash > 0 && (
            <>
              {' · Cash : '}
              <span className={cn(totals.net >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                {formatNumber(totals.net, 2, ' €')} ({formatNumber(totals.bb, 1, ' bb')})
              </span>
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={randomHand} disabled={!filtered.length}>
            <Shuffle />
            Main au hasard
          </Button>
          {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Page précédente">
              <ChevronLeft />
            </Button>
            <span className="tabular-nums">
              {currentPage + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight />
            </Button>
          </div>
          )}
        </div>
      </div>

      <Card>
        {visible.length ? (
          <HandTable hands={visible} selectedId={selectedHandId} onSelect={selectHand} />
        ) : (
          <p className="p-12 text-center text-muted-foreground">{hands ? 'Aucune main pour ces filtres.' : 'Chargement…'}</p>
        )}
      </Card>

      {selected && (
        <PokerTableReplayer
          hand={selected}
          counter={selectedIndex >= 0 ? `${selectedIndex + 1} / ${filtered.length}` : undefined}
          onClose={() => selectHand(null)}
          onPrevHand={selectedIndex > 0 ? () => selectHand(filtered[selectedIndex - 1].id) : undefined}
          onNextHand={
            selectedIndex >= 0 && selectedIndex < filtered.length - 1
              ? () => selectHand(filtered[selectedIndex + 1].id)
              : undefined
          }
          onRandomHand={filtered.length ? randomHand : undefined}
        />
      )}
    </div>
  );
}
