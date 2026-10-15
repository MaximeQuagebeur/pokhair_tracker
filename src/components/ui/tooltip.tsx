'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HoverTooltipProps {
  content: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

const bubbleClass =
  'pointer-events-none absolute bottom-full z-50 mb-2 w-64 rounded-md border bg-card px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-card-foreground opacity-0 shadow-lg transition-opacity delay-75';
const alignClass = (align: HoverTooltipProps['align']) =>
  cn(align === 'start' && 'left-0', align === 'end' && 'right-0', align === 'center' && 'left-1/2 -translate-x-1/2');

/** CSS-only tooltip shown above its trigger on hover or keyboard focus (desktop only: touch has no hover). */
export function HoverTooltip({ content, children, align = 'center', className }: HoverTooltipProps) {
  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(bubbleClass, alignClass(align), 'group-focus-within/tip:opacity-100 group-hover/tip:opacity-100 max-md:hidden')}
      >
        {content}
      </span>
    </span>
  );
}

/** Info icon: hover on desktop, tap on touch screens (shown as a banner above the tab bar). */
export function InfoTip({ content, align = 'center' }: { content: ReactNode; align?: HoverTooltipProps['align'] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener('pointerdown', close);
    window.addEventListener('scroll', dismiss, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', dismiss);
    };
  }, [open]);

  return (
    <span ref={ref} className="group/tip relative inline-flex">
      <button
        type="button"
        aria-label="Information"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-md:size-6 max-md:-m-1.5"
      >
        <Info className="size-3.5" />
      </button>
      <span
        role="tooltip"
        className={cn(
          bubbleClass,
          alignClass(align),
          'md:group-focus-within/tip:opacity-100 md:group-hover/tip:opacity-100',
          'max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] max-md:left-4 max-md:w-auto max-md:translate-x-0 max-md:rounded-2xl max-md:bg-card/95 max-md:p-4 max-md:text-sm max-md:shadow-2xl max-md:backdrop-blur-xl',
          open && 'opacity-100',
        )}
      >
        {content}
      </span>
    </span>
  );
}
