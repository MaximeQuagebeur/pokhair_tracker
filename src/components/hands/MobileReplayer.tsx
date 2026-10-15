'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Info, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { MiniCard, PlayingCard } from '@/components/hands/PlayingCard';
import { Chips, playStepSound, Seat, stepStyle, STREETS } from '@/components/hands/PokerTableReplayer';
import { fetchHandText, isCloudWeb } from '@/lib/cloud/client';
import { db } from '@/lib/db';
import { buildReplay, formatReplayAmount, type ReplayerHand, type ReplayUnit } from '@/lib/poker/actionEngine';
import { analyzeStep } from '@/lib/poker/coach';
import type { HandRecord } from '@/lib/poker/types';
import { preloadSounds } from '@/lib/sounds';
import { cn } from '@/lib/utils';
import { useHandFilterStore } from '@/stores/useHandFilterStore';

const STEP_DELAY_MS = 1100;
const SWIPE_PX = 40;

interface Point {
  x: number;
  y: number;
}
const CENTER: Point = { x: 50, y: 47 };
const at = (p: Point): CSSProperties => ({ left: `${p.x}%`, top: `${p.y}%` });

/** Same geometry as the desktop table, rotated: hero at the bottom, then clockwise. */
function seatAngle(seat: number, heroSeat: number, maxSeats: number) {
  const index = (((seat - heroSeat) % maxSeats) + maxSeats) % maxSeats;
  return Math.PI / 2 + (index * 2 * Math.PI) / maxSeats;
}
const squircle = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / 3);
const onTable = (angle: number, rx: number, ry: number): Point => ({
  x: 50 + rx * squircle(Math.cos(angle)),
  y: 50 + ry * squircle(Math.sin(angle)),
});
const SEAT_R = { x: 38, y: 40 };
const BET_R = { x: 24, y: 27 };

interface MobileReplayerProps {
  hand: HandRecord;
  /** "12 / 340" position in the filtered list. */
  counter?: string;
  onPrevHand?: () => void;
  onNextHand?: () => void;
}

/** Portrait replayer for phones: fills the viewport between the status bar and the floating tab bar. */
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
    <div className="relative mx-auto flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-6.75rem)] w-full max-w-[440px] flex-col gap-2 md:h-[calc(100dvh-2.5rem)]">
      <header className="flex shrink-0 items-center gap-1 rounded-2xl border bg-card/70 p-1 backdrop-blur">
        <IconButton label="Main précédente" onClick={onPrevHand} disabled={!onPrevHand}>
          <SkipBack className="size-5" />
        </IconButton>
        <div className="min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-1.5">
            {hand.heroCards.map((c) => (
              <MiniCard key={c} card={c} />
            ))}
            {hand.heroPosition && <span className="text-xs font-semibold text-muted-foreground">{hand.heroPosition}</span>}
            <span
              className={cn(
                'text-sm font-bold tabular-nums',
                hand.net > 0 ? 'text-emerald-500' : hand.net < 0 ? 'text-red-500' : 'text-muted-foreground',
              )}
            >
              {net}
            </span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {hand.limit} · {hand.table}
            {counter && ` · ${counter}`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setUnit(unit === 'bb' ? 'stake' : 'bb')}
          className="h-8 shrink-0 rounded-full bg-secondary px-2.5 text-xs font-semibold tabular-nums active:scale-95"
          aria-label="Changer d'unité"
        >
          {unit === 'bb' ? 'BB' : isCash ? '€' : 'Jetons'}
        </button>
        <IconButton label="Main suivante" onClick={onNextHand} disabled={!onNextHand}>
          <SkipForward className="size-5" />
        </IconButton>
      </header>

      {replay ? (
        <PortraitTable key={replay.id} replay={replay} unit={unit} />
      ) : (
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {missing ? 'Historique brut indisponible pour cette main.' : 'Chargement…'}
        </p>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:scale-90 active:bg-accent disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function PortraitTable({ replay, unit }: { replay: ReplayerHand; unit: ReplayUnit }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const { soundOn, toggleSound } = useHandFilterStore();
  const { steps } = replay;
  const last = steps.length - 1;
  const step = steps[index];
  const prev = index > 0 ? steps[index - 1] : null;
  const insight = useMemo(() => analyzeStep(replay, index, unit), [replay, index, unit]);
  const shownIndex = useRef(index);
  const touchX = useRef<number | null>(null);
  const fmt = (v: number) => formatReplayAmount(v, replay, unit);

  useEffect(() => {
    if (soundOn) preloadSounds();
  }, [soundOn]);

  useEffect(() => {
    const forward = index === shownIndex.current + 1;
    shownIndex.current = index;
    if (forward && soundOn) playStepSound(steps[index]);
  }, [index, soundOn, steps]);

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
  const seek = (i: number) => {
    setPlaying(false);
    setIndex(i);
  };
  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
  };

  const heroSeat = step.players.find((p) => p.isHero)?.seat ?? 1;
  const angleOf = (seat: number) => seatAngle(seat, heroSeat, replay.maxSeats);
  const occupied = new Set(step.players.map((p) => p.seat));
  const emptySeats = Array.from({ length: replay.maxSeats }, (_, i) => i + 1).filter((s) => !occupied.has(s));
  const button = step.players.find((p) => p.isButton);
  const totalPot = step.pot + step.players.reduce((a, p) => a + p.bet, 0);
  const collecting = step.kind !== 'action' && step.kind !== 'init';

  return (
    <>
      <div className="relative min-h-0 flex-1 select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Rail + felt: the desktop stadium table, stood upright */}
        <div
          className="absolute inset-x-[9%] inset-y-[6%] rounded-[999px] p-[2.5%] shadow-2xl"
          style={{ background: 'linear-gradient(90deg, #3b4049, #1a1d22)' }}
        >
          <div
            className="size-full rounded-[999px] shadow-[inset_0_0_50px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
            style={{ background: 'radial-gradient(ellipse at center, #2fbf72 0%, #1f9d58 50%, #147a41 100%)' }}
          />
        </div>

        {totalPot > 0 && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/45 px-3 py-0.5 text-xs font-semibold tabular-nums text-amber-200"
            style={at({ x: 50, y: CENTER.y + 11 })}
          >
            Pot : {fmt(step.pot)}
            {totalPot !== step.pot && <span className="ml-1 font-normal text-white/60">({fmt(totalPot)})</span>}
          </div>
        )}

        <div className="absolute flex -translate-x-1/2 -translate-y-1/2 gap-1" style={at(CENTER)}>
          {Array.from({ length: 5 }, (_, i) =>
            step.board[i] ? (
              <PlayingCard key={step.board[i]} card={step.board[i]} size="md" className="animate-deal" />
            ) : (
              <div key={`slot-${i}`} className="h-[62px] w-11 rounded-md border border-dashed border-white/15" />
            ),
          )}
        </div>

        {button && (
          <div
            className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-[9px] font-bold text-zinc-900 shadow-md transition-all duration-700"
            style={at(onTable(angleOf(button.seat) - 0.38, 30, 31))}
          >
            D
          </div>
        )}

        {step.players.map((p, i) => {
          const angle = angleOf(p.seat);
          const prevBet = prev?.players[i]?.bet ?? 0;
          const flying = collecting && p.bet === 0 && prevBet > 0;
          const pos = p.bet > 0 ? onTable(angle, BET_R.x, BET_R.y) : flying ? CENTER : onTable(angle, SEAT_R.x, SEAT_R.y);
          return (
            <div
              key={`bet-${p.seat}`}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 transition-all duration-500 ease-out"
              style={{ ...at(pos), opacity: p.bet > 0 ? 1 : 0 }}
            >
              <Chips />
              <span className="rounded bg-black/55 px-1 text-[10px] font-semibold tabular-nums text-white">
                {fmt(p.bet > 0 ? p.bet : prevBet)}
              </span>
            </div>
          );
        })}

        {step.players.map((p) => {
          const show = step.kind === 'payout' && p.won > 0;
          return (
            <div
              key={`won-${p.seat}`}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 transition-all duration-700 ease-out"
              style={{ ...at(show ? onTable(angleOf(p.seat), BET_R.x, BET_R.y) : CENTER), opacity: show ? 1 : 0 }}
            >
              <Chips />
              <span className="rounded bg-emerald-600/90 px-1 text-[10px] font-semibold tabular-nums text-white">
                +{fmt(p.won)}
              </span>
            </div>
          );
        })}

        {emptySeats.map((seat) => (
          <div
            key={`empty-${seat}`}
            className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/20"
            style={at(onTable(angleOf(seat), SEAT_R.x, SEAT_R.y))}
          />
        ))}

        {step.players.map((p) => (
          <Seat
            key={p.seat}
            compact
            player={p}
            point={onTable(angleOf(p.seat), SEAT_R.x, SEAT_R.y)}
            active={step.activeSeat === p.seat}
            showResult={step.kind === 'payout' || step.kind === 'showdown'}
            fmt={fmt}
          />
        ))}

        {/* Analysis: tap-to-open replacement for hover tooltips, follows the current step */}
        <section
          aria-live="polite"
          aria-hidden={!infoOpen}
          className={cn(
            'absolute inset-x-0 bottom-0 z-30 transition-all duration-300 ease-out',
            infoOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
          )}
        >
          <div
            className={cn(
              'rounded-2xl border bg-card/90 p-4 shadow-2xl backdrop-blur-xl',
              insight.tone === 'good' && 'border-emerald-500/50',
              insight.tone === 'warning' && 'border-amber-500/50',
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="font-semibold">{insight.title}</h2>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="-mr-2 -mt-1 flex size-9 items-center justify-center rounded-full text-muted-foreground active:bg-accent"
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
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex min-h-[20px] items-center justify-between gap-3 px-1 text-sm">
          <span className="truncate font-medium">{step.message}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {index} / {last}
          </span>
        </div>

        <div className="flex h-6 items-center gap-[2px]" role="group" aria-label="Progression">
          {steps.map((s, i) => (
            <Fragment key={i}>
              {i > 0 && s.kind !== 'action' && <span className="mx-0.5 h-5 w-0.5 shrink-0 rounded bg-foreground/40" />}
              <button
                type="button"
                aria-label={s.message}
                onClick={() => seek(i)}
                className="flex h-6 min-w-[3px] flex-1 items-center"
              >
                <span
                  className={cn(
                    'h-2 w-full rounded-sm transition-all',
                    i <= index ? stepStyle(s).color : 'bg-muted',
                    i === index && 'h-4 ring-2 ring-ring ring-offset-1 ring-offset-background',
                  )}
                />
              </button>
            </Fragment>
          ))}
        </div>

        <div className="flex gap-1">
          {STREETS.map((s) => {
            const start = replay.streetStarts[s.value];
            return (
              <button
                key={s.value}
                type="button"
                disabled={start === undefined}
                onClick={() => start !== undefined && seek(start)}
                className={cn(
                  'h-8 min-w-0 flex-1 truncate rounded-full px-1 text-[11px] font-medium transition-colors disabled:opacity-30',
                  step.street === s.value ? 'bg-secondary text-foreground' : 'text-muted-foreground',
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setInfoOpen((o) => !o)}
            aria-pressed={infoOpen}
            aria-label="Analyse de l'action"
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-full border transition active:scale-90',
              infoOpen ? 'border-primary bg-primary/15 text-primary' : 'text-muted-foreground',
            )}
          >
            <Info className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Action précédente"
            className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground transition active:scale-95 disabled:opacity-40"
          >
            <ChevronLeft className="size-7" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Lecture'}
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-90"
          >
            {playing ? <Pause className="size-7" /> : <Play className="ml-1 size-7" />}
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index >= last}
            aria-label="Action suivante"
            className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground transition active:scale-95 disabled:opacity-40"
          >
            <ChevronRight className="size-7" />
          </button>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Couper le son' : 'Activer le son'}
            className="flex size-12 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition active:scale-90"
          >
            {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
        </div>
      </div>
    </>
  );
}
