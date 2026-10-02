import { prettyCard } from './cards';
import { buildPots } from './equity';
import { assignPositions } from './positions';
import type { Position } from './types';
import { parseAmount } from './winamax-parser';
import { formatStake } from '../utils';

export type ReplayStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type StepKind = 'init' | 'action' | 'street' | 'showdown' | 'payout';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';
/** `stake` = € in cash games, chips in tournaments. */
export type ReplayUnit = 'stake' | 'bb';

export function formatReplayAmount(value: number, hand: { isCash: boolean; bigBlind: number }, unit: ReplayUnit) {
  if (unit === 'stake' || hand.bigBlind <= 0) return formatStake(value, hand.isCash);
  return `${(Math.round((value / hand.bigBlind) * 10) / 10).toLocaleString('fr-FR')} bb`;
}

export interface ReplayerPlayer {
  seat: number;
  name: string;
  isHero: boolean;
  position: Position | null;
  isButton: boolean;
  /** `false` for seated players who were not dealt in (sitting out). */
  inHand: boolean;
  stack: number;
  /** Chips in front of the player for the current street. */
  bet: number;
  /** Visible hole cards (hero, or shown at showdown). `null` = face down. */
  cards: string[] | null;
  folded: boolean;
  allIn: boolean;
  lastAction: string | null;
  handDescription: string | null;
  won: number;
}

export interface ReplayerStep {
  index: number;
  kind: StepKind;
  street: ReplayStreet;
  players: ReplayerPlayer[];
  board: string[];
  /** Chips gathered in the middle (bets still in front of players excluded). */
  pot: number;
  /** Main pot then side pots; empty when there is a single pot. */
  pots: number[];
  /** Seat of the player who just acted. */
  activeSeat: number | null;
  action: ActionType | null;
  allIn: boolean;
  message: string;
}

export interface ReplayerHand {
  id: string;
  table: string;
  maxSeats: number;
  isCash: boolean;
  smallBlind: number;
  bigBlind: number;
  hero: string | null;
  steps: ReplayerStep[];
  /** First step of each street reached by the hand. */
  streetStarts: Partial<Record<ReplayStreet, number>>;
}

type HandEvent =
  | { type: 'post'; player: string; blind: 'sb' | 'bb' | 'ante' | 'straddle'; amount: number; allIn: boolean }
  | { type: 'action'; player: string; action: ActionType; amount: number; to: number; allIn: boolean }
  | { type: 'street'; street: 'flop' | 'turn' | 'river'; board: string[] }
  | { type: 'showdown' }
  | { type: 'show'; player: string; cards: string[]; description: string | null }
  | { type: 'collect'; player: string; amount: number };

const HEADER_RE = /^Winamax Poker - (.+?) - HandId: #([\w-]+) - (.+?) \(([^)]*)\)/;
const TABLE_RE = /^Table: '(.+?)'/;
const SEAT_RE = /^Seat (\d+): (.+) \(([\d.,]+)\s*€?[^)]*\)$/;
const DEALT_RE = /^Dealt to (.+?) \[([^\]]+)\]/;
const AMOUNT = '([\\d.,]+)\\s*€?';
const POST_RE = new RegExp(`^posts (small blind|big blind|ante|straddle) ${AMOUNT}`);
const ACTION_RES: [ActionType, RegExp][] = [
  ['fold', /^folds/],
  ['check', /^checks/],
  ['call', new RegExp(`^calls ${AMOUNT}`)],
  ['bet', new RegExp(`^bets ${AMOUNT}`)],
  ['raise', new RegExp(`^raises ${AMOUNT} to ${AMOUNT}`)],
];
const SHOW_RE = /^shows \[([^\]]+)\](?:\s*\((.+)\))?/;
const COLLECT_RE = new RegExp(`^collected ${AMOUNT}`);
const BLIND_KEYS = { 'small blind': 'sb', 'big blind': 'bb', ante: 'ante', straddle: 'straddle' } as const;

const round = (n: number) => Math.round(n * 10000) / 10000;
const splitCards = (text: string) => text.trim().split(/\s+/).filter(Boolean);
const boardOf = (line: string) => [...line.matchAll(/\[([^\]]+)\]/g)].flatMap((m) => splitCards(m[1]));
const prettyCards = (cards: string[]) => cards.map(prettyCard).join(' ');

interface ParsedHistory {
  id: string;
  table: string;
  maxSeats: number;
  buttonSeat: number;
  isCash: boolean;
  smallBlind: number;
  bigBlind: number;
  seats: { seat: number; name: string; stack: number }[];
  hero: string | null;
  heroCards: string[];
  events: HandEvent[];
  summaryWon: Map<string, number>;
}

function parseHistory(text: string): ParsedHistory | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = HEADER_RE.exec(lines[0] ?? '');
  if (!header) return null;
  const [, kind, id, , stakes] = header;
  const amounts = (stakes.match(/[\d.,]+/g) ?? []).map(parseAmount);
  const blinds = amounts.length > 2 ? [...amounts].sort((a, b) => b - a).slice(0, 2).reverse() : amounts;

  const parsed: ParsedHistory = {
    id,
    table: '',
    maxSeats: 0,
    buttonSeat: 0,
    isCash: !/tournament|expresso/i.test(kind),
    smallBlind: blinds[0] ?? 0,
    bigBlind: blinds[1] ?? blinds[0] ?? 0,
    seats: [],
    hero: null,
    heroCards: [],
    events: [],
    summaryWon: new Map(),
  };
  const summaryShown = new Map<string, { cards: string[]; description: string | null }>();
  let names: string[] = [];
  let inSummary = false;

  for (const line of lines.slice(1)) {
    if (line.startsWith('*** ')) {
      if (line.startsWith('*** ANTE/BLINDS')) names = parsed.seats.map((s) => s.name).sort((a, b) => b.length - a.length);
      else if (line.startsWith('*** FLOP')) parsed.events.push({ type: 'street', street: 'flop', board: boardOf(line) });
      else if (line.startsWith('*** TURN')) parsed.events.push({ type: 'street', street: 'turn', board: boardOf(line) });
      else if (line.startsWith('*** RIVER')) parsed.events.push({ type: 'street', street: 'river', board: boardOf(line) });
      else if (line.startsWith('*** SHOW DOWN')) parsed.events.push({ type: 'showdown' });
      else if (line.startsWith('*** SUMMARY')) inSummary = true;
      continue;
    }

    if (!names.length) {
      const table = TABLE_RE.exec(line);
      if (table) {
        parsed.table = table[1];
        parsed.maxSeats = +(/(\d+)-max/.exec(line)?.[1] ?? 0);
        parsed.buttonSeat = +(/Seat #(\d+) is the button/.exec(line)?.[1] ?? 0);
      }
      const seat = SEAT_RE.exec(line);
      if (seat) parsed.seats.push({ seat: +seat[1], name: seat[2], stack: parseAmount(seat[3]) });
      continue;
    }

    if (inSummary) {
      const seatLine = /^Seat \d+: (.+)$/.exec(line);
      const name = seatLine && names.find((n) => seatLine[1].startsWith(n + ' ') || seatLine[1] === n);
      if (!seatLine || !name) continue;
      const showed = /showed \[([^\]]+)\](?: and (?:won|lost)[^w]*with (.+))?/.exec(seatLine[1]);
      if (showed) summaryShown.set(name, { cards: splitCards(showed[1]), description: showed[2]?.trim() ?? null });
      const won = /\bwon ([\d.,]+)/.exec(seatLine[1]);
      if (won) parsed.summaryWon.set(name, (parsed.summaryWon.get(name) ?? 0) + parseAmount(won[1]));
      continue;
    }

    const dealt = DEALT_RE.exec(line);
    if (dealt) {
      parsed.hero = dealt[1];
      parsed.heroCards = splitCards(dealt[2]);
      continue;
    }

    const player = names.find((n) => line.startsWith(n + ' '));
    if (!player) continue;
    const rest = line.slice(player.length + 1);
    const allIn = /and is all-in/.test(rest);

    const post = POST_RE.exec(rest);
    if (post) {
      const blind = BLIND_KEYS[post[1] as keyof typeof BLIND_KEYS];
      parsed.events.push({ type: 'post', player, blind, amount: parseAmount(post[2]), allIn });
      continue;
    }
    const action = ACTION_RES.find(([, re]) => re.test(rest));
    if (action) {
      const m = action[1].exec(rest)!;
      const amount = m[1] ? parseAmount(m[1]) : 0;
      const to = m[2] ? parseAmount(m[2]) : amount;
      parsed.events.push({ type: 'action', player, action: action[0], amount, to, allIn });
      continue;
    }
    const show = SHOW_RE.exec(rest);
    if (show) {
      parsed.events.push({ type: 'show', player, cards: splitCards(show[1]), description: show[2]?.trim() ?? null });
      continue;
    }
    const collect = COLLECT_RE.exec(rest);
    if (collect) parsed.events.push({ type: 'collect', player, amount: parseAmount(collect[1]) });
  }

  // Cards only listed in the summary are revealed with the other showdown hands.
  const showdownAt = parsed.events.findIndex((e) => e.type === 'showdown');
  if (showdownAt >= 0) {
    const alreadyShown = new Set(parsed.events.flatMap((e) => (e.type === 'show' ? [e.player] : [])));
    const extra: HandEvent[] = [...summaryShown]
      .filter(([name]) => !alreadyShown.has(name))
      .map(([player, s]) => ({ type: 'show', player, cards: s.cards, description: s.description }));
    parsed.events.splice(showdownAt + 1, 0, ...extra);
  }

  parsed.maxSeats = Math.max(parsed.maxSeats, ...parsed.seats.map((s) => s.seat), 2);
  return parsed;
}

const STREET_LABELS: Record<'flop' | 'turn' | 'river', string> = { flop: 'Flop', turn: 'Turn', river: 'River' };

/** Converts a raw Winamax hand history into the chronological states of the replayer. */
export function buildReplay(text: string, unit: ReplayUnit = 'stake'): ReplayerHand | null {
  const h = parseHistory(text);
  if (!h || !h.seats.length) return null;
  const fmt = (v: number) => formatReplayAmount(v, h, unit);

  const participants = new Set(h.events.flatMap((e) => ('player' in e ? [e.player] : [])));
  if (h.hero) participants.add(h.hero);
  const posts = h.events.filter((e) => e.type === 'post');
  const positions = assignPositions(
    h.seats.filter((s) => participants.has(s.name)),
    h.buttonSeat,
    posts.find((e) => e.blind === 'sb')?.player,
    posts.find((e) => e.blind === 'bb')?.player,
  );

  const players: ReplayerPlayer[] = h.seats.map((s) => ({
    seat: s.seat,
    name: s.name,
    isHero: s.name === h.hero,
    position: positions.get(s.name) ?? null,
    isButton: s.seat === h.buttonSeat,
    inHand: participants.has(s.name),
    stack: s.stack,
    bet: 0,
    cards: s.name === h.hero && h.heroCards.length ? [...h.heroCards] : null,
    folded: false,
    allIn: false,
    lastAction: null,
    handDescription: null,
    won: 0,
  }));
  const byName = new Map(players.map((p) => [p.name, p]));
  const contributed = new Map<string, number>();

  let pot = 0;
  let board: string[] = [];
  let street: ReplayStreet = 'preflop';
  const steps: ReplayerStep[] = [];
  const streetStarts: ReplayerHand['streetStarts'] = { preflop: 0 };

  const put = (p: ReplayerPlayer, amount: number, inFront = true) => {
    const chips = Math.max(0, Math.min(amount, p.stack));
    p.stack = round(p.stack - chips);
    if (inFront) p.bet = round(p.bet + chips);
    else pot = round(pot + chips);
    contributed.set(p.name, round((contributed.get(p.name) ?? 0) + chips));
    if (p.stack <= 0) p.allIn = true;
  };

  const gatherBets = () => {
    for (const p of players) {
      pot = round(pot + p.bet);
      p.bet = 0;
    }
  };

  const sidePots = (): number[] => {
    if (!players.some((p) => p.allIn)) return [];
    const pots = buildPots(
      players.map((p) => round((contributed.get(p.name) ?? 0) - p.bet)),
      players.map((p) => p.folded || !p.inHand),
    );
    const merged: { amount: number; key: string }[] = [];
    for (const sp of pots) {
      const key = sp.eligible.join(',');
      const last = merged[merged.length - 1];
      if (last && last.key === key) last.amount += sp.amount;
      else merged.push({ amount: sp.amount, key });
    }
    const contested = merged.filter((p) => p.key.includes(','));
    return contested.length > 1 ? contested.map((p) => round(p.amount)) : [];
  };

  const snapshot = (
    kind: StepKind,
    message: string,
    activeSeat: number | null = null,
    action: ActionType | null = null,
    allIn = false,
  ) => {
    steps.push({
      index: steps.length,
      kind,
      street,
      players: players.map((p) => ({ ...p, cards: p.cards ? [...p.cards] : null })),
      board: [...board],
      pot,
      pots: sidePots(),
      activeSeat,
      action,
      allIn,
      message,
    });
  };

  // Step 0: seats, button, antes in the middle, blinds in front of the players, hero cards.
  for (const e of posts) {
    const p = byName.get(e.player)!;
    put(p, e.amount, e.blind !== 'ante');
    if (e.allIn) p.allIn = true;
  }
  const heroText = h.hero && h.heroCards.length ? ` — ${h.hero} reçoit ${prettyCards(h.heroCards)}` : '';
  snapshot('init', `Blindes ${fmt(h.smallBlind)} / ${fmt(h.bigBlind)}${heroText}`);

  let showdownPending = false;
  const flushShowdown = () => {
    if (!showdownPending) return;
    showdownPending = false;
    streetStarts.showdown = steps.length;
    const shown = players.filter((p) => p.cards && !p.folded && p.inHand);
    snapshot('showdown', shown.length ? `Abattage : ${shown.map((p) => `${p.name} ${prettyCards(p.cards!)}`).join(' · ')}` : 'Abattage');
  };

  for (const e of h.events) {
    if (e.type === 'post') continue;
    if (e.type !== 'show') flushShowdown();
    switch (e.type) {
      case 'action': {
        const p = byName.get(e.player)!;
        let message = '';
        switch (e.action) {
          case 'fold':
            p.folded = true;
            if (!p.isHero) p.cards = null;
            p.lastAction = 'Fold';
            message = `${p.name} se couche`;
            break;
          case 'check':
            p.lastAction = 'Check';
            message = `${p.name} checke`;
            break;
          case 'call':
            put(p, e.amount);
            p.lastAction = 'Call';
            message = `${p.name} suit ${fmt(e.amount)}`;
            break;
          case 'bet':
            put(p, e.amount);
            p.lastAction = 'Mise';
            message = `${p.name} mise ${fmt(e.amount)}`;
            break;
          case 'raise':
            put(p, e.to - p.bet);
            p.lastAction = 'Relance';
            message = `${p.name} relance à ${fmt(e.to)}`;
            break;
        }
        if (e.allIn) {
          p.allIn = true;
          p.lastAction = 'All-in';
          message += ' (tapis)';
        }
        snapshot('action', message, p.seat, e.action, e.allIn);
        break;
      }
      case 'street':
        gatherBets();
        board = e.board;
        street = e.street;
        for (const p of players) if (!p.folded) p.lastAction = p.allIn ? 'All-in' : null;
        streetStarts[e.street] = steps.length;
        snapshot('street', `${STREET_LABELS[e.street]} : ${prettyCards(board)}`);
        break;
      case 'showdown':
        gatherBets();
        street = 'showdown';
        showdownPending = true;
        for (const p of players) if (!p.folded) p.lastAction = null;
        break;
      case 'show': {
        const p = byName.get(e.player)!;
        p.cards = e.cards;
        p.handDescription = e.description;
        break;
      }
      case 'collect':
        break;
    }
  }
  flushShowdown();

  const collects = h.events.filter((e) => e.type === 'collect');
  const winnings = new Map<string, number>();
  for (const c of collects) winnings.set(c.player, round((winnings.get(c.player) ?? 0) + c.amount));
  if (!winnings.size) for (const [name, amount] of h.summaryWon) winnings.set(name, amount);

  if (winnings.size) {
    gatherBets();
    for (const [name, amount] of winnings) {
      const p = byName.get(name);
      if (!p) continue;
      p.stack = round(p.stack + amount);
      p.won = amount;
    }
    pot = 0;
    for (const p of players) p.allIn = p.allIn && p.stack <= 0;
    const message = [...winnings]
      .map(([name, amount]) => {
        const desc = byName.get(name)?.handDescription;
        return `${name} remporte ${fmt(amount)}${desc ? ` avec ${desc}` : ''}`;
      })
      .join(' · ');
    snapshot('payout', message);
  }

  return {
    id: h.id,
    table: h.table,
    maxSeats: h.maxSeats,
    isCash: h.isCash,
    smallBlind: h.smallBlind,
    bigBlind: h.bigBlind,
    hero: h.hero,
    steps,
    streetStarts,
  };
}
