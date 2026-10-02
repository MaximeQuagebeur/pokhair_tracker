import { evaluate } from './cards';

export interface Pot {
  amount: number;
  /** Indexes into the `hands` array of players eligible to win this pot. */
  eligible: number[];
}

const MONTE_CARLO_SAMPLES = 20000;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Expected amount `heroIdx` wins from `pots` once the board is completed.
 * Exhaustive enumeration when ≤ 2 cards remain, seeded Monte Carlo otherwise (deterministic results).
 */
export function expectedWinnings(hands: number[][], board: number[], pots: Pot[], heroIdx: number, seed = 1): number {
  const used = new Set<number>([...board, ...hands.flat()]);
  const deck: number[] = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);
  const missing = 5 - board.length;

  const full = new Array<number>(7);
  for (let i = 0; i < board.length; i++) full[2 + i] = board[i];
  const scores = new Array<number>(hands.length);

  let total = 0;
  let runs = 0;
  const scoreRunout = (extra: number[]) => {
    for (let i = 0; i < extra.length; i++) full[2 + board.length + i] = extra[i];
    for (let p = 0; p < hands.length; p++) {
      full[0] = hands[p][0];
      full[1] = hands[p][1];
      scores[p] = evaluate(full);
    }
    for (const pot of pots) {
      if (!pot.eligible.includes(heroIdx)) continue;
      let best = -1;
      let winners = 0;
      for (const p of pot.eligible) {
        if (scores[p] > best) {
          best = scores[p];
          winners = 1;
        } else if (scores[p] === best) winners++;
      }
      if (scores[heroIdx] === best) total += pot.amount / winners;
    }
    runs++;
  };

  if (missing === 0) scoreRunout([]);
  else if (missing === 1) for (const a of deck) scoreRunout([a]);
  else if (missing === 2) {
    for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) scoreRunout([deck[i], deck[j]]);
  } else {
    const rand = mulberry32(seed);
    const work = deck.slice();
    const extra = new Array<number>(missing);
    for (let s = 0; s < MONTE_CARLO_SAMPLES; s++) {
      for (let k = 0; k < missing; k++) {
        const j = k + Math.floor(rand() * (work.length - k));
        const tmp = work[k];
        work[k] = work[j];
        work[j] = tmp;
        extra[k] = work[k];
      }
      scoreRunout(extra);
    }
  }
  return runs ? total / runs : 0;
}

/** Splits contributions into main / side pots. Folded players contribute but are not eligible. */
export function buildPots(contributions: number[], folded: boolean[]): Pot[] {
  const levels = [...new Set(contributions.filter((c) => c > 0))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    const eligible: number[] = [];
    contributions.forEach((c, i) => {
      amount += Math.max(0, Math.min(c, level) - prev);
      if (c >= level && !folded[i]) eligible.push(i);
    });
    if (eligible.length === 0 && pots.length) pots[pots.length - 1].amount += amount;
    else if (amount > 0) pots.push({ amount, eligible });
    prev = level;
  }
  return pots;
}
