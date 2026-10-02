import type { HandRecord } from './types';

export type Unit = 'eur' | 'bb';

export interface DashboardStats {
  hands: number;
  net: number;
  netBB: number;
  allInEv: number;
  /** bb/100 */
  winrate: number;
  evWinrate: number;
  vpip: number;
  pfr: number;
  threeBet: number | null;
  af: number | null;
  wtsd: number | null;
  wsd: number | null;
}

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);

/** Tournament amounts are chips: they count in BB but never in €. */
export const isMoneyHand = (h: HandRecord) => h.gameType === 'cash';

export function computeStats(hands: HandRecord[]): DashboardStats {
  let net = 0;
  let netBB = 0;
  let ev = 0;
  let evBB = 0;
  let vpip = 0;
  let pfr = 0;
  let threeBet = 0;
  let threeBetOpp = 0;
  let aggressive = 0;
  let calls = 0;
  let sawFlop = 0;
  let showdowns = 0;
  let wonSd = 0;

  for (const h of hands) {
    if (isMoneyHand(h)) {
      net += h.net;
      ev += h.allInEv;
    }
    if (h.bigBlind > 0) {
      netBB += h.net / h.bigBlind;
      evBB += h.allInEv / h.bigBlind;
    }
    if (h.vpip) vpip++;
    if (h.pfr) pfr++;
    if (h.threeBetOpportunity) threeBetOpp++;
    if (h.threeBet) threeBet++;
    aggressive += h.postflopBets + h.postflopRaises;
    calls += h.postflopCalls;
    if (h.sawFlop) sawFlop++;
    if (h.showdown) showdowns++;
    if (h.wonAtShowdown) wonSd++;
  }

  const n = hands.length;
  return {
    hands: n,
    net,
    netBB,
    allInEv: ev,
    winrate: n ? netBB / (n / 100) : 0,
    evWinrate: n ? evBB / (n / 100) : 0,
    vpip: pct(vpip, n) ?? 0,
    pfr: pct(pfr, n) ?? 0,
    threeBet: pct(threeBet, threeBetOpp),
    af: calls > 0 ? aggressive / calls : null,
    wtsd: pct(showdowns, sawFlop),
    wsd: pct(wonSd, showdowns),
  };
}

export interface CurvePoint {
  hand: number;
  net: number;
  ev: number;
  showdown: number;
  nonShowdown: number;
}

/** Cumulative curves, downsampled to at most `maxPoints` (last point always kept). */
export function buildCurves(hands: HandRecord[], unit: Unit, maxPoints = 1500): CurvePoint[] {
  const points: CurvePoint[] = [{ hand: 0, net: 0, ev: 0, showdown: 0, nonShowdown: 0 }];
  const step = Math.max(1, Math.ceil(hands.length / maxPoints));
  let net = 0;
  let ev = 0;
  let sd = 0;
  let nsd = 0;
  hands.forEach((h, i) => {
    const factor = unit === 'bb' ? 1 / (h.bigBlind || 1) : isMoneyHand(h) ? 1 : 0;
    net += h.net * factor;
    ev += h.allInEv * factor;
    if (h.showdown) sd += h.net * factor;
    else nsd += h.net * factor;
    if ((i + 1) % step === 0 || i === hands.length - 1) {
      points.push({ hand: i + 1, net, ev, showdown: sd, nonShowdown: nsd });
    }
  });
  return points;
}
