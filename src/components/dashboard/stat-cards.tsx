import { Card } from '@/components/ui/card';
import type { DashboardStats, Unit } from '@/lib/poker/stats';
import { cn, formatAmount, formatNumber } from '@/lib/utils';

type Tone = 'positive' | 'negative' | 'neutral';

const toneOf = (v: number): Tone => (v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral');
const toneClass = (tone: Tone) =>
  cn(tone === 'positive' && 'text-emerald-600 dark:text-emerald-400', tone === 'negative' && 'text-red-600 dark:text-red-400');

function KeyStat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: Tone }) {
  return (
    <Card className="flex flex-col justify-center px-4 py-3">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn('text-3xl font-semibold leading-tight tabular-nums', toneClass(tone))}>{value}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Card>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col justify-center px-3 py-2" title={hint}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

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
      },
      { label: 'Gains nets', value: formatAmount(stats.net, 'eur'), hint: hands, tone: toneOf(stats.net) },
    ];
  }
  const net = unit === 'eur' ? stats.net : stats.netBB;
  return [
    {
      label: mode === 'all' ? 'Winrate cash' : 'Winrate',
      value: formatNumber(stats.winrate, 2, ' bb/100'),
      hint: `All-in EV : ${formatNumber(stats.evWinrate, 2, ' bb/100')}`,
      tone: toneOf(stats.winrate ?? 0),
    },
    {
      label: 'Gains nets',
      value: formatAmount(net, unit),
      hint: mode === 'all' && unit === 'eur' ? `${hands} · ${tournaments}` : hands,
      tone: toneOf(net),
    },
  ];
}

export function StatCards({ stats, unit, mode }: { stats: DashboardStats; unit: Unit; mode: StatsMode }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.5fr)]">
      {primaryStats(stats, unit, mode).map((s) => (
        <KeyStat key={s.label} {...s} />
      ))}
      <Card className="grid grid-cols-3 divide-x sm:grid-cols-6">
        <MiniStat label="VPIP" value={formatNumber(stats.vpip, 1, ' %')} hint="Argent mis volontairement préflop" />
        <MiniStat label="PFR" value={formatNumber(stats.pfr, 1, ' %')} hint="Relances préflop" />
        <MiniStat label="3Bet" value={formatNumber(stats.threeBet, 1, ' %')} hint="3Bets / opportunités" />
        <MiniStat label="AF" value={formatNumber(stats.af, 2)} hint="(Mises + relances) / calls postflop" />
        <MiniStat label="WTSD" value={formatNumber(stats.wtsd, 1, ' %')} hint="Showdowns / flops vus" />
        <MiniStat label="W$SD" value={formatNumber(stats.wsd, 1, ' %')} hint="Showdowns gagnés" />
      </Card>
    </div>
  );
}
