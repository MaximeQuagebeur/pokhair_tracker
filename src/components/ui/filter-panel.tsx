'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  /** One-line recap of the active filters, shown while collapsed. */
  summary: string;
  /** Number of filters differing from their default. */
  activeCount?: number;
  children: ReactNode;
  className?: string;
}

/** Mobile foldable filter block. */
export function FilterPanel({ summary, activeCount = 0, children, className }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-card/60 backdrop-blur', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-accent/60"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <SlidersHorizontal className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            Filtres
            {activeCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground">
                {activeCount}
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <div className={cn('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="min-h-0" inert={!open}>
          <div className="flex flex-col gap-4 border-t px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Labelled row inside a FilterPanel. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export const mobileSelectClass =
  'h-11 w-full rounded-xl border bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
