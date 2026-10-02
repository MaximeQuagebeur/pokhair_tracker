/** Card encoding: rank (0 = deuce … 12 = ace) * 4 + suit (0..3). */
const RANKS = '23456789TJQKA';
const SUITS = 'cdhs';

export function parseCard(token: string): number {
  const rank = RANKS.indexOf(token[0]?.toUpperCase());
  const suit = SUITS.indexOf(token[1]?.toLowerCase());
  if (rank < 0 || suit < 0 || token.length !== 2) throw new Error(`Carte invalide : ${token}`);
  return rank * 4 + suit;
}

export function parseCards(text: string): number[] {
  return text.trim().split(/\s+/).filter(Boolean).map(parseCard);
}

export function cardToString(card: number): string {
  return RANKS[card >> 2] + SUITS[card & 3];
}

function straightHigh(rankMask: number): number {
  // Bit 0 = ace-low, bit r+1 = rank r.
  const ext = (rankMask << 1) | ((rankMask >> 12) & 1);
  for (let hi = 12; hi >= 3; hi--) {
    const need = 0x1f << (hi - 3);
    if ((ext & need) === need) return hi;
  }
  return -1;
}

function topRanks(rankMask: number, count: number): number {
  let packed = 0;
  let taken = 0;
  for (let r = 12; r >= 0 && taken < count; r--) {
    if (rankMask & (1 << r)) {
      packed = (packed << 4) | r;
      taken++;
    }
  }
  return packed << (4 * (5 - count));
}

const counts = new Int8Array(13);
const suitMasks = new Int32Array(4);
const suitCounts = new Int8Array(4);

/** Scores the best 5-card hand among 5-7 cards. Higher is better. */
export function evaluate(cards: ArrayLike<number>): number {
  counts.fill(0);
  suitMasks.fill(0);
  suitCounts.fill(0);
  let rankMask = 0;
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i] >> 2;
    const s = cards[i] & 3;
    counts[r]++;
    suitMasks[s] |= 1 << r;
    suitCounts[s]++;
    rankMask |= 1 << r;
  }

  let flushMask = 0;
  for (let s = 0; s < 4; s++) if (suitCounts[s] >= 5) flushMask = suitMasks[s];
  if (flushMask) {
    const sf = straightHigh(flushMask);
    if (sf >= 0) return (8 << 20) | (sf << 16);
  }

  let quad = -1;
  let trip = -1;
  let trip2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const c = counts[r];
    if (c === 4) quad = r;
    else if (c === 3) {
      if (trip < 0) trip = r;
      else if (trip2 < 0) trip2 = r;
    } else if (c === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }

  if (quad >= 0) {
    const kicker = topRanks(rankMask & ~(1 << quad), 1) >> 16;
    return (7 << 20) | (quad << 16) | (kicker << 12);
  }
  if (trip >= 0 && (trip2 >= 0 || pair1 >= 0)) {
    const pair = Math.max(trip2, pair1);
    return (6 << 20) | (trip << 16) | (pair << 12);
  }
  if (flushMask) return (5 << 20) | topRanks(flushMask, 5);
  const st = straightHigh(rankMask);
  if (st >= 0) return (4 << 20) | (st << 16);
  if (trip >= 0) {
    return (3 << 20) | (trip << 16) | (topRanks(rankMask & ~(1 << trip), 2) >> 4);
  }
  if (pair1 >= 0 && pair2 >= 0) {
    const kicker = topRanks(rankMask & ~(1 << pair1) & ~(1 << pair2), 1) >> 16;
    return (2 << 20) | (pair1 << 16) | (pair2 << 12) | (kicker << 8);
  }
  if (pair1 >= 0) {
    return (1 << 20) | (pair1 << 16) | (topRanks(rankMask & ~(1 << pair1), 3) >> 4);
  }
  return topRanks(rankMask, 5);
}
