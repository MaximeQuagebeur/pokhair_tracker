import type { GameFilter } from './filters';
import type { EndStreet, HandRecord, Position } from './types';

export type ResultFilter = 'all' | 'won' | 'lost';
export type PreflopFilter = 'all' | 'vpip' | 'pfr' | 'threeBet' | 'foldToThreeBet' | 'steal' | 'allIn';
export type EndingFilter = 'all' | EndStreet;
export type PotFilter = 'all' | 'small' | 'medium' | 'large';
export type HandDateRange = 'today' | '7d' | 'month' | 'all' | 'custom';
export type SortKey = 'date' | 'net' | 'netBB';
export type SortDir = 'asc' | 'desc';

export interface HandSearchFilters {
  game: GameFilter;
  limit: string;
  result: ResultFilter;
  position: 'all' | Position;
  preflop: PreflopFilter;
  ending: EndingFilter;
  pot: PotFilter;
  date: HandDateRange;
  /** `YYYY-MM-DD` (local), used when `date === 'custom'`. */
  from: string;
  to: string;
  sortKey: SortKey;
  sortDir: SortDir;
}

export const DEFAULT_HAND_SEARCH: HandSearchFilters = {
  game: 'all',
  limit: 'all',
  result: 'all',
  position: 'all',
  preflop: 'all',
  ending: 'all',
  pot: 'all',
  date: 'all',
  from: '',
  to: '',
  sortKey: 'date',
  sortDir: 'desc',
};

export const RESULT_OPTIONS: { value: ResultFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'won', label: 'Gagnantes' },
  { value: 'lost', label: 'Perdantes' },
];

export const POSITION_OPTIONS: { value: 'all' | Position; label: string }[] = [
  { value: 'all', label: 'Tous' },
  ...(['SB', 'BB', 'UTG', 'MP', 'HJ', 'CO', 'BTN'] as const).map((p) => ({ value: p, label: p })),
];

export const PREFLOP_OPTIONS: { value: PreflopFilter; label: string }[] = [
  { value: 'all', label: 'Toutes situations' },
  { value: 'vpip', label: 'VPIP seul (limp / call)' },
  { value: 'pfr', label: 'Relance préflop (PFR)' },
  { value: 'threeBet', label: '3-Bet' },
  { value: 'foldToThreeBet', label: 'Fold face à un 3-Bet' },
  { value: 'steal', label: 'Vol de blinds (Steal)' },
  { value: 'allIn', label: 'All-in' },
];

export const ENDING_OPTIONS: { value: EndingFilter; label: string }[] = [
  { value: 'all', label: 'Toutes fins' },
  { value: 'showdown', label: 'Abattage (Showdown)' },
  { value: 'preflop', label: 'Terminée préflop' },
  { value: 'flop', label: 'Terminée au flop' },
  { value: 'turn', label: 'Terminée à la turn' },
  { value: 'river', label: 'Terminée à la river' },
];

export const POT_OPTIONS: { value: PotFilter; label: string }[] = [
  { value: 'all', label: 'Tous pots' },
  { value: 'small', label: 'Petits (< 10 bb)' },
  { value: 'medium', label: 'Moyens (10-50 bb)' },
  { value: 'large', label: 'Gros (> 50 bb)' },
];

export const HAND_DATE_OPTIONS: { value: HandDateRange; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 jours' },
  { value: 'month', label: 'Ce mois' },
  { value: 'all', label: 'Tout' },
  { value: 'custom', label: 'Personnalisé' },
];

export const SORT_OPTIONS: { value: `${SortKey}-${SortDir}`; label: string }[] = [
  { value: 'date-desc', label: 'Plus récentes' },
  { value: 'date-asc', label: 'Plus anciennes' },
  { value: 'net-desc', label: 'Gain net € ↓' },
  { value: 'net-asc', label: 'Gain net € ↑' },
  { value: 'netBB-desc', label: 'Gain net bb ↓' },
  { value: 'netBB-asc', label: 'Gain net bb ↑' },
];

const toBB = (h: HandRecord, value: number) => (h.bigBlind > 0 ? value / h.bigBlind : 0);
export const netBB = (h: HandRecord) => toBB(h, h.net);
export const potBB = (h: HandRecord) => toBB(h, h.pot);

/** [start, end) in epoch ms, local timezone. */
function dateBounds(f: HandSearchFilters, now: Date): [number, number] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const parseDay = (s: string, offset = 0) => {
    const [yy, mm, dd] = s.split('-').map(Number);
    return yy ? new Date(yy, mm - 1, dd + offset).getTime() : NaN;
  };
  switch (f.date) {
    case 'today':
      return [new Date(y, m, d).getTime(), Infinity];
    case '7d':
      return [new Date(y, m, d - 6).getTime(), Infinity];
    case 'month':
      return [new Date(y, m, 1).getTime(), Infinity];
    case 'custom': {
      const start = parseDay(f.from);
      const end = parseDay(f.to, 1);
      return [Number.isNaN(start) ? -Infinity : start, Number.isNaN(end) ? Infinity : end];
    }
    default:
      return [-Infinity, Infinity];
  }
}

function matchesPreflop(h: HandRecord, filter: PreflopFilter): boolean {
  switch (filter) {
    case 'vpip':
      return h.vpip && !h.pfr;
    case 'pfr':
      return h.pfr;
    case 'threeBet':
      return h.threeBet;
    case 'foldToThreeBet':
      return h.foldToThreeBet;
    case 'steal':
      return h.steal;
    case 'allIn':
      return h.heroAllIn;
    default:
      return true;
  }
}

function matchesPot(h: HandRecord, filter: PotFilter): boolean {
  const bb = potBB(h);
  if (filter === 'small') return bb < 10;
  if (filter === 'medium') return bb >= 10 && bb <= 50;
  if (filter === 'large') return bb > 50;
  return true;
}

export function searchHands(hands: HandRecord[], f: HandSearchFilters, now = new Date()): HandRecord[] {
  const [start, end] = dateBounds(f, now);
  const result = hands.filter(
    (h) =>
      h.timestamp >= start &&
      h.timestamp < end &&
      (f.game === 'all' || h.gameType === f.game) &&
      (f.limit === 'all' || h.limit === f.limit) &&
      (f.result === 'all' || (f.result === 'won' ? h.net > 0 : h.net < 0)) &&
      (f.position === 'all' || h.heroPosition === f.position) &&
      (f.ending === 'all' || h.endStreet === f.ending) &&
      matchesPreflop(h, f.preflop) &&
      matchesPot(h, f.pot),
  );
  const value = f.sortKey === 'date' ? (h: HandRecord) => h.timestamp : f.sortKey === 'net' ? (h: HandRecord) => h.net : netBB;
  const dir = f.sortDir === 'asc' ? 1 : -1;
  return result.sort((a, b) => dir * (value(a) - value(b) || a.timestamp - b.timestamp || a.id.localeCompare(b.id)));
}
