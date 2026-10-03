import type { Position } from './types';

/** Preflop action order. */
export const POSITIONS: Position[] = ['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const STEAL_POSITIONS: Position[] = ['CO', 'BTN', 'SB'];

/**
 * Positions of the players dealt in. Seats are walked clockwise from the button;
 * players between the big blind and the button are labelled from the button backwards
 * (CO, HJ, then UTG … MP), so short-handed tables drop the earliest positions first.
 */
export function assignPositions(
  seats: { seat: number; name: string }[],
  buttonSeat: number,
  smallBlind?: string,
  bigBlind?: string,
): Map<string, Position> {
  const sorted = [...seats].sort((a, b) => a.seat - b.seat);
  const start = sorted.findIndex((s) => s.seat > buttonSeat);
  const clockwise = start < 0 ? sorted : [...sorted.slice(start), ...sorted.slice(0, start)];
  const result = new Map<string, Position>();
  const button = clockwise.find((s) => s.seat === buttonSeat)?.name;
  if (button) result.set(button, 'BTN');
  if (smallBlind && !result.has(smallBlind)) result.set(smallBlind, 'SB');
  if (bigBlind && !result.has(bigBlind)) result.set(bigBlind, 'BB');
  const others = clockwise.filter((s) => !result.has(s.name));
  others.forEach((s, i) => {
    const fromButton = others.length - 1 - i;
    result.set(s.name, fromButton === 0 ? 'CO' : fromButton === 1 ? 'HJ' : i === 0 ? 'UTG' : 'MP');
  });
  return result;
}
