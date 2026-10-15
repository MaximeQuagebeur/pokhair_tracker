import { formatReplayAmount, type ReplayerHand, type ReplayerPlayer, type ReplayUnit } from './actionEngine';

/** Rule-based reading of a replay step (pot odds, sizing, SPR) shown by the mobile replayer. */
export interface StepInsight {
  title: string;
  lines: string[];
  tone: 'neutral' | 'good' | 'warning';
}

const pct = (v: number) => `${Math.round(v * 100)} %`;
const sumBets = (players: ReplayerPlayer[]) => players.reduce((a, p) => a + p.bet, 0);
const maxBet = (players: ReplayerPlayer[]) => players.reduce((a, p) => Math.max(a, p.bet), 0);

function sprAdvice(spr: number) {
  if (spr < 3) return 'SPR faible : le tapis est engagé, une top paire suffit généralement pour partir à tapis.';
  if (spr <= 8) return 'SPR moyen : les mains fortes (deux paires+) veulent construire le pot, les paires moyennes le contrôler.';
  return 'SPR élevé : prudence avec une paire, privilégiez les tirages et les mains très fortes pour gros pot.';
}

function sizingAdvice(ratio: number) {
  if (ratio < 0.4) return 'Petite mise : idéale sur board sec, pour value fine ou protection à moindre coût.';
  if (ratio <= 0.8) return 'Mise standard : équilibre entre value et bluffs.';
  if (ratio <= 1.1) return 'Mise pot : range polarisée (très fort ou bluff).';
  return 'Overbet : à réserver aux nuts et aux meilleurs bluffs (bloqueurs).';
}

export function analyzeStep(replay: ReplayerHand, index: number, unit: ReplayUnit): StepInsight {
  const step = replay.steps[index];
  const prev = index > 0 ? replay.steps[index - 1] : null;
  const fmt = (v: number) => formatReplayAmount(v, replay, unit);
  const hero = step.players.find((p) => p.isHero);
  if (!hero) return { title: 'Main observée', lines: ['Le héros ne participe pas à cette main.'], tone: 'neutral' };
  const heroBefore = prev?.players.find((p) => p.seat === hero.seat);

  switch (step.kind) {
    case 'init': {
      const start = replay.startingStacks[hero.name] ?? hero.stack;
      const biggestOther = Math.max(
        0,
        ...step.players.filter((p) => !p.isHero && p.inHand).map((p) => replay.startingStacks[p.name] ?? p.stack),
      );
      const effective = Math.min(start, biggestOther);
      return {
        title: 'Distribution',
        lines: [
          `Position : ${hero.position ?? '—'}`,
          replay.bigBlind > 0 ? `Tapis effectif : ${Math.round(effective / replay.bigBlind)} bb` : `Tapis effectif : ${fmt(effective)}`,
        ],
        tone: 'neutral',
      };
    }
    case 'street': {
      if (hero.folded || !hero.inHand) return { title: 'Hors du coup', lines: ['Vous vous êtes couché.'], tone: 'neutral' };
      if (step.pot <= 0) return { title: 'Nouvelle street', lines: [`Pot : ${fmt(step.pot)}`], tone: 'neutral' };
      const spr = hero.stack / step.pot;
      return {
        title: `SPR ${spr.toFixed(1)}`,
        lines: [`Pot : ${fmt(step.pot)} · Votre tapis : ${fmt(hero.stack)}`, sprAdvice(spr)],
        tone: 'neutral',
      };
    }
    case 'showdown':
      return {
        title: 'Abattage',
        lines: [hero.folded ? 'Vous étiez couché.' : (hero.handDescription ?? 'Main montrée.')],
        tone: 'neutral',
      };
    case 'payout': {
      const net = hero.stack - (replay.startingStacks[hero.name] ?? hero.stack);
      return {
        title: hero.won > 0 ? 'Pot remporté' : 'Pot perdu',
        lines: [`Résultat de la main : ${net > 0 ? '+' : ''}${fmt(net)}`],
        tone: net > 0 ? 'good' : net < 0 ? 'warning' : 'neutral',
      };
    }
  }

  if (!prev || !heroBefore) return { title: 'Action', lines: [step.message], tone: 'neutral' };
  const potBefore = prev.pot + sumBets(prev.players);
  const toCall = Math.max(0, maxBet(prev.players) - heroBefore.bet);
  const odds = toCall > 0 ? toCall / (potBefore + toCall) : 0;

  // Opponent action: what it offers the hero.
  if (step.activeSeat !== hero.seat) {
    const facing = Math.max(0, maxBet(step.players) - hero.bet);
    if (hero.folded || !hero.inHand || facing <= 0) return { title: 'Action adverse', lines: [step.message], tone: 'neutral' };
    const pot = step.pot + sumBets(step.players);
    return {
      title: 'Cote proposée',
      lines: [
        step.message,
        `Pour payer ${fmt(Math.min(facing, hero.stack))} et gagner ${fmt(pot)}, il faut ${pct(facing / (pot + facing))} d'équité.`,
      ],
      tone: 'neutral',
    };
  }

  const put = hero.bet - heroBefore.bet;
  switch (step.action) {
    case 'fold':
      return {
        title: 'Fold',
        lines:
          toCall > 0
            ? [`Il fallait payer ${fmt(toCall)} pour un pot de ${fmt(potBefore)} : ${pct(odds)} d'équité requise.`]
            : ['Fold sans mise à payer : un check était gratuit.'],
        tone: toCall > 0 ? 'neutral' : 'warning',
      };
    case 'check':
      return { title: 'Check', lines: [`Pot contrôlé à ${fmt(potBefore)}.`], tone: 'neutral' };
    case 'call':
      return {
        title: step.allIn ? 'Call all-in' : 'Call',
        lines: [`Vous payez ${fmt(put)} pour gagner ${fmt(potBefore)} : ${pct(put / (potBefore + put))} d'équité requise.`],
        tone: 'neutral',
      };
    case 'bet': {
      const ratio = potBefore > 0 ? put / potBefore : 0;
      return {
        title: `Mise ${pct(ratio)} du pot`,
        lines: [
          sizingAdvice(ratio),
          `Un bluff de cette taille doit réussir ${pct(put / (potBefore + put))} du temps pour être rentable.`,
        ],
        tone: 'neutral',
      };
    }
    default: {
      const ratio = potBefore + toCall > 0 ? (put - toCall) / (potBefore + toCall) : 0;
      const lines =
        step.street === 'preflop' && replay.bigBlind > 0
          ? [`Relance à ${Math.round((hero.bet / replay.bigBlind) * 10) / 10} bb.`]
          : [`Relance de ${pct(ratio)} du pot après call.`, sizingAdvice(ratio)];
      return { title: step.allIn ? 'Relance all-in' : 'Relance', lines, tone: 'neutral' };
    }
  }
}
