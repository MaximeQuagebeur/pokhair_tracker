import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HoverTooltipProps {
  content: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/** CSS-only tooltip shown above its trigger on hover or keyboard focus. */
export function HoverTooltip({ content, children, align = 'center', className }: HoverTooltipProps) {
  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full z-50 mb-2 w-64 rounded-md border bg-card px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-card-foreground opacity-0 shadow-lg transition-opacity delay-75 group-focus-within/tip:opacity-100 group-hover/tip:opacity-100',
          align === 'start' && 'left-0',
          align === 'end' && 'right-0',
          align === 'center' && 'left-1/2 -translate-x-1/2',
        )}
      >
        {content}
      </span>
    </span>
  );
}

export function InfoTip({ content, align }: { content: ReactNode; align?: HoverTooltipProps['align'] }) {
  return (
    <HoverTooltip content={content} align={align}>
      <button
        type="button"
        aria-label="Information"
        className="inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Info className="size-3.5" />
      </button>
    </HoverTooltip>
  );
}
