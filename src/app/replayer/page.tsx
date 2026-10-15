'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MobileReplayer } from '@/components/hands/MobileReplayer';
import { db } from '@/lib/db';
import { availableLimits } from '@/lib/poker/filters';
import { searchHands } from '@/lib/poker/hand-search';
import { useHandFilterStore } from '@/stores/useHandFilterStore';

/** Replays the hand selected in /hands (or the first one of the active filters). */
export default function ReplayerPage() {
  const { filters, selectedHandId, selectHand } = useHandFilterStore();
  const hands = useLiveQuery(() => db.hands.toArray(), []);

  const all = useMemo(() => hands ?? [], [hands]);
  const limits = useMemo(() => availableLimits(all, [], filters.game), [all, filters.game]);
  const limit = limits.includes(filters.limit) ? filters.limit : 'all';
  const filtered = useMemo(() => searchHands(all, { ...filters, limit }), [all, filters, limit]);

  const found = selectedHandId ? filtered.findIndex((h) => h.id === selectedHandId) : -1;
  const index = found >= 0 ? found : 0;
  const hand = found >= 0 ? filtered[found] : (all.find((h) => h.id === selectedHandId) ?? filtered[0]);

  if (!hands) return <p className="py-24 text-center text-sm text-muted-foreground">Chargement…</p>;
  if (!hand) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-muted-foreground">Aucune main à rejouer.</p>
        <Link href="/settings/" className="rounded-md border px-6 py-3 text-sm font-medium active:bg-accent">
          Synchroniser
        </Link>
      </div>
    );
  }

  return (
    <MobileReplayer
      hand={hand}
      counter={filtered.length ? `${index + 1} / ${filtered.length}` : undefined}
      onPrevHand={index > 0 ? () => selectHand(filtered[index - 1].id) : undefined}
      onNextHand={index < filtered.length - 1 ? () => selectHand(filtered[index + 1].id) : undefined}
    />
  );
}
