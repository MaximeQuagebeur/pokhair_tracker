import { SUIT_SYMBOLS } from '@/lib/poker/cards';
import { cn } from '@/lib/utils';

/** Four-colour deck. */
const SUIT_COLORS: Record<string, string> = { s: '#1f2937', h: '#dc2626', d: '#2563eb', c: '#15803d' };

const SIZES = {
  sm: 'w-8 h-[45px]',
  md: 'w-11 h-[62px]',
  lg: 'w-14 h-[78px]',
} as const;

const rankLabel = (card: string) => (card[0]?.toUpperCase() === 'T' ? '10' : (card[0]?.toUpperCase() ?? '?'));
const suitOf = (card: string) => card[1]?.toLowerCase() ?? 's';

interface PlayingCardProps {
  /** Winamax token ("Qs", "Td"). Omitted or `faceDown` renders the back. */
  card?: string | null;
  faceDown?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}

export function PlayingCard({ card, faceDown, size = 'md', className }: PlayingCardProps) {
  const classes = cn('shrink-0 drop-shadow-md', SIZES[size], className);
  if (!card || faceDown) {
    return (
      <svg viewBox="0 0 60 84" className={classes} aria-label="Carte cachée">
        <defs>
          <pattern id="card-back" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#7f1d1d" />
            <rect width="4" height="8" fill="#991b1b" />
          </pattern>
        </defs>
        <rect x="0.5" y="0.5" width="59" height="83" rx="6" fill="#fafafa" stroke="#d4d4d8" />
        <rect x="4" y="4" width="52" height="76" rx="4" fill="url(#card-back)" />
        <rect x="4" y="4" width="52" height="76" rx="4" fill="none" stroke="#fecaca" strokeOpacity="0.5" />
      </svg>
    );
  }
  const suit = suitOf(card);
  const color = SUIT_COLORS[suit] ?? '#000';
  const rank = rankLabel(card);
  return (
    <svg viewBox="0 0 60 84" className={classes} aria-label={card}>
      <rect x="0.5" y="0.5" width="59" height="83" rx="6" fill="#ffffff" stroke="#d4d4d8" />
      <text x="6" y="24" fontSize={rank.length > 1 ? 20 : 24} fontWeight="700" fill={color} fontFamily="ui-sans-serif, system-ui">
        {rank}
      </text>
      <text x="7" y="42" fontSize="16" fill={color}>
        {SUIT_SYMBOLS[suit]}
      </text>
      <text x="54" y="76" fontSize="34" textAnchor="end" fill={color}>
        {SUIT_SYMBOLS[suit]}
      </text>
    </svg>
  );
}

/** Compact coloured tile for tables and lists. */
export function MiniCard({ card }: { card: string }) {
  const suit = suitOf(card);
  return (
    <span
      className="inline-flex h-5 min-w-[26px] items-center justify-center rounded-[3px] px-1 font-mono text-[11px] font-semibold text-white"
      style={{ backgroundColor: SUIT_COLORS[suit] }}
    >
      {rankLabel(card)}
      {SUIT_SYMBOLS[suit]}
    </span>
  );
}
