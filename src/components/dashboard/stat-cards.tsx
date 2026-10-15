import { Card } from '@/components/ui/card';
import { InfoTip } from '@/components/ui/tooltip';
import type { DashboardStats, Unit } from '@/lib/poker/stats';
import { cn, formatAmount, formatNumber } from '@/lib/utils';

type Tone = 'positive' | 'negative' | 'neutral';
type Align = 'start' | 'center' | 'end';

const toneOf = (v: number): Tone => (v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral');
const toneClass = (tone: Tone) =>
  cn(tone === 'positive' && 'text-emerald-600 dark:text-emerald-400', tone === 'negative' && 'text-red-600 dark:text-red-400');

function StatLabel({ label, info, align }: { label: string; info: string; align?: Align }) {
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
      <InfoTip content={info} align={align} />
    </span>
  );
}

function KeyStat({ label, value, hint, tone, info }: { label: string; value: string; hint: string; tone: Tone; info: string }) {
  return (
    <Card className="flex min-w-0 flex-col justify-center px-4 py-3 max-md:rounded-2xl">
      <StatLabel label={label} info={info} align="start" />
      <span className={cn('text-3xl font-semibold leading-tight tabular-nums max-md:whitespace-nowrap max-md:text-xl max-md:font-bold', toneClass(tone))}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground max-md:truncate">{hint}</span>
    </Card>
  );
}

function MiniStat({ label, value, info, align }: { label: string; value: string; info: string; align?: Align }) {
  return (
    <div className="flex flex-col justify-center px-3 py-2">
      <StatLabel label={label} info={info} align={align} />
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

const INFO = {
  winrate:
    'Gain moyen en big blinds pour 100 mains de cash game (bb/100). Au-dessus de 0, vous êtes gagnant. L\'All-in EV donne le même winrate en neutralisant la chance des all-in.',
  net: 'Total encaissé moins total investi, rake déduit. En €, inclut les résultats des tournois et Expresso ; en BB, uniquement le cash game.',
  roi: 'Return On Investment : bénéfice net des tournois divisé par le total des buy-ins payés. ITM = part des tournois terminés dans l\'argent.',
  vpip: 'Voluntarily Put $ In Pot : % des mains où vous mettez de l\'argent volontairement préflop (call ou relance, blindes exclues). Mesure à quel point vous jouez large.',
  pfr: 'PreFlop Raise : % des mains où vous relancez préflop. Plus il est proche du VPIP, plus votre jeu préflop est agressif.',
  threeBet: '% des fois où vous sur-relancez face à une première relance préflop, parmi toutes les occasions de le faire.',
  af: 'Aggression Factor : (mises + relances) / calls après le flop. Au-dessus de 2 = jeu agressif, en dessous de 1 = jeu passif.',
  wtsd: 'Went To ShowDown : % des flops vus que vous menez jusqu\'à l\'abattage.',
  wsd: 'Won $ at ShowDown : % des abattages que vous remportez.',
};

export type StatsMode = 'cash' | 'tournament' | 'all';

function primaryStats(stats: DashboardStats, unit: Unit, mode: StatsMode) {
  const hands = `${stats.hands.toLocaleString('fr-FR')} mains`;
  const tournaments = `${stats.tournaments.toLocaleString('fr-FR')} tournois`;
  if (mode === 'tournament') {
    return [
      {
        label: 'ROI',
        value: formatNumber(stats.roi, 1, ' %'),
        hint: `${tournaments} · ITM ${formatNumber(stats.itm, 1, ' %')}`,
        tone: toneOf(stats.roi ?? 0),
        info: INFO.roi,
      },
      { label: 'Gains nets', value: formatAmount(stats.net, 'eur'), hint: hands, tone: toneOf(stats.net), info: INFO.net },
    ];
  }
  const net = unit === 'eur' ? stats.net : stats.netBB;
  return [
    {
      label: mode === 'all' ? 'Winrate cash' : 'Winrate',
      value: formatNumber(stats.winrate, 2, ' bb/100'),
      hint: `All-in EV : ${formatNumber(stats.evWinrate, 2, ' bb/100')}`,
      tone: toneOf(stats.winrate ?? 0),
      info: INFO.winrate,
    },
    {
      label: 'Gains nets',
      value: formatAmount(net, unit),
      hint: mode === 'all' && unit === 'eur' ? `${hands} · ${tournaments}` : hands,
      tone: toneOf(net),
      info: INFO.net,
    },
  ];
}

export function StatCards({ stats, unit, mode }: { stats: DashboardStats; unit: Unit; mode: StatsMode }) {
  return (
    <div className="grid gap-3 max-md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.5fr)]">
      {primaryStats(stats, unit, mode).map((s) => (
        <KeyStat key={s.label} {...s} />
      ))}
      <Card className="grid grid-cols-3 divide-x sm:grid-cols-6 max-md:col-span-2 max-md:rounded-2xl max-sm:[&>*:nth-child(-n+3)]:border-b">
        <MiniStat label="VPIP" value={formatNumber(stats.vpip, 1, ' %')} info={INFO.vpip} align="start" />
        <MiniStat label="PFR" value={formatNumber(stats.pfr, 1, ' %')} info={INFO.pfr} />
        <MiniStat label="3Bet" value={formatNumber(stats.threeBet, 1, ' %')} info={INFO.threeBet} />
        <MiniStat label="AF" value={formatNumber(stats.af, 2)} info={INFO.af} />
        <MiniStat label="WTSD" value={formatNumber(stats.wtsd, 1, ' %')} info={INFO.wtsd} align="end" />
        <MiniStat label="W$SD" value={formatNumber(stats.wsd, 1, ' %')} info={INFO.wsd} align="end" />
      </Card>
    </div>
  );
}
