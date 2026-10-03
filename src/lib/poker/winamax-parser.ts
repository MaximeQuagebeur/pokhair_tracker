import { parseCards } from './cards';
import { buildPots, expectedWinnings } from './equity';
import { assignPositions, STEAL_POSITIONS } from './positions';
import type { EndStreet, GameType, HandRecord, HandText, TournamentRecord } from './types';

type Street = 'blinds' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'summary';

const HEADER_RE =
  /^Winamax Poker - (.+?) - HandId: #([\w-]+) - (.+?) \(([^)]*)\) - (\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/;
const TABLE_RE = /^Table: '(.+?)'/;
const BUTTON_RE = /Seat #(\d+) is the button/;
const SEAT_RE = /^Seat (\d+): (.+) \([\d.,]+\s*€?[^)]*\)$/;
const DEALT_RE = /^Dealt to (.+?) \[([^\]]+)\]/;
const CARDS_GROUP_RE = /\[([^\]]+)\]/g;
const AMOUNT = '([\\d.,]+)\\s*€?';
const ACTION_RES: [string, RegExp][] = [
  ['sb', new RegExp(`^posts small blind ${AMOUNT}`)],
  ['bb', new RegExp(`^posts big blind ${AMOUNT}`)],
  ['ante', new RegExp(`^posts ante ${AMOUNT}`)],
  ['straddle', new RegExp(`^posts straddle ${AMOUNT}`)],
  ['fold', /^folds/],
  ['check', /^checks/],
  ['call', new RegExp(`^calls ${AMOUNT}`)],
  ['bet', new RegExp(`^bets ${AMOUNT}`)],
  ['raise', new RegExp(`^raises ${AMOUNT} to ${AMOUNT}`)],
  ['show', /^shows \[([^\]]+)\]/],
  ['collect', new RegExp(`^collected ${AMOUNT}`)],
];
const PREFLOP_LETTERS: Record<string, string> = { fold: 'F', check: 'X', call: 'C', raise: 'R' };

export function parseAmount(raw: string): number {
  const normalized = raw.includes('.') ? raw.replace(/,/g, '') : raw.replace(',', '.');
  return Number.parseFloat(normalized) || 0;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

function detectGameType(kind: string): GameType {
  if (/expresso/i.test(kind)) return 'expresso';
  if (/tournament/i.test(kind)) return 'tournament';
  return 'cash';
}

function formatEuro(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace('.', ',')}€`;
}

const sumEuros = (text: string) =>
  (text.match(/[\d.,]+(?=\s*€)/g) ?? []).map(parseAmount).reduce((a, b) => a + b, 0);

/** Tournament "limit" label shared by hands and summaries: total buy-in ("0,25€", "Freeroll"). */
function buyInLabel(total: number): string {
  return total > 0 ? formatEuro(Math.round(total * 100) / 100) : 'Freeroll';
}

/** Cash: "NL2", "PLO10"… ; tournaments: total buy-in ("1€", "Freeroll"). */
function detectLimit(gameType: GameType, kind: string, game: string, bigBlind: number): string {
  if (gameType !== 'cash') {
    const buyIn = /buyIn:\s*(.+?)(?:\s+level:|$)/i.exec(kind)?.[1] ?? '';
    return buyInLabel((buyIn.match(/[\d.,]+/g) ?? []).map(parseAmount).reduce((a, b) => a + b, 0));
  }
  const structure = /pot limit/i.test(game) ? 'PL' : /fixed limit/i.test(game) ? 'FL' : 'NL';
  const variant = /omaha\s*5/i.test(game) ? 'O5' : /omaha/i.test(game) ? 'O' : '';
  return `${structure}${variant}${Math.round(bigBlind * 100)}`;
}

const SUMMARY_PREFIX = 'Winamax Poker - Tournament summary';

export function parseTournamentSummary(block: string, sourceFile = ''): TournamentRecord | null {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const head = /^Winamax Poker - Tournament summary : (.+)\((\d+)\)/.exec(lines[0]);
  if (!head) return null;
  const find = (re: RegExp) => lines.map((l) => re.exec(l)).find(Boolean) ?? null;

  const name = head[1].trim();
  const buyInText = find(/^Buy-In\s*:\s*(.+)$/i)?.[1] ?? '';
  // Play-money summaries list amounts without "€" (freerolls still show "0€ + 0€").
  if (/\d/.test(buyInText) && !buyInText.includes('€')) return null;
  const buyIn = Math.round(sumEuros(buyInText) * 100) / 100;
  const started = find(/^Tournament started (\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/i);
  const startTime = started
    ? Date.UTC(+started[1], +started[2] - 1, +started[3], +started[4], +started[5], +started[6])
    : 0;
  const played = find(/^You played (.+)$/i)?.[1] ?? '';
  const duration =
    (+(/(\d+)\s*h/.exec(played)?.[1] ?? 0) * 3600 +
      +(/(\d+)\s*min/.exec(played)?.[1] ?? 0) * 60 +
      +(/(\d+)\s*s\b/.exec(played)?.[1] ?? 0)) *
    1000;
  const position = find(/^You finished in (\d+)/i);
  const won = find(/^You won\s*:?\s*(.+)$/i);
  const players = find(/^Registered players\s*:\s*(\d+)/i);
  const winnings = won ? Math.round(sumEuros(won[1]) * 100) / 100 : 0;

  return {
    id: head[2],
    name,
    gameType: /expresso/i.test(name) ? 'expresso' : 'tournament',
    limit: buyInLabel(buyIn),
    startTime,
    endTime: startTime + duration,
    buyIn,
    winnings,
    net: Math.round((winnings - buyIn) * 100) / 100,
    position: position ? +position[1] : null,
    players: players ? +players[1] : null,
    finished: !!position || !!won,
    sourceFile,
  };
}

export interface ParseResult {
  hands: HandRecord[];
  texts: HandText[];
  tournaments: TournamentRecord[];
  errors: { handId?: string; message: string }[];
}

export function parseWinamaxFile(text: string, sourceFile: string): ParseResult {
  const result: ParseResult = { hands: [], texts: [], tournaments: [], errors: [] };
  const blocks = text.replace(/^\uFEFF/, '').split(/^(?=Winamax Poker - )/m);
  for (const block of blocks) {
    if (!block.startsWith('Winamax Poker - ')) continue;
    try {
      if (block.startsWith(SUMMARY_PREFIX)) {
        const tournament = parseTournamentSummary(block, sourceFile);
        if (tournament) result.tournaments.push(tournament);
        continue;
      }
      const hand = parseHand(block, sourceFile);
      if (hand) {
        result.hands.push(hand);
        result.texts.push({ id: hand.id, text: block.trim() });
      }
    } catch (err) {
      result.errors.push({ handId: HEADER_RE.exec(block)?.[2], message: (err as Error).message });
    }
  }
  return result;
}

function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

export function parseHand(block: string, sourceFile = ''): HandRecord | null {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = HEADER_RE.exec(lines[0]);
  if (!header) return null;

  const [, kind, id, game, stakes, y, mo, d, h, mi, s] = header;
  const gameType = detectGameType(kind);
  const amounts = (stakes.match(/[\d.,]+/g) ?? []).map(parseAmount);
  // Tournaments with ante list three values (ante/sb/bb): the two largest are the blinds.
  const blinds = amounts.length > 2 ? [...amounts].sort((a, b) => b - a).slice(0, 2).reverse() : amounts;
  const bigBlind = blinds[1] ?? blinds[0] ?? 0;
  const timestamp = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);

  let table = '';
  let buttonSeat = 0;
  const seated: string[] = [];
  const seatNumbers = new Map<string, number>();
  let smallBlindPlayer: string | undefined;
  let bigBlindPlayer: string | undefined;
  let totalPot: number | null = null;
  let endStreet: EndStreet = 'preflop';
  let preflopActions = '';
  let preflopCalls = 0;
  let heroOpenedFirstIn = false;
  let heroOpenRaised = false;
  let foldToThreeBet = false;
  const participants = new Set<string>();
  const contrib = new Map<string, number>();
  let streetContrib = new Map<string, number>();
  const collected = new Map<string, number>();
  const summaryWon = new Map<string, number>();
  const shown = new Map<string, number[]>();
  const folded = new Set<string>();
  const allIn = new Set<string>();
  let board: number[] = [];
  let street = 'blinds' as Street;
  let hero = '';
  let heroCards: number[] = [];
  let heroCardsRaw: string[] = [];
  let rake = 0;
  let hadShowdown = false;
  let heroFoldedPreflop = false;
  let allInBoard: number[] | null = null;

  let preflopRaises = 0;
  let lastRaiser = '';
  const stats = {
    vpip: false,
    pfr: false,
    threeBetOpportunity: false,
    threeBet: false,
    postflopBets: 0,
    postflopRaises: 0,
    postflopCalls: 0,
  };

  const closeStreet = () => {
    if (street === 'blinds' || street === 'showdown' || street === 'summary') return;
    if (street !== 'river' && !allInBoard && hero) {
      const active = [...participants].filter((p) => !folded.has(p));
      const notAllIn = active.filter((p) => !allIn.has(p));
      if (active.length >= 2 && active.includes(hero) && notAllIn.length <= 1 && notAllIn.length < active.length) {
        allInBoard = [...board];
      }
    }
  };

  const enterStreet = (next: Street, line: string) => {
    closeStreet();
    if (next === 'flop' || next === 'turn' || next === 'river') {
      streetContrib = new Map();
      board = [...line.matchAll(CARDS_GROUP_RE)].flatMap((m) => parseCards(m[1]));
    }
    if (next === 'showdown') hadShowdown = true;
    if (next === 'flop' || next === 'turn' || next === 'river' || next === 'showdown') endStreet = next;
    street = next;
  };

  const namesByLength = () => [...seated].sort((a, b) => b.length - a.length);
  let sortedNames: string[] = [];

  for (const line of lines.slice(1)) {
    if (line.startsWith('*** ')) {
      if (line.startsWith('*** ANTE/BLINDS')) {
        street = 'blinds';
        sortedNames = namesByLength();
      } else if (line.startsWith('*** PRE-FLOP')) enterStreet('preflop', line);
      else if (line.startsWith('*** FLOP')) enterStreet('flop', line);
      else if (line.startsWith('*** TURN')) enterStreet('turn', line);
      else if (line.startsWith('*** RIVER')) enterStreet('river', line);
      else if (line.startsWith('*** SHOW DOWN')) enterStreet('showdown', line);
      else if (line.startsWith('*** SUMMARY')) enterStreet('summary', line);
      continue;
    }

    if (!sortedNames.length) {
      if (/^Table: .*\(play money\)/i.test(line)) return null;
      const t = TABLE_RE.exec(line);
      if (t) {
        table = t[1];
        buttonSeat = +(BUTTON_RE.exec(line)?.[1] ?? 0);
      }
      const seat = SEAT_RE.exec(line);
      if (seat) {
        seated.push(seat[2]);
        seatNumbers.set(seat[2], +seat[1]);
      }
      continue;
    }

    if (street === 'summary') {
      const pot = /^Total pot ([\d.,]+)\s*€?\s*\|\s*(?:Rake ([\d.,]+)|No rake)/i.exec(line);
      if (pot) {
        totalPot = parseAmount(pot[1]);
        rake = pot[2] ? parseAmount(pot[2]) : 0;
      }
      const seatLine = /^Seat \d+: (.+)$/.exec(line);
      if (seatLine) {
        const name = sortedNames.find((n) => seatLine[1].startsWith(n + ' ') || seatLine[1] === n);
        if (name) {
          const showed = /showed \[([^\]]+)\]/.exec(seatLine[1]);
          if (showed && !shown.has(name)) shown.set(name, parseCards(showed[1]));
          const won = /\bwon ([\d.,]+)/.exec(seatLine[1]);
          if (won) add(summaryWon, name, parseAmount(won[1]));
        }
      }
      continue;
    }

    const dealt = DEALT_RE.exec(line);
    if (dealt) {
      hero = dealt[1];
      heroCardsRaw = dealt[2].trim().split(/\s+/);
      heroCards = parseCards(dealt[2]);
      continue;
    }

    const player = sortedNames.find((n) => line.startsWith(n + ' '));
    if (!player) continue;
    const rest = line.slice(player.length + 1);
    const matched = ACTION_RES.find(([, re]) => re.test(rest));
    if (!matched) continue;
    const [kind, re] = matched;
    const m = re.exec(rest)!;
    const isHero = player === hero;
    const preflop = street === 'preflop' || street === 'blinds';

    if (kind !== 'show' && kind !== 'collect') participants.add(player);
    if (/and is all-in/.test(rest)) allIn.add(player);

    if (isHero && street === 'preflop' && ['fold', 'check', 'call', 'raise'].includes(kind)) {
      if (preflopRaises === 1 && lastRaiser !== hero && !stats.threeBetOpportunity) {
        stats.threeBetOpportunity = true;
        if (kind === 'raise') stats.threeBet = true;
      }
      if (heroOpenRaised && preflopRaises === 2 && lastRaiser !== hero && kind === 'fold') foldToThreeBet = true;
      if (kind === 'raise' && preflopRaises === 0) {
        heroOpenRaised = true;
        heroOpenedFirstIn = !preflopActions && preflopCalls === 0;
      }
      preflopActions += PREFLOP_LETTERS[kind];
    }

    switch (kind) {
      case 'sb':
      case 'bb':
      case 'straddle': {
        const amount = parseAmount(m[1]);
        add(contrib, player, amount);
        add(streetContrib, player, amount);
        if (kind === 'sb') smallBlindPlayer ??= player;
        if (kind === 'bb') bigBlindPlayer ??= player;
        break;
      }
      case 'ante':
        add(contrib, player, parseAmount(m[1]));
        break;
      case 'fold':
        folded.add(player);
        if (isHero && preflop) heroFoldedPreflop = true;
        break;
      case 'call':
      case 'bet': {
        const amount = parseAmount(m[1]);
        add(contrib, player, amount);
        add(streetContrib, player, amount);
        if (kind === 'call' && preflop) preflopCalls++;
        if (isHero) {
          if (preflop) stats.vpip = true;
          else if (kind === 'call') stats.postflopCalls++;
          else stats.postflopBets++;
        }
        break;
      }
      case 'raise': {
        const to = parseAmount(m[2]);
        const delta = to - (streetContrib.get(player) ?? 0);
        add(contrib, player, delta);
        streetContrib.set(player, to);
        if (preflop) {
          preflopRaises++;
          lastRaiser = player;
          if (isHero) stats.vpip = stats.pfr = true;
        } else if (isHero) stats.postflopRaises++;
        break;
      }
      case 'show':
        shown.set(player, parseCards(m[1]));
        break;
      case 'collect':
        add(collected, player, parseAmount(m[1]));
        break;
    }
  }

  if (street !== 'summary') closeStreet();
  if (!hero || !participants.has(hero)) return null;

  // Winamax "collected" / "won" amounts are net of rake and already include uncalled bets returned.
  const winnings = collected.size ? collected : summaryWon;
  const invested = (p: string) => contrib.get(p) ?? 0;

  const heroInvested = round(invested(hero));
  const heroCollected = round(winnings.get(hero) ?? 0);
  const net = round(heroCollected - heroInvested);
  const showdown = hadShowdown && !folded.has(hero);
  const positions = assignPositions(
    seated.filter((p) => participants.has(p)).map((name) => ({ name, seat: seatNumbers.get(name) ?? 0 })),
    buttonSeat,
    smallBlindPlayer,
    bigBlindPlayer,
  );
  const heroPosition = positions.get(hero) ?? null;

  let allInEv = net;
  let allInAdjusted = false;
  if (allInBoard && heroCards.length === 2) {
    const players = [...participants];
    const active = players.filter((p) => !folded.has(p));
    const holeCards = active.map((p) => (p === hero ? heroCards : shown.get(p)));
    if (holeCards.every((c) => c?.length === 2)) {
      const contributions = players.map(invested);
      const pots = buildPots(contributions, players.map((p) => folded.has(p))).map((pot) => ({
        amount: pot.amount,
        eligible: pot.eligible.map((i) => active.indexOf(players[i])),
      }));
      const potTotal = contributions.reduce((a, b) => a + b, 0);
      const rakeFactor = potTotal > 0 ? Math.max(0, potTotal - rake) / potTotal : 1;
      const seed = [...id].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7);
      const expected = expectedWinnings(holeCards as number[][], allInBoard, pots, active.indexOf(hero), seed);
      allInEv = round(expected * rakeFactor - heroInvested);
      allInAdjusted = true;
    }
  }

  return {
    id,
    timestamp,
    table,
    game,
    gameType,
    limit: detectLimit(gameType, kind, game, bigBlind),
    smallBlind: blinds[0] ?? 0,
    bigBlind,
    hero,
    heroCards: heroCardsRaw,
    invested: heroInvested,
    collected: heroCollected,
    net,
    allInEv,
    allInAdjusted,
    rake,
    showdown,
    wonAtShowdown: showdown && (winnings.get(hero) ?? 0) > 0,
    sawFlop: board.length >= 3 && !heroFoldedPreflop,
    ...stats,
    heroPosition,
    pot: round(totalPot ?? [...contrib.values()].reduce((a, b) => a + b, 0)),
    endStreet,
    preflopActions,
    steal: heroOpenedFirstIn && !!heroPosition && STEAL_POSITIONS.includes(heroPosition),
    foldToThreeBet,
    heroAllIn: allIn.has(hero),
    sourceFile,
  };
}
