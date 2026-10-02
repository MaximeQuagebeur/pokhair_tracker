'use client';

import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverTooltip } from '@/components/ui/tooltip';
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

interface PerformanceChartProps {
  data: CurvePoint[];
  unit: Unit;
  xAxis: 'hand' | 'tournament';
  series?: readonly SeriesKey[];
}

export function PerformanceChart({ data, unit, xAxis, series }: PerformanceChartProps) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const last = data[data.length - 1];
  const visibleSeries = SERIES.filter((s) => !series || series.includes(s.key));
  const xLabel = xAxis === 'hand' ? 'Main' : 'Tournoi';

  const toggle = (key: SeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Graphique de performance</CardTitle>
          <CardDescription>
            Gains cumulés par {xAxis === 'hand' ? 'nombre de mains jouées' : 'tournoi joué'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {visibleSeries.map((s) => (
            <HoverTooltip
              key={s.key}
              content={xAxis === 'tournament' && s.key === 'net' ? TOURNAMENT_NET_INFO : s.info}
              align="end"
            >
              <button
                type="button"
                onClick={() => toggle(s.key)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-opacity',
                  hidden.has(s.key) && 'opacity-40',
                )}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
                {last && <span className="tabular-nums text-muted-foreground">{formatAmount(last[s.key], unit)}</span>}
              </button>
            </HoverTooltip>
          ))}
        </div>
      </CardHeader>
      <CardContent className="h-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 'dataMax']}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickFormatter={(v: number) => v.toLocaleString('fr-FR')}
            />
            <YAxis
              orientation="right"
              width={80}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
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
              labelFormatter={(v) => `${xLabel} #${Number(v).toLocaleString('fr-FR')}`}
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
