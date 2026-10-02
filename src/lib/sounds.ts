/** Table sound effects (Kenney.nl CC0 samples in public/sounds). */

const SAMPLES = {
  chipLay: ['chip-lay-1', 'chip-lay-2', 'chip-lay-3'],
  chipsStack: ['chips-stack-1', 'chips-stack-2', 'chips-stack-3'],
  chipsCollide: ['chips-collide-1', 'chips-collide-2'],
  chipsHandle: ['chips-handle-1', 'chips-handle-2'],
  cardShove: ['card-shove-1', 'card-shove-2', 'card-shove-3'],
  cardPlace: ['card-place-1', 'card-place-2', 'card-place-3'],
  cardSlide: ['card-slide-1', 'card-slide-2'],
  cardFan: ['card-fan-1'],
  knock: ['knock-1', 'knock-2'],
} as const;
type Sample = keyof typeof SAMPLES;

let context: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function load(ctx: AudioContext, file: string): Promise<AudioBuffer | null> {
  let buffer = buffers.get(file);
  if (!buffer) {
    buffer = fetch(`/sounds/${file}.ogg`)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null);
    buffers.set(file, buffer);
  }
  return buffer;
}

export function preloadSounds() {
  const ctx = audio();
  if (ctx) for (const files of Object.values(SAMPLES)) for (const f of files) void load(ctx, f);
}

/** Plays a random variant, slightly detuned so repeated actions don't sound identical. */
function play(sample: Sample, { delay = 0, volume = 1, variant }: { delay?: number; volume?: number; variant?: number } = {}) {
  const ctx = audio();
  if (!ctx) return;
  const files: readonly string[] = SAMPLES[sample];
  const file = files[variant ?? Math.floor(Math.random() * files.length)] ?? files[0];
  const requestedAt = ctx.currentTime;
  void load(ctx, file).then((buffer) => {
    if (!buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.95 + Math.random() * 0.1;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    src.start(Math.max(ctx.currentTime, requestedAt + delay));
  });
}

export function playCall() {
  play('chipLay');
}

export function playBet() {
  play('chipsStack');
}

export function playRaise() {
  play('chipsStack');
  play('chipLay', { delay: 0.14, volume: 0.8 });
}

export function playAllIn() {
  play('chipsHandle');
  play('chipsCollide', { delay: 0.18 });
}

export function playFold() {
  play('cardShove', { volume: 0.9 });
}

/** Double knuckle tap on the table. */
export function playCheck() {
  play('knock', { variant: 0, volume: 0.9 });
  play('knock', { variant: 1, delay: 0.14, volume: 0.7 });
}

export function playDeal(cards: number) {
  for (let i = 0; i < cards; i++) play('cardPlace', { delay: i * 0.16 });
}

export function playHoleCards() {
  play('cardSlide');
  play('cardSlide', { delay: 0.13 });
}

export function playReveal() {
  play('cardFan', { volume: 0.8 });
}

/** Pot pushed to the winner. */
export function playWin() {
  play('chipsHandle');
  play('chipsCollide', { delay: 0.25, volume: 0.8 });
}
