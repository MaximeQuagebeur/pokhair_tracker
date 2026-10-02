import { Segmented } from '@/components/ui/segmented';
import { DATE_OPTIONS, GAME_OPTIONS, type HandFilters } from '@/lib/poker/filters';

interface FiltersBarProps {
  filters: HandFilters;
  limits: string[];
  onChange: (filters: HandFilters) => void;
}

export function FiltersBar({ filters, limits, onChange }: FiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented value={filters.date} options={DATE_OPTIONS} onChange={(date) => onChange({ ...filters, date })} />
      <Segmented
        value={filters.game}
        options={GAME_OPTIONS}
        onChange={(game) => onChange({ ...filters, game, limit: 'all' })}
      />
      <select
        value={filters.limit}
        onChange={(e) => onChange({ ...filters, limit: e.target.value })}
        className="h-[34px] rounded-md border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
  );
}
