import { ChevronRight } from 'lucide-react';
import { MiniCard } from '@/components/hands/PlayingCard';
import { netBB, potBB } from '@/lib/poker/hand-search';
import type { HandRecord } from '@/lib/poker/types';
import { cn, formatNumber, formatStake } from '@/lib/utils';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
const shortDateFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const signed = (text: string, value: number) => (value > 0 ? `+${text}` : text);

interface HandTableProps {
  hands: HandRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function HandTable({ hands, selectedId, onSelect }: HandTableProps) {
  return (
    <>
      <MobileHandList hands={hands} selectedId={selectedId} onSelect={onSelect} />
      <DesktopHandTable hands={hands} selectedId={selectedId} onSelect={onSelect} />
    </>
  );
}

function MobileHandList({ hands, selectedId, onSelect }: HandTableProps) {
  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {hands.map((h) => {
        const isCash = h.gameType === 'cash';
        const bb = netBB(h);
        return (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onSelect(h.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 text-left transition-transform active:scale-[0.98] active:bg-accent',
                selectedId === h.id && 'border-primary/60',
              )}
            >
              <div className="flex w-[58px] shrink-0 flex-col items-center gap-1">
                <div className="flex gap-0.5">
                  {h.heroCards.length ? (
                    h.heroCards.map((c) => <MiniCard key={c} card={c} />)
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">{h.heroPosition ?? '—'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{h.table}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {h.limit} · {shortDateFormat.format(h.timestamp)}
                  {h.showdown && ' · SD'}
                </div>
              </div>
              <div
                className={cn(
                  'shrink-0 text-right text-sm font-semibold tabular-nums',
                  h.net > 0 ? 'text-emerald-500' : h.net < 0 ? 'text-red-500' : 'text-muted-foreground',
                )}
              >
                {signed(formatStake(h.net, isCash), h.net)}
                <div className="text-[11px] font-normal opacity-80">{signed(formatNumber(bb, 1, ' bb'), bb)}</div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DesktopHandTable({ hands, selectedId, onSelect }: HandTableProps) {
  return (
    <div className="overflow-x-auto max-md:hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Date & Heure</th>
            <th className="px-3 py-2 font-medium">Table / Limite</th>
            <th className="px-3 py-2 font-medium">Cartes</th>
            <th className="px-3 py-2 font-medium">Position</th>
            <th className="px-3 py-2 font-medium">Action préflop</th>
            <th className="px-3 py-2 font-medium">Showdown</th>
            <th className="px-3 py-2 text-right font-medium">Pot</th>
            <th className="px-3 py-2 text-right font-medium">Net Won</th>
          </tr>
        </thead>
        <tbody>
          {hands.map((h) => {
            const isCash = h.gameType === 'cash';
            const bb = netBB(h);
            return (
              <tr
                key={h.id}
                onClick={() => onSelect(h.id)}
                className={cn(
                  'cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/60',
                  selectedId === h.id && 'bg-accent',
                )}
              >
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                  {dateFormat.format(h.timestamp)}
                </td>
                <td className="px-3 py-2">
                  <div className="max-w-[180px] truncate">{h.table}</div>
                  <div className="text-xs text-muted-foreground">{h.limit}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-0.5">
                    {h.heroCards.map((c) => (
                      <MiniCard key={c} card={c} />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 font-medium">{h.heroPosition ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{h.preflopActions || '—'}</td>
                <td className="px-3 py-2">
                  {h.showdown ? (
                    <span className={h.wonAtShowdown ? 'text-emerald-500' : 'text-red-500'}>Oui</span>
                  ) : (
                    <span className="text-muted-foreground">Non</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {formatStake(h.pot, isCash)}
                  <div className="text-xs text-muted-foreground">{formatNumber(potBB(h), 1, ' bb')}</div>
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums',
                    h.net > 0 ? 'text-emerald-500' : h.net < 0 ? 'text-red-500' : 'text-muted-foreground',
                  )}
                >
                  {signed(formatStake(h.net, isCash), h.net)}
                  <div className="text-xs opacity-80">{signed(formatNumber(bb, 1, ' bb'), bb)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
