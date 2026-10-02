'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MiniCard, PlayingCard } from '@/components/hands/PlayingCard';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { db } from '@/lib/db';
import {
  buildReplay,
  formatReplayAmount,
  type ReplayerHand,
  type ReplayerPlayer,
  type ReplayerStep,
  type ReplayStreet,
  type ReplayUnit,
} from '@/lib/poker/actionEngine';
import type { HandRecord } from '@/lib/poker/types';
import {
  playAllIn,
  playBet,
  playCall,
  playCheck,
  playDeal,
  playFold,
  playHoleCards,
  playRaise,
  playReveal,
  playWin,
  preloadSounds,
} from '@/lib/sounds';
import { cn } from '@/lib/utils';
import { useHandFilterStore } from '@/stores/useHandFilterStore';

const SPEEDS = [
  { value: '0.5', label: '0.5x' },
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '4', label: '4x' },
] as const;
type Speed = (typeof SPEEDS)[number]['value'];

const STREETS: { value: ReplayStreet; label: string }[] = [
  { value: 'preflop', label: 'Préflop' },
  { value: 'flop', label: 'Flop' },
  { value: 'turn', label: 'Turn' },
  { value: 'river', label: 'River' },
  { value: 'showdown', label: 'Showdown' },
];

const BASE_DELAY_MS = 1100;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'medium' });

interface Point {
  x: number;
  y: number;
}
const CENTER: Point = { x: 50, y: 46 };
const at = (p: Point): CSSProperties => ({ left: `${p.x}%`, top: `${p.y}%` });

/** Seats around the table, hero (display index 0) at the bottom, then clockwise. */
function seatAngle(seat: number, heroSeat: number, maxSeats: number) {
  const index = (((seat - heroSeat) % maxSeats) + maxSeats) % maxSeats;
  return Math.PI / 2 + (index * 2 * Math.PI) / maxSeats;
}
// Superellipse (n = 3): follows the rounded-rectangle shape of the table better than an ellipse.
const squircle = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / 3);
const onTable = (angle: number, rx: number, ry: number): Point => ({
  x: 50 + rx * squircle(Math.cos(angle)),
  y: 50 + ry * squircle(Math.sin(angle)),
});

function playStepSound(step: ReplayerStep) {
  switch (step.kind) {
    case 'init':
      return playHoleCards();
    case 'street':
      return playDeal(step.street === 'flop' ? 3 : 1);
    case 'showdown':
      return playReveal();
    case 'payout':
      return playWin();
    case 'action':
      if (step.allIn) return playAllIn();
      if (step.action === 'fold') return playFold();
      if (step.action === 'check') return playCheck();
      if (step.action === 'call') return playCall();
      if (step.action === 'bet') return playBet();
      return playRaise();
  }
}

interface PokerTableReplayerProps {
  hand: HandRecord;
  /** "12 / 340" position in the filtered list. */
  counter?: string;
  onClose: () => void;
  onPrevHand?: () => void;
  onNextHand?: () => void;
}

export function PokerTableReplayer({ hand, counter, onClose, onPrevHand, onNextHand }: PokerTableReplayerProps) {
  const text = useLiveQuery(() => db.handTexts.get(hand.id).then((t) => t ?? null), [hand.id]);
  const unit = useHandFilterStore((s) => s.replayerUnit);
  const replay = useMemo(() => (text ? buildReplay(text.text, unit) : null), [text, unit]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>('1');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isCash = hand.gameType === 'cash';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="flex max-h-full w-full max-w-6xl flex-col overflow-auto rounded-xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-semibold">
              <span className="truncate">{hand.table}</span>
              <span className="text-sm font-normal text-muted-foreground">{hand.limit}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {dateFormat.format(hand.timestamp)} · #{hand.id}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hand.heroCards.map((c) => (
              <MiniCard key={c} card={c} />
            ))}
          </div>
          <span className="text-sm font-medium">{hand.heroPosition ?? ''}</span>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              hand.net > 0 ? 'text-emerald-500' : hand.net < 0 ? 'text-red-500' : 'text-muted-foreground',
            )}
          >
            {hand.net > 0 ? '+' : ''}
            {formatReplayAmount(hand.net, { isCash, bigBlind: hand.bigBlind }, unit)}
          </span>
          {counter && <span className="text-xs tabular-nums text-muted-foreground">{counter}</span>}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X />
          </Button>
        </header>

        {replay ? (
          <ReplayerView
            key={replay.id}
            replay={replay}
            unit={unit}
            playing={playing}
            speed={Number(speed)}
            onPlayingChange={setPlaying}
            speedControl={<Segmented value={speed} options={SPEEDS} onChange={setSpeed} />}
            onPrevHand={onPrevHand}
            onNextHand={onNextHand}
          />
        ) : (
          <p className="p-16 text-center text-sm text-muted-foreground">
            {text === undefined
              ? 'Chargement…'
              : 'Historique brut indisponible pour cette main : relancez une synchronisation complète depuis les réglages.'}
          </p>
        )}
      </div>
    </div>
  );
}

interface ReplayerViewProps {
  replay: ReplayerHand;
  unit: ReplayUnit;
  playing: boolean;
  speed: number;
  onPlayingChange: (playing: boolean) => void;
  speedControl: ReactNode;
  onPrevHand?: () => void;
  onNextHand?: () => void;
}

function ReplayerView({
  replay,
  unit,
  playing,
  speed,
  onPlayingChange,
  speedControl,
  onPrevHand,
  onNextHand,
}: ReplayerViewProps) {
  const [index, setIndex] = useState(0);
  const { steps } = replay;
  const last = steps.length - 1;
  const step = steps[index];
  const prev = index > 0 ? steps[index - 1] : null;
  const { soundOn, toggleSound, setReplayerUnit } = useHandFilterStore();
  const shownIndex = useRef(index);

  useEffect(() => {
    if (soundOn) preloadSounds();
  }, [soundOn]);

  // Sounds only when advancing one step (not when jumping on the timeline or going back).
  useEffect(() => {
    const forward = index === shownIndex.current + 1;
    shownIndex.current = index;
    if (forward && soundOn) playStepSound(steps[index]);
  }, [index, soundOn, steps]);

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      onPlayingChange(false);
      return;
    }
    const slow = steps[index + 1].kind !== 'action';
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), ((slow ? 1.5 : 1) * BASE_DELAY_MS) / speed);
    return () => clearTimeout(timer);
  }, [playing, index, last, speed, steps, onPlayingChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, last));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === 'ArrowDown') onNextHand?.();
      else if (e.key === 'ArrowUp') onPrevHand?.();
      else if (e.key === ' ') onPlayingChange(!playing);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, playing, onPlayingChange, onNextHand, onPrevHand]);

  const togglePlay = () => {
    if (!playing && index >= last) setIndex(0);
    onPlayingChange(!playing);
  };

  const fmt = (v: number) => formatReplayAmount(v, replay, unit);
  const heroSeat = step.players.find((p) => p.isHero)?.seat ?? 1;
  const occupied = new Set(step.players.map((p) => p.seat));
  const emptySeats = Array.from({ length: replay.maxSeats }, (_, i) => i + 1).filter((s) => !occupied.has(s));
  const button = step.players.find((p) => p.isButton);
  const totalPot = step.pot + step.players.reduce((a, p) => a + p.bet, 0);
  const collecting = step.kind !== 'action' && step.kind !== 'init';

  return (
    <div className="flex flex-col">
      <div className="relative mx-auto aspect-[16/9] w-full max-w-5xl select-none">
        {/* Rail + felt */}
        <div
          className="absolute inset-x-[7%] inset-y-[13%] rounded-full p-[1.2%] shadow-2xl"
          style={{ background: 'linear-gradient(180deg, #3b4049, #1a1d22)' }}
        >
          <div
            className="size-full rounded-full shadow-[inset_0_0_50px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
            style={{ background: 'radial-gradient(ellipse at center, #2fbf72 0%, #1f9d58 50%, #147a41 100%)' }}
          />
        </div>

        {/* Pot */}
        <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={at({ x: 50, y: 61 })}>
          {totalPot > 0 && (
            <div className="rounded-full bg-black/45 px-3 py-0.5 text-xs font-semibold tabular-nums text-amber-200">
              Pot : {fmt(step.pot)}
              {totalPot !== step.pot && <span className="ml-2 font-normal text-white/60">(total {fmt(totalPot)})</span>}
            </div>
          )}
          {step.pots.length > 1 && (
            <div className="mt-1 flex justify-center gap-2 text-[10px] tabular-nums text-white/80">
              {step.pots.map((amount, i) => (
                <span key={i} className="rounded bg-black/35 px-1.5">
                  {i === 0 ? 'Principal' : `Side ${i}`} : {fmt(amount)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Board */}
        <div className="absolute flex -translate-x-1/2 -translate-y-1/2 gap-1.5" style={at(CENTER)}>
          {Array.from({ length: 5 }, (_, i) =>
            step.board[i] ? (
              <PlayingCard key={step.board[i]} card={step.board[i]} size="lg" className="animate-deal" />
            ) : (
              <div key={`slot-${i}`} className="h-[78px] w-14 rounded-md border border-dashed border-white/15" />
            ),
          )}
        </div>

        {/* Dealer button */}
        {button && (
          <div
            className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-[10px] font-bold text-zinc-900 shadow-md transition-all duration-700"
            style={at(onTable(seatAngle(button.seat, heroSeat, replay.maxSeats) - 0.32, 30, 27))}
          >
            D
          </div>
        )}

        {/* Bets: slide from the seat, then to the pot when the street ends */}
        {step.players.map((p, i) => {
          const angle = seatAngle(p.seat, heroSeat, replay.maxSeats);
          const seatPoint = onTable(angle, 41, 38);
          const prevBet = prev?.players[i]?.bet ?? 0;
          const flying = collecting && p.bet === 0 && prevBet > 0;
          const pos = p.bet > 0 ? onTable(angle, 26, 23) : flying ? CENTER : seatPoint;
          return (
            <div
              key={`bet-${p.seat}`}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 transition-all duration-500 ease-out"
              style={{ ...at(pos), opacity: p.bet > 0 ? 1 : 0 }}
            >
              <Chips />
              <span className="rounded bg-black/55 px-1.5 text-[11px] font-semibold tabular-nums text-white">
                {fmt(p.bet > 0 ? p.bet : prevBet)}
              </span>
            </div>
          );
        })}

        {/* Winnings: from the pot to the winner */}
        {step.players.map((p) => {
          const angle = seatAngle(p.seat, heroSeat, replay.maxSeats);
          const show = step.kind === 'payout' && p.won > 0;
          return (
            <div
              key={`won-${p.seat}`}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 transition-all duration-700 ease-out"
              style={{ ...at(show ? onTable(angle, 26, 23) : CENTER), opacity: show ? 1 : 0 }}
            >
              <Chips />
              <span className="rounded bg-emerald-600/90 px-1.5 text-[11px] font-semibold tabular-nums text-white">
                +{fmt(p.won)}
              </span>
            </div>
          );
        })}

        {emptySeats.map((seat) => (
          <div
            key={`empty-${seat}`}
            className="absolute flex h-10 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-dashed border-white/15 text-[10px] text-white/30"
            style={at(onTable(seatAngle(seat, heroSeat, replay.maxSeats), 41, 38))}
          >
            Siège {seat}
          </div>
        ))}

        {step.players.map((p) => (
          <Seat
            key={p.seat}
            player={p}
            point={onTable(seatAngle(p.seat, heroSeat, replay.maxSeats), 41, 38)}
            active={step.activeSeat === p.seat}
            showResult={step.kind === 'payout' || step.kind === 'showdown'}
            fmt={fmt}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 border-t px-5 py-4">
        <div className="flex min-h-[24px] items-center justify-between gap-3 text-sm">
          <span className="font-medium">{step.message}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {index} / {last}
          </span>
        </div>

        <div className="flex h-6 items-center gap-[3px]" role="group" aria-label="Progression">
          {steps.map((s, i) => {
            const style = stepStyle(s);
            return (
              <Fragment key={i}>
                {i > 0 && s.kind !== 'action' && <span className="mx-1 h-6 w-0.5 shrink-0 rounded bg-foreground/40" />}
                <div className="group relative flex h-6 min-w-[4px] flex-1 items-center">
                  <button
                    type="button"
                    aria-label={s.message}
                    onClick={() => setIndex(i)}
                    className={cn(
                      'h-2.5 w-full rounded-sm transition-all group-hover:h-4',
                      i <= index ? style.color : 'bg-muted',
                      i === index && 'h-4 ring-2 ring-ring ring-offset-1 ring-offset-card',
                    )}
                  />
                  <div
                    role="tooltip"
                    className={cn(
                      'pointer-events-none absolute bottom-full z-20 mb-2 whitespace-nowrap rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100',
                      i < 3 ? 'left-0' : i > last - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className={cn('size-2 rounded-full', style.color)} />
                      {style.label}
                    </div>
                    <div className="mt-0.5 text-zinc-300">{s.message}</div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1">
          {STREETS.map((s) => {
            const start = replay.streetStarts[s.value];
            return (
              <Button
                key={s.value}
                variant={step.street === s.value ? 'secondary' : 'ghost'}
                size="sm"
                disabled={start === undefined}
                onClick={() => start !== undefined && setIndex(start)}
              >
                {s.label}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={onPrevHand} disabled={!onPrevHand} title="Main précédente (↑)">
              <SkipBack />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index === 0}
              title="Action précédente (←)"
            >
              <ChevronLeft />
            </Button>
            <Button size="icon" onClick={togglePlay} title="Lecture / Pause (Espace)">
              {playing ? <Pause /> : <Play />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIndex((i) => Math.min(i + 1, last))}
              disabled={index >= last}
              title="Action suivante (→)"
            >
              <ChevronRight />
            </Button>
            <Button variant="outline" size="icon" onClick={onNextHand} disabled={!onNextHand} title="Main suivante (↓)">
              <SkipForward />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onPlayingChange(false);
                setIndex(0);
              }}
              title="Recommencer"
            >
              <RotateCcw />
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Segmented
              value={unit}
              options={[
                { value: 'stake', label: replay.isCash ? '€' : 'Jetons' },
                { value: 'bb', label: 'BB' },
              ]}
              onChange={setReplayerUnit}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              title={soundOn ? 'Couper le son' : 'Activer le son'}
              aria-pressed={soundOn}
            >
              {soundOn ? <Volume2 /> : <VolumeX />}
            </Button>
            Vitesse
            {speedControl}
          </div>
        </div>
      </div>
    </div>
  );
}

const STREET_NAMES: Record<ReplayStreet, string> = {
  preflop: 'Préflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

function stepStyle(step: ReplayerStep): { color: string; label: string } {
  if (step.kind === 'init') return { color: 'bg-zinc-400', label: 'Distribution' };
  if (step.kind === 'street') return { color: 'bg-zinc-400', label: STREET_NAMES[step.street] };
  if (step.kind === 'showdown') return { color: 'bg-zinc-400', label: 'Abattage' };
  if (step.kind === 'payout') return { color: 'bg-emerald-400', label: 'Gains' };
  if (step.allIn) return { color: 'bg-red-500', label: 'Tapis' };
  switch (step.action) {
    case 'fold':
      return { color: 'bg-zinc-600', label: 'Fold' };
    case 'check':
      return { color: 'bg-sky-500', label: 'Check' };
    case 'call':
      return { color: 'bg-emerald-600', label: 'Call' };
    case 'bet':
      return { color: 'bg-amber-500', label: 'Mise' };
    default:
      return { color: 'bg-amber-500', label: 'Relance' };
  }
}

function Chips() {
  return (
    <span className="relative inline-block h-4 w-4">
      <span className="absolute inset-0 translate-y-[3px] rounded-full border-2 border-dashed border-white bg-red-700" />
      <span className="absolute inset-0 rounded-full border-2 border-dashed border-white bg-blue-700" />
    </span>
  );
}

interface SeatProps {
  player: ReplayerPlayer;
  point: Point;
  active: boolean;
  showResult: boolean;
  fmt: (v: number) => string;
}

function Seat({ player: p, point, active, showResult, fmt }: SeatProps) {
  const faceDown = p.inHand && !p.folded && !p.cards;
  const winner = p.won > 0;
  return (
    <div
      className={cn(
        'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-opacity duration-300',
        (p.folded || !p.inHand) && 'opacity-45 grayscale',
      )}
      style={at(point)}
    >
      <div className="relative z-0 -mb-3 flex h-[62px] -space-x-4">
        {p.cards
          ? p.cards.map((c) => <PlayingCard key={c} card={c} className="animate-deal" />)
          : faceDown && [0, 1].map((i) => <PlayingCard key={i} faceDown className="animate-deal" />)}
      </div>
      <div
        className={cn(
          'relative z-10 min-w-[118px] max-w-[150px] rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-1 text-center shadow-lg ring-2 transition-all',
          active ? 'ring-amber-400' : winner && showResult ? 'ring-emerald-400' : 'ring-transparent',
          p.isHero && 'bg-zinc-800',
        )}
      >
        {p.position && (
          <span className="absolute -left-2 -top-2 rounded bg-sky-700 px-1 text-[9px] font-bold text-white">
            {p.position}
          </span>
        )}
        <div className={cn('truncate text-xs font-semibold', p.isHero ? 'text-amber-300' : 'text-white')}>{p.name}</div>
        <div className="text-xs tabular-nums text-zinc-300">{p.allIn && p.stack <= 0 ? 'All-in' : fmt(p.stack)}</div>
      </div>
      <div className="mt-0.5 h-4 text-[10px] font-semibold uppercase tracking-wide">
        {!p.inHand ? (
          <span className="text-white/60">Absent</span>
        ) : p.folded ? (
          <span className="text-red-300">Fold</span>
        ) : showResult && p.handDescription ? (
          <span className="normal-case text-emerald-200">{p.handDescription}</span>
        ) : p.lastAction ? (
          <span className={cn('rounded px-1', active ? 'bg-amber-400 text-black' : 'bg-black/50 text-white')}>
            {p.lastAction}
          </span>
        ) : null}
      </div>
    </div>
  );
}
