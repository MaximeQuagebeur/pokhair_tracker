import type { HandRecord, TournamentRecord } from './types';

export type Unit = 'eur' | 'bb';

export interface DashboardStats {
  hands: number;
  cashHands: number;
  /** € : cash net + tournament results. */
  net: number;
  /** Cash only (tournament chips are not money). */
  netBB: number;
  /** Cash bb/100. */
  winrate: number | null;
  evWinrate: number | null;
  tournaments: number;
  tournamentNet: number;
  /** % of total buy-ins (null when only freerolls). */
  roi: number | null;
  itm: number | null;
  vpip: number;
  pfr: number;
  threeBet: number | null;
  af: number | null;
  wtsd: number | null;
  wsd: number | null;
}

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);

/** Tournament hand amounts are chips: € results come from summary files instead. */
export const isCashHand = (h: HandRecord) => h.gameType === 'cash';
export const tournamentProfit = (t: TournamentRecord) => t.net;

export function computeStats(hands: HandRecord[], tournaments: TournamentRecord[] = []): DashboardStats {
  let cashHands = 0;
  let cashNet = 0;
  let netBB = 0;
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
    if (isCashHand(h)) {
      cashHands++;
      cashNet += h.net;
      if (h.bigBlind > 0) {
        netBB += h.net / h.bigBlind;
        evBB += h.allInEv / h.bigBlind;
      }
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

  const finished = tournaments.filter((t) => t.finished);
  const tournamentNet = finished.reduce((acc, t) => acc + tournamentProfit(t), 0);
  const totalBuyIn = finished.reduce((acc, t) => acc + t.buyIn, 0);
  const n = hands.length;

  return {
    hands: n,
    cashHands,
    net: cashNet + tournamentNet,
    netBB,
    winrate: cashHands ? netBB / (cashHands / 100) : null,
    evWinrate: cashHands ? evBB / (cashHands / 100) : null,
    tournaments: finished.length,
    tournamentNet,
    roi: pct(tournamentNet, totalBuyIn),
    itm: pct(finished.filter((t) => t.winnings > 0).length, finished.length),
    vpip: pct(vpip, n) ?? 0,
    pfr: pct(pfr, n) ?? 0,
    threeBet: pct(threeBet, threeBetOpp),
    af: calls > 0 ? aggressive / calls : null,
    wtsd: pct(showdowns, sawFlop),
    wsd: pct(wonSd, showdowns),
  };
}

export interface CurvePoint {
  /** X axis: hand number, or tournament number for tournament-only views. */
  x: number;
  net: number;
  ev: number;
  showdown: number;
  nonShowdown: number;
}

function downsample<T>(items: T[], maxPoints: number, toPoint: (item: T, i: number) => CurvePoint | null): CurvePoint[] {
  const points: CurvePoint[] = [{ x: 0, net: 0, ev: 0, showdown: 0, nonShowdown: 0 }];
  const step = Math.max(1, Math.ceil(items.length / maxPoints));
  items.forEach((item, i) => {
    const point = toPoint(item, i);
    if (point && ((i + 1) % step === 0 || i === items.length - 1)) points.push(point);
  });
  return points;
}

/**
 * Cumulative curves by hand. Cash hands drive every line; in € mode, each finished
 * tournament's result is added to Net Won / All-In EV at the moment it ended.
 */
export function buildCurves(
  hands: HandRecord[],
  tournaments: TournamentRecord[],
  unit: Unit,
  maxPoints = 1500,
): CurvePoint[] {
  const results = unit === 'eur' ? tournaments.filter((t) => t.finished).sort((a, b) => a.endTime - b.endTime) : [];
  let r = 0;
  let net = 0;
  let ev = 0;
  let sd = 0;
  let nsd = 0;
  const addResultsUntil = (time: number) => {
    for (; r < results.length && results[r].endTime <= time; r++) {
      net += tournamentProfit(results[r]);
      ev += tournamentProfit(results[r]);
    }
  };

  const points = downsample(hands, maxPoints, (h, i) => {
    addResultsUntil(h.timestamp);
    if (isCashHand(h)) {
      const factor = unit === 'bb' ? 1 / (h.bigBlind || 1) : 1;
      net += h.net * factor;
      ev += h.allInEv * factor;
      if (h.showdown) sd += h.net * factor;
      else nsd += h.net * factor;
    }
    return { x: i + 1, net, ev, showdown: sd, nonShowdown: nsd };
  });

  addResultsUntil(Infinity);
  const last = points[points.length - 1];
  if (last.net !== net) points.push({ x: hands.length, net, ev, showdown: sd, nonShowdown: nsd });
  return points;
}

/** Cumulative € profit by tournament played (finished ones, chronological). */
export function buildTournamentCurve(tournaments: TournamentRecord[], maxPoints = 1500): CurvePoint[] {
  const finished = tournaments.filter((t) => t.finished).sort((a, b) => a.endTime - b.endTime);
  let net = 0;
  return downsample(finished, maxPoints, (t, i) => {
    net += tournamentProfit(t);
    return { x: i + 1, net, ev: net, showdown: 0, nonShowdown: 0 };
  });
}
