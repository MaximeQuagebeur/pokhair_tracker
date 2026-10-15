import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Mobile: full width, wraps instead of overflowing, larger touch targets. */
  fill?: boolean;
}

export function Segmented<T extends string>({ value, options, onChange, fill }: SegmentedProps<T>) {
  return (
    <div className={cn('flex w-fit rounded-md border p-0.5', fill && 'w-full flex-wrap gap-0.5 rounded-xl p-1')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'whitespace-nowrap rounded px-3 py-1 text-sm transition-colors',
            fill && 'min-h-9 grow rounded-lg px-2',
            // Balanced rows on phones: 1 row up to 4 options, then 3 or 4 per row.
            fill && (options.length <= 4 ? 'basis-0' : options.length <= 6 ? 'basis-[30%]' : 'basis-[22%]'),
            value === o.value ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
