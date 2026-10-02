import type { GameType, HandRecord, TournamentRecord } from './types';

export type DateRange = 'today' | 'yesterday' | 'month' | 'year' | 'all';
export type GameFilter = 'all' | GameType;

export interface HandFilters {
  date: DateRange;
  game: GameFilter;
  /** `'all'` or a value of `HandRecord.limit`. */
  limit: string;
}

export const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: 'month', label: 'Ce mois' },
  { value: 'year', label: 'Cette année' },
  { value: 'all', label: 'Tout' },
];

export const GAME_OPTIONS: { value: GameFilter; label: string }[] = [
  { value: 'cash', label: 'Cash Game' },
  { value: 'tournament', label: 'Tournoi' },
  { value: 'expresso', label: 'Expresso' },
  { value: 'all', label: 'Tout' },
];

/** [start, end) in epoch ms, using the local timezone. */
function dateBounds(range: DateRange, now: Date): [number, number] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (range) {
    case 'today':
      return [new Date(y, m, d).getTime(), Infinity];
    case 'yesterday':
      return [new Date(y, m, d - 1).getTime(), new Date(y, m, d).getTime()];
    case 'month':
      return [new Date(y, m, 1).getTime(), Infinity];
    case 'year':
      return [new Date(y, 0, 1).getTime(), Infinity];
    default:
      return [-Infinity, Infinity];
  }
}

export function filterHands(hands: HandRecord[], filters: HandFilters, now = new Date()): HandRecord[] {
  const [start, end] = dateBounds(filters.date, now);
  return hands.filter(
    (h) =>
      h.timestamp >= start &&
      h.timestamp < end &&
      (filters.game === 'all' || h.gameType === filters.game) &&
      (filters.limit === 'all' || h.limit === filters.limit),
  );
}

export function filterTournaments(
  tournaments: TournamentRecord[],
  filters: HandFilters,
  now = new Date(),
): TournamentRecord[] {
  const [start, end] = dateBounds(filters.date, now);
  return tournaments.filter(
    (t) =>
      t.startTime >= start &&
      t.startTime < end &&
      (filters.game === 'all' || t.gameType === filters.game) &&
      (filters.limit === 'all' || t.limit === filters.limit),
  );
}

const GAME_ORDER: Record<GameType, number> = { cash: 0, expresso: 1, tournament: 2 };
const limitValue = (limit: string) => Number.parseFloat(limit.replace(/^\D+/, '').replace(',', '.')) || 0;

/** Distinct limits present in hands and tournaments for the selected game, sorted by game then stake. */
export function availableLimits(
  hands: HandRecord[],
  tournaments: TournamentRecord[],
  game: GameFilter,
): string[] {
  const limits = new Map<string, GameType>();
  for (const item of [...hands, ...tournaments]) {
    if (game === 'all' || item.gameType === game) limits.set(item.limit, item.gameType);
  }
  return [...limits.entries()]
    .sort(([a, ga], [b, gb]) => GAME_ORDER[ga] - GAME_ORDER[gb] || limitValue(a) - limitValue(b) || a.localeCompare(b))
    .map(([limit]) => limit);
}
