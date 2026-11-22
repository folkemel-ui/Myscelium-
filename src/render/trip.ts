// The trip: how the forest turns stranger and more colourful as the mycelium spreads. Plain numbers,
// tested; TripView draws them. `share` is how far towards the goal the player is (0 at the start,
// 1 at the goal).

// Four stages, each switching on new effects, reached at 25%, 50%, 75% and 100% of the goal.
export const STAGES = [
  { at: 0.25, name: 'The forest stirs', adds: 'shimmer' },
  { at: 0.5, name: 'Colours awaken', adds: 'ripples' },
  { at: 0.75, name: 'Everything breathes', adds: 'kaleidoscope edges' },
  { at: 1, name: 'The forest dreams', adds: 'all at full strength' },
] as const;

// How many stages have been reached (0..4).
export function stageFor(share: number) {
  let n = 0;
  for (const s of STAGES) if (share >= s.at - 1e-9) n++;
  return n;
}

// How far into the current stage the player is, 0..1, so effects fade in instead of popping.
export function stageStrength(share: number, stage: number) {
  if (stage <= 0) return 0;
  const from = STAGES[stage - 1].at;
  const to = STAGES[stage]?.at ?? from + 0.25;
  return Math.min(1, 0.35 + 0.65 * ((share - from) / (to - from)));
}

export const MAX_HUE = 28; // degrees the colours drift either way at the goal

// The slow drift of every colour round the colour wheel, in degrees, growing with the spread.
export function hueShift(clock: number, share: number) {
  const s = Math.min(1, Math.max(0, share));
  return (Math.sin(clock * 0.13) * 0.7 + Math.sin(clock * 0.31 + 1.7) * 0.3) * MAX_HUE * s * s;
}

// Glowing specks floating over the territory: a few at first, many near the goal.
export const MIN_FLOATERS = 12;
export const MAX_FLOATERS = 180;
export const floaterCount = (share: number) =>
  Math.round(MIN_FLOATERS + (MAX_FLOATERS - MIN_FLOATERS) * Math.min(1, Math.max(0, share)) ** 1.3);

// The wave that rolls out from the mother when a new stage is reached: how far (0..1 of the way
// across the map) and how bright, t seconds after.
export const STAGE_WAVE_TIME = 1.6;
export function stageWave(t: number) {
  if (t < 0 || t >= STAGE_WAVE_TIME) return null;
  const u = t / STAGE_WAVE_TIME;
  return { reach: 1 - (1 - u) ** 2, bright: (1 - u) ** 1.5, flash: Math.max(0, 1 - t / 0.5) };
}

// Ripples (from stage 2): a ring leaves the mother every RIPPLE_EVERY seconds and spreads for
// RIPPLE_LIFE seconds. Returns the rings alive at time t as 0..1 of their life.
export const RIPPLE_EVERY = 2.4;
export const RIPPLE_LIFE = 5;
export function ripplesAt(t: number) {
  const out: number[] = [];
  const newest = Math.floor(t / RIPPLE_EVERY);
  for (let k = newest; k >= 0 && t - k * RIPPLE_EVERY < RIPPLE_LIFE; k--) out.push((t - k * RIPPLE_EVERY) / RIPPLE_LIFE);
  return out;
}

// The colour band sweeping across the forest: where its middle is (0..1 across, then off the
// far side and round again) and which glow colour it is, every BAND_TIME seconds.
export const BAND_TIME = 9;
export function bandAt(clock: number) {
  const lap = clock / BAND_TIME;
  return { pos: (lap % 1) * 1.6 - 0.3, colour: Math.floor(lap) };
}
