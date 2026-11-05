'use client';

import { useEffect, useRef } from 'react';
import { GRID_RANKS } from '@/lib/poker/cards';
import { cn } from '@/lib/utils';

const GRID = Array.from(GRID_RANKS, (r1, i) =>
  Array.from(GRID_RANKS, (r2, j) => (i === j ? r1 + r2 : i < j ? `${r1}${r2}s` : `${r2}${r1}o`)),
);

interface StartingHandsPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** Phone layout: cells fill the width. */
  fill?: boolean;
}

/** 13x13 grid (pairs on the diagonal, suited above, offsuit below). Click or drag to toggle. */
export function StartingHandsPicker({ value, onChange, fill }: StartingHandsPickerProps) {
  const selected = new Set(value);
  const drag = useRef<{ add: boolean; set: Set<string> } | null>(null);

  useEffect(() => {
    const stop = () => {
      drag.current = null;
    };
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  const apply = (hand: string) => {
    const state = drag.current;
    if (!state || state.set.has(hand) === state.add) return;
    if (state.add) state.set.add(hand);
    else state.set.delete(hand);
    onChange([...state.set]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn('grid select-none gap-px', fill ? 'w-full' : 'w-fit')}
        style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
        role="group"
        aria-label="Mains de départ"
      >
        {GRID.flat().map((hand) => {
          const on = selected.has(hand);
          return (
            <button
              key={hand}
              type="button"
              aria-pressed={on}
              onPointerDown={(e) => {
                e.preventDefault();
                drag.current = { add: !on, set: new Set(value) };
                apply(hand);
              }}
              onPointerEnter={() => apply(hand)}
              className={cn(
                'flex items-center justify-center rounded-[2px] font-mono font-semibold transition-colors',
                fill ? 'aspect-square text-[9px]' : 'h-7 w-9 text-[11px]',
                on
                  ? 'bg-primary text-primary-foreground'
                  : hand.length === 2
                    ? 'bg-muted text-foreground hover:bg-accent'
                    : hand.endsWith('s')
                      ? 'bg-muted/60 text-muted-foreground hover:bg-accent'
                      : 'bg-muted/30 text-muted-foreground hover:bg-accent',
              )}
            >
              {hand}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {value.length ? `${value.length} main${value.length > 1 ? 's' : ''} sélectionnée${value.length > 1 ? 's' : ''}` : 'Aucune sélection : toutes les mains'}
        </span>
        <button type="button" onClick={() => onChange([])} disabled={!value.length} className="underline-offset-2 hover:underline disabled:opacity-40">
          Effacer
        </button>
      </div>
    </div>
  );
}
