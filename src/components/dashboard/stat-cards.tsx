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

export function StatCards({ stats, unit }: { stats: DashboardStats; unit: Unit }) {
  const net = unit === 'eur' ? stats.net : stats.netBB;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.5fr)]">
      <KeyStat
        label="Winrate"
        value={formatNumber(stats.winrate, 2, ' bb/100')}
        hint={`All-in EV : ${formatNumber(stats.evWinrate, 2, ' bb/100')}`}
        tone={toneOf(stats.winrate)}
      />
      <KeyStat
        label="Gains nets"
        value={formatAmount(net, unit)}
        hint={`${stats.hands.toLocaleString('fr-FR')} mains jouées`}
        tone={toneOf(net)}
      />
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
