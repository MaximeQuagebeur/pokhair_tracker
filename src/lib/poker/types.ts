export interface HandRecord {
  /** Winamax HandId (e.g. `22989145-288-1790794436`). */
  id: string;
  /** Epoch ms (UTC). */
  timestamp: number;
  table: string;
  game: string;
  smallBlind: number;
  bigBlind: number;
  hero: string;
  heroCards: string[];
  /** Net won in currency: collected - invested. */
  net: number;
  /** All-in adjusted expected net (equals `net` when no pre-river all-in). */
  allInEv: number;
  allInAdjusted: boolean;
  rake: number;
  /** Hero reached showdown without folding. */
  showdown: boolean;
  wonAtShowdown: boolean;
  sawFlop: boolean;
  vpip: boolean;
  pfr: boolean;
  threeBetOpportunity: boolean;
  threeBet: boolean;
  postflopBets: number;
  postflopRaises: number;
  postflopCalls: number;
  sourceFile: string;
}
