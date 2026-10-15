'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Info, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { MiniCard, PlayingCard } from '@/components/hands/PlayingCard';
import { Segmented } from '@/components/ui/segmented';
import { fetchHandText, isCloudWeb } from '@/lib/cloud/client';
import { db } from '@/lib/db';
import {
  buildReplay,
  formatReplayAmount,
  type ReplayerHand,
  type ReplayerPlayer,
  type ReplayUnit,
} from '@/lib/poker/actionEngine';
import { analyzeStep } from '@/lib/poker/coach';
import type { HandRecord } from '@/lib/poker/types';
import { cn } from '@/lib/utils';
import { useHandFilterStore } from '@/stores/useHandFilterStore';

const MAX_WIDTH = 'max-w-[390px]';
const STEP_DELAY_MS = 1100;
/** Fixed control bar sits right above the BottomNav (4rem + home indicator), or at the bottom on desktop. */
const CONTROLS_BOTTOM = 'bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0';

interface Point {
  x: number;
  y: number;
}
const CENTER: Point = { x: 50, y: 47 };
const at = (p: Point): CSSProperties => ({ left: `${p.x}%`, top: `${p.y}%` });
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const onOval = (angle: number): Point => ({ x: 50 + 37 * Math.cos(angle), y: 50 + 41 * Math.sin(angle) });

/** Opponent shown at the top: still in at the end, then most invested; the button when nobody put money in. */
function pickVillain(replay: ReplayerHand): ReplayerPlayer | undefined {
  const last = replay.steps[replay.steps.length - 1];
  const invested = (p: ReplayerPlayer) => (replay.startingStacks[p.name] ?? p.stack) - p.stack + p.won;
  const opponents = last.players
    .filter((p) => !p.isHero && p.inHand)
    .sort((a, b) => Number(a.folded) - Number(b.folded) || invested(b) - invested(a));
  const best = opponents[0];
  if (best && invested(best) > 0) return best;
  return last.players.find((p) => p.isButton && !p.isHero) ?? best ?? last.players.find((p) => !p.isHero);
}

/**
 * Portrait layout keeping the clockwise seat order: hero BOTTOM, main villain TOP,
 * players between them clockwise on the LEFT side, the others on the RIGHT side.
 */
function layoutSeats(replay: ReplayerHand): Map<number, Point> {
  const players = replay.steps[0].players;
  const heroSeat = players.find((p) => p.isHero)?.seat ?? players[0]?.seat ?? 1;
  const rel = (seat: number) => (((seat - heroSeat) % replay.maxSeats) + replay.maxSeats) % replay.maxSeats;
  const ordered = [...players].sort((a, b) => rel(a.seat) - rel(b.seat));
  const villainSeat = pickVillain(replay)?.seat;
  const vi = ordered.findIndex((p) => p.seat === villainSeat);
  const points = new Map<number, Point>();
  if (!ordered.length) return points;
  points.set(ordered[0].seat, onOval(Math.PI / 2));
  if (vi <= 0) return points;
  points.set(ordered[vi].seat, onOval((3 * Math.PI) / 2));
  const left = ordered.slice(1, vi);
  const right = ordered.slice(vi + 1);
  left.forEach((p, i) => points.set(p.seat, onOval(Math.PI / 2 + ((i + 1) / (left.length + 1)) * Math.PI)));
  right.forEach((p, i) => points.set(p.seat, onOval((3 * Math.PI) / 2 + ((i + 1) / (right.length + 1)) * Math.PI)));
  return points;
}

interface MobileReplayerProps {
  hand: HandRecord;
  /** "12 / 340" position in the filtered list. */
  counter?: string;
  onPrevHand?: () => void;
  onNextHand?: () => void;
}

export function MobileReplayer({ hand, counter, onPrevHand, onNextHand }: MobileReplayerProps) {
  const text = useLiveQuery(() => db.handTexts.get(hand.id).then((t) => t ?? null), [hand.id]);
  const [missing, setMissing] = useState(false);
  const unit = useHandFilterStore((s) => s.replayerUnit);
  const setUnit = useHandFilterStore((s) => s.setReplayerUnit);
  const replay = useMemo(() => (text ? buildReplay(text.text, unit) : null), [text, unit]);

  // The PWA only downloads hand histories when they are replayed.
  useEffect(() => {
    setMissing(false);
    if (text !== null) return;
    if (!isCloudWeb()) {
      setMissing(true);
      return;
    }
    void fetchHandText(hand.id).then((t) => !t && setMissing(true));
  }, [text, hand.id]);

  const isCash = hand.gameType === 'cash';
  const net = `${hand.net > 0 ? '+' : ''}${formatReplayAmount(hand.net, { isCash, bigBlind: hand.bigBlind }, unit)}`;

  return (
    <div className={cn('mx-auto flex w-full flex-col', MAX_WIDTH)}>
      <header className="flex items-center gap-2 pb-2">
        <button
          type="button"
          onClick={onPrevHand}
          disabled={!onPrevHand}
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground active:bg-accent disabled:opacity-30"
          aria-label="Main précédente"
        >
          <SkipBack className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-1.5">
            {hand.heroCards.map((c) => (
              <MiniCard key={c} card={c} />
            ))}
            <span className="text-sm font-medium">{hand.heroPosition ?? ''}</span>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                hand.net > 0 ? 'text-emerald-500' : hand.net < 0 ? 'text-red-500' : 'text-muted-foreground',
              )}
            >
              {net}
            </span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {hand.table} · {hand.limit}
            {counter && ` · ${counter}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onNextHand}
          disabled={!onNextHand}
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground active:bg-accent disabled:opacity-30"
          aria-label="Main suivante"
        >
          <SkipForward className="size-5" />
        </button>
      </header>

      <div className="flex justify-center pb-2">
        <Segmented
          value={unit}
          options={[
            { value: 'stake', label: isCash ? '€' : 'Jetons' },
            { value: 'bb', label: 'BB' },
          ]}
          onChange={(v: ReplayUnit) => setUnit(v)}
        />
      </div>

      {replay ? (
        <PortraitTable key={replay.id} replay={replay} unit={unit} />
      ) : (
        <p className="py-24 text-center text-sm text-muted-foreground">
          {missing ? 'Historique brut indisponible pour cette main.' : 'Chargement…'}
        </p>
      )}
    </div>
  );
}

function PortraitTable({ replay, unit }: { replay: ReplayerHand; unit: ReplayUnit }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const { steps } = replay;
  const last = steps.length - 1;
  const step = steps[index];
  const prev = index > 0 ? steps[index - 1] : null;
  const seats = useMemo(() => layoutSeats(replay), [replay]);
  const insight = useMemo(() => analyzeStep(replay, index, unit), [replay, index, unit]);
  const fmt = (v: number) => formatReplayAmount(v, replay, unit);

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const slow = steps[index + 1].kind !== 'action';
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), slow ? STEP_DELAY_MS * 1.5 : STEP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [playing, index, last, steps]);

  const togglePlay = () => {
    if (!playing && index >= last) setIndex(0);
    setPlaying(!playing);
  };
  const go = (delta: number) => {
    setPlaying(false);
    setIndex((i) => Math.min(Math.max(i + delta, 0), last));
  };

  const totalPot = step.pot + step.players.reduce((a, p) => a + p.bet, 0);
  const collecting = step.kind !== 'action' && step.kind !== 'init';
  const button = step.players.find((p) => p.isButton);
  const buttonSeat = button && seats.get(button.seat);
  const buttonPoint = buttonSeat && lerp(buttonSeat, CENTER, 0.3);

  return (
    <>
      <div className="relative aspect-[3/4] w-full select-none">
        {/* Rail + felt: vertical oval */}
        <div
          className="absolute inset-x-[13%] inset-y-[9%] rounded-[50%] p-[2.5%] shadow-2xl"
          style={{ background: 'linear-gradient(90deg, #3b4049, #1a1d22)' }}
        >
          <div
            className="size-full rounded-[50%] shadow-[inset_0_0_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
            style={{ background: 'radial-gradient(ellipse at center, #2fbf72 0%, #1f9d58 50%, #147a41 100%)' }}
          />
        </div>

        {/* Board */}
        <div className="absolute flex -translate-x-1/2 -translate-y-1/2 gap-1" style={at(CENTER)}>
          {Array.from({ length: 5 }, (_, i) =>
            step.board[i] ? (
              <PlayingCard key={step.board[i]} card={step.board[i]} size="md" className="animate-deal" />
            ) : (
              <div key={`slot-${i}`} className="h-[62px] w-11 rounded-md border border-dashed border-white/15" />
            ),
          )}
        </div>

        {/* Pot */}
        {totalPot > 0 && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/45 px-3 py-0.5 text-xs font-semibold tabular-nums text-amber-200"
            style={at({ x: 50, y: CENTER.y + 11 })}
          >
            Pot : {fmt(step.pot)}
            {totalPot !== step.pot && <span className="ml-1 font-normal text-white/60">({fmt(totalPot)})</span>}
          </div>
        )}

        {buttonPoint && (
          <div
            className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-[9px] font-bold text-zinc-900 shadow-md transition-all duration-700"
            style={at({ x: buttonPoint.x + 9, y: buttonPoint.y })}
          >
            D
          </div>
        )}

        {/* Bets, then winnings */}
        {step.players.map((p, i) => {
          const seat = seats.get(p.seat);
          if (!seat) return null;
          const prevBet = prev?.players[i]?.bet ?? 0;
          const flying = collecting && p.bet === 0 && prevBet > 0;
          const won = step.kind === 'payout' && p.won > 0;
          const pos = p.bet > 0 || won ? lerp(seat, CENTER, 0.45) : flying ? CENTER : seat;
          const amount = won ? p.won : p.bet > 0 ? p.bet : prevBet;
          return (
            <div
              key={`bet-${p.seat}`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
              style={{ ...at(pos), opacity: p.bet > 0 || won ? 1 : 0 }}
            >
              <span
                className={cn(
                  'whitespace-nowrap rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums text-white',
                  won ? 'bg-emerald-600/90' : 'bg-black/60',
                )}
              >
                {won && '+'}
                {fmt(amount)}
              </span>
            </div>
          );
        })}

        {step.players.map((p) => {
          const point = seats.get(p.seat);
          return point ? (
            <MobileSeat
              key={p.seat}
              player={p}
              point={point}
              active={step.activeSeat === p.seat}
              showResult={step.kind === 'payout' || step.kind === 'showdown'}
              fmt={fmt}
            />
          ) : null;
        })}
      </div>

      <div className="flex min-h-[40px] items-center justify-between gap-3 px-1 text-sm">
        <span className="font-medium">{step.message}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {index} / {last}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={last}
        value={index}
        onChange={(e) => {
          setPlaying(false);
          setIndex(Number(e.target.value));
        }}
        className="h-8 w-full accent-primary"
        aria-label="Progression de la main"
      />

      {/* Room for the fixed control bar (+ the open analysis drawer). */}
      <div className={cn('shrink-0 transition-[height]', infoOpen ? 'h-56' : 'h-24')} />

      {/* Analysis drawer: tap-to-open replacement for desktop hover tooltips, stays in sync with the step. */}
      <section
        className={cn(
          'fixed inset-x-0 z-30 mx-auto px-3 transition-all duration-300',
          MAX_WIDTH,
          'bottom-[calc(4rem+5.5rem+env(safe-area-inset-bottom))] md:bottom-[5.5rem]',
          infoOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        )}
        aria-live="polite"
        aria-hidden={!infoOpen}
      >
        <div
          className={cn(
            'rounded-2xl border bg-card/95 p-4 shadow-2xl backdrop-blur-xl',
            insight.tone === 'good' && 'border-emerald-500/50',
            insight.tone === 'warning' && 'border-amber-500/50',
          )}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="font-semibold">{insight.title}</h2>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="-mr-2 flex size-9 items-center justify-center rounded-full text-muted-foreground active:bg-accent"
              aria-label="Fermer l'analyse"
            >
              <X className="size-5" />
            </button>
          </div>
          {insight.lines.map((line, i) => (
            <p key={i} className="text-sm leading-snug text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      </section>

      {/* Thumb-friendly controls */}
      <div className={cn('fixed inset-x-0 z-30 border-t bg-background/80 backdrop-blur-xl', CONTROLS_BOTTOM)}>
        <div className={cn('mx-auto flex h-[5.5rem] items-center justify-between gap-3 px-4', MAX_WIDTH)}>
          <button
            type="button"
            onClick={() => setInfoOpen((o) => !o)}
            aria-pressed={infoOpen}
            aria-label="Analyse de l'action"
            className={cn(
              'flex size-14 items-center justify-center rounded-full border transition-colors active:scale-95',
              infoOpen ? 'border-primary bg-primary/15 text-primary' : 'text-muted-foreground',
            )}
          >
            <Info className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Action précédente"
            className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground active:scale-95 disabled:opacity-40"
          >
            <ChevronLeft className="size-8" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Lecture'}
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
          >
            {playing ? <Pause className="size-8" /> : <Play className="ml-1 size-8" />}
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index >= last}
            aria-label="Action suivante"
            className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground active:scale-95 disabled:opacity-40"
          >
            <ChevronRight className="size-8" />
          </button>
        </div>
      </div>
    </>
  );
}

interface MobileSeatProps {
  player: ReplayerPlayer;
  point: Point;
  active: boolean;
  showResult: boolean;
  fmt: (v: number) => string;
}

function MobileSeat({ player: p, point, active, showResult, fmt }: MobileSeatProps) {
  const faceDown = p.inHand && !p.folded && !p.cards;
  const size = p.isHero ? 'md' : 'sm';
  return (
    <div
      className={cn(
        'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-opacity duration-300',
        (p.folded || !p.inHand) && 'opacity-45 grayscale',
      )}
      style={at(point)}
    >
      <div className={cn('relative z-0 -mb-2 flex', p.isHero ? 'h-[62px] -space-x-3' : 'h-[45px] -space-x-3')}>
        {p.cards
          ? p.cards.map((c) => <PlayingCard key={c} card={c} size={size} className="animate-deal" />)
          : faceDown && [0, 1].map((i) => <PlayingCard key={i} faceDown size={size} className="animate-deal" />)}
      </div>
      <div
        className={cn(
          'relative z-10 w-[84px] rounded-lg border border-white/10 bg-zinc-900/95 px-1.5 py-0.5 text-center shadow-lg ring-2 transition-all',
          active ? 'ring-amber-400' : p.won > 0 && showResult ? 'ring-emerald-400' : 'ring-transparent',
          p.isHero && 'bg-zinc-800',
        )}
      >
        {p.position && (
          <span className="absolute -left-1.5 -top-2 rounded bg-sky-700 px-1 text-[8px] font-bold text-white">{p.position}</span>
        )}
        <div className={cn('truncate text-[11px] font-semibold', p.isHero ? 'text-amber-300' : 'text-white')}>{p.name}</div>
        <div className="text-[11px] tabular-nums text-zinc-300">{p.allIn && p.stack <= 0 ? 'All-in' : fmt(p.stack)}</div>
      </div>
      <div className="mt-0.5 h-4 text-[9px] font-semibold uppercase tracking-wide">
        {p.folded ? (
          <span className="text-red-300">Fold</span>
        ) : showResult && p.handDescription ? (
          <span className="normal-case text-emerald-200">{p.handDescription}</span>
        ) : p.lastAction ? (
          <span className={cn('rounded px-1', active ? 'bg-amber-400 text-black' : 'bg-black/50 text-white')}>{p.lastAction}</span>
        ) : null}
      </div>
    </div>
  );
}
