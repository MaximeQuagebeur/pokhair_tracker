'use client';

import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverTooltip } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { CurvePoint, Unit } from '@/lib/poker/stats';
import { cn, formatAmount } from '@/lib/utils';

const SERIES = [
  {
    key: 'net',
    label: 'Net Won',
    color: '#22c55e',
    info: 'Gains réels cumulés, rake déduit : ce que vous avez réellement gagné ou perdu.',
  },
  {
    key: 'ev',
    label: 'All-In EV',
    color: '#eab308',
    info: 'Gains attendus : lors d\'un all-in avant la river, le résultat réel est remplacé par votre équité dans le pot. L\'écart avec Net Won mesure votre chance (variance).',
  },
  {
    key: 'showdown',
    label: 'Showdown',
    color: '#3b82f6',
    info: 'Gains cumulés des mains allées jusqu\'à l\'abattage (cartes retournées). Reflète la force de vos mains et de vos value bets.',
  },
  {
    key: 'nonShowdown',
    label: 'Non-Showdown',
    color: '#ef4444',
    info: 'Gains cumulés des mains terminées sans abattage (un joueur a tout remporté car les autres se sont couchés). Reflète votre agressivité : vols, bluffs et blindes perdues.',
  },
] as const;

const TOURNAMENT_NET_INFO = 'Bénéfice cumulé tournoi par tournoi : gains encaissés moins buy-in payé.';

type SeriesKey = (typeof SERIES)[number]['key'];

const DAY_MS = 86_400_000;
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const hourFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fullFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

interface PerformanceChartProps {
  data: CurvePoint[];
  unit: Unit;
  xAxis: 'hand' | 'tournament';
  /** Label the X axis with the date of each hand / tournament instead of its number. */
  showDates?: boolean;
  series?: readonly SeriesKey[];
}

export function PerformanceChart({ data, unit, xAxis, showDates: byDate = false, series }: PerformanceChartProps) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const mobile = useIsMobile();
  const last = data[data.length - 1];
  const visibleSeries = SERIES.filter((s) => !series || series.includes(s.key));
  const xLabel = xAxis === 'hand' ? 'Main' : 'Tournoi';
  const shortRange = byDate && data.length > 0 && data[data.length - 1].time - data[0].time < 2 * DAY_MS;
  // Date of the last point at or before x (points are sorted by x).
  const timeAt = (x: number) => {
    let lo = 0;
    let hi = data.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (data[mid].x <= x) lo = mid;
      else hi = mid - 1;
    }
    return data[lo]?.time ?? 0;
  };
  const formatTick = (v: number) =>
    byDate ? (shortRange ? hourFormat : dayFormat).format(timeAt(v)) : v.toLocaleString('fr-FR');

  const toggle = (key: SeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Card className="max-md:rounded-2xl">
      <CardHeader className="flex-row items-start justify-between space-y-0 max-md:flex-col max-md:gap-3 max-md:p-4">
        <div className="space-y-1.5">
          <CardTitle className="max-md:text-base">
            <span className="md:hidden">Performance</span>
            <span className="max-md:hidden">Graphique de performance</span>
          </CardTitle>
          <CardDescription>
            Gains cumulés par {xAxis === 'hand' ? 'nombre de mains jouées' : 'tournoi joué'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap justify-end gap-2 max-md:grid max-md:w-full max-md:grid-cols-2">
          {visibleSeries.map((s) => (
            <HoverTooltip
              key={s.key}
              content={xAxis === 'tournament' && s.key === 'net' ? TOURNAMENT_NET_INFO : s.info}
              align="end"
              className="max-md:w-full max-md:min-w-0"
            >
              <button
                type="button"
                onClick={() => toggle(s.key)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-opacity',
                  'max-md:w-full max-md:min-w-0 max-md:rounded-xl max-md:py-2',
                  hidden.has(s.key) && 'opacity-40',
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="max-md:truncate">{s.label}</span>
                {last && (
                  <span className="tabular-nums text-muted-foreground max-md:ml-auto">{formatAmount(last[s.key], unit)}</span>
                )}
              </button>
            </HoverTooltip>
          ))}
        </div>
      </CardHeader>
      <CardContent className="h-[520px] max-md:h-[300px] max-md:px-1 max-md:pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={mobile ? { top: 4, right: 0, bottom: 0, left: 4 } : { top: 8, right: 8, bottom: 8, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 'dataMax']}
              minTickGap={24}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: mobile ? 10 : 12 }}
              tickFormatter={formatTick}
            />
            <YAxis
              orientation="right"
              width={mobile ? 58 : 80}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: mobile ? 10 : 12 }}
              tickFormatter={(v: number) => formatAmount(v, unit)}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v) =>
                byDate
                  ? `${xLabel} #${Number(v).toLocaleString('fr-FR')} · ${fullFormat.format(timeAt(Number(v)))}`
                  : `${xLabel} #${Number(v).toLocaleString('fr-FR')}`
              }
              formatter={(v) => formatAmount(Number(v), unit)}
            />
            {visibleSeries.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                type="basis"
                hide={hidden.has(s.key)}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
