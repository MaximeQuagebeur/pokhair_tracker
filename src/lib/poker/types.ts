export type GameType = 'cash' | 'tournament' | 'expresso';
export type Position = 'UTG' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
/** Last street of the hand ('showdown' when cards were shown down). */
export type EndStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

/** Original Winamax text of a hand, used by the replayer. */
export interface HandText {
  id: string;
  text: string;
}

/** Result of one tournament / Expresso, read from Winamax "summary" files. */
export interface TournamentRecord {
  /** Winamax tournament id (e.g. `1174072266`). */
  id: string;
  name: string;
  gameType: Exclude<GameType, 'cash'>;
  /** Same label as `HandRecord.limit` for tournaments ("0,25€", "Freeroll"). */
  limit: string;
  startTime: number;
  endTime: number;
  /** Total cost in € (buy-in + fee). */
  buyIn: number;
  /** Total € won (`You won`, 0 if absent). */
  winnings: number;
  /** winnings - buyIn. */
  net: number;
  position: number | null;
  players: number | null;
  finished: boolean;
  sourceFile: string;
}

export interface HandRecord {
  /** Winamax HandId (e.g. `22989145-288-1790794436`). */
  id: string;
  /** Epoch ms (UTC). */
  timestamp: number;
  table: string;
  game: string;
  gameType: GameType;
  /** Cash: "NL2", "PLO10"… ; tournaments: total buy-in ("1€", "Freeroll"). */
  limit: string;
  smallBlind: number;
  bigBlind: number;
  hero: string;
  heroCards: string[];
  /** Sum of hero's blinds, antes, calls, bets and raises (€ for cash, chips for tournaments). */
  invested: number;
  /** Sum of hero's `collected` / summary `won` amounts (net of rake, uncalled bets included). */
  collected: number;
  /** collected - invested. */
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
  heroPosition: Position | null;
  /** Winamax "Total pot" (rake included). */
  pot: number;
  endStreet: EndStreet;
  /** Hero preflop actions, one letter each: F fold, X check, C call, R raise (e.g. "RC"). */
  preflopActions: string;
  /** Hero open-raised first in from CO / BTN / SB. */
  steal: boolean;
  foldToThreeBet: boolean;
  /** Hero was all-in at some point of the hand (bet, raise, call or blind). */
  heroAllIn: boolean;
  sourceFile: string;
}
