import type { Position } from './types';

export const POSITIONS: Position[] = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
export const STEAL_POSITIONS: Position[] = ['CO', 'BTN', 'SB'];

/**
 * Positions of the players dealt in. Seats are walked clockwise from the button;
 * players between the big blind and the button are labelled UTG … MP … CO.
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
  others.forEach((s, i) => result.set(s.name, i === others.length - 1 ? 'CO' : i === 0 ? 'UTG' : 'MP'));
  return result;
}
