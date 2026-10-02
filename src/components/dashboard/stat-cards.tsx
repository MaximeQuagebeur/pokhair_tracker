import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { DashboardStats, Unit } from '@/lib/poker/stats';
import { cn, formatAmount, formatNumber } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

function StatCard({ label, value, hint, tone = 'neutral' }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'text-2xl font-semibold tabular-nums',
            tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
            tone === 'negative' && 'text-red-600 dark:text-red-400',
          )}
        >
          {value}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

const toneOf = (v: number) => (v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral');

export function StatCards({ stats, unit }: { stats: DashboardStats; unit: Unit }) {
  const net = unit === 'eur' ? stats.net : stats.netBB;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Winrate"
        value={formatNumber(stats.winrate, 2, ' bb/100')}
        hint={`All-in EV : ${formatNumber(stats.evWinrate, 2, ' bb/100')}`}
        tone={toneOf(stats.winrate)}
      />
      <StatCard
        label="Gains nets"
        value={formatAmount(net, unit)}
        hint={`${stats.hands.toLocaleString('fr-FR')} mains jouées`}
        tone={toneOf(net)}
      />
      <StatCard label="VPIP" value={formatNumber(stats.vpip, 1, ' %')} hint="Argent mis volontairement préflop" />
      <StatCard label="PFR" value={formatNumber(stats.pfr, 1, ' %')} hint="Relances préflop" />
      <StatCard label="3Bet" value={formatNumber(stats.threeBet, 1, ' %')} hint="3Bets / opportunités" />
      <StatCard label="AF" value={formatNumber(stats.af, 2)} hint="(Mises + relances) / calls postflop" />
      <StatCard label="WTSD" value={formatNumber(stats.wtsd, 1, ' %')} hint="Showdowns / flops vus" />
      <StatCard label="W$SD" value={formatNumber(stats.wsd, 1, ' %')} hint="Showdowns gagnés" />
    </div>
  );
}
