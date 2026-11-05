import { cn } from '@/lib/utils';

interface LastHandsInputProps {
  /** 0 = every hand. */
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

/** "Last N hands" numeric filter; empty means all hands. */
export function LastHandsInput({ value, onChange, className }: LastHandsInputProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      step={1}
      placeholder="Toutes"
      value={value > 0 ? value : ''}
      onChange={(e) => {
        const n = Math.floor(Number(e.target.value));
        onChange(Number.isFinite(n) && n > 0 ? n : 0);
      }}
      className={cn(
        'h-[34px] w-24 rounded-md border bg-background px-3 text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
      aria-label="Nombre de dernières mains"
    />
  );
}
