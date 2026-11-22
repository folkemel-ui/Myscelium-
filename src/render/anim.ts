// The shapes of the little animations: plain functions of time, so they can be tested.

export const SPROUT_TIME = 0.8; // seconds for a new mushroom to push up and settle
export const SQUASH_TIME = 0.6; // seconds for a bursting cap to squash and spring back
export const FLASH_TIME = 0.18; // seconds a beetle flashes when hit
export const FLIP_TIME = 0.35; // seconds for a beaten beetle to flip onto its back...
export const FADE_TIME = 1.1; // ...and then to fade away
export const SPARKLE_TIME = 0.75; // seconds for a nutrient sparkle to fly to the counter

// A new mushroom pushes up out of the ground, overshoots, and wobbles into place.
// t is seconds since it was planted; returns its horizontal and vertical scale.
export function sproutScale(t: number) {
  if (t <= 0) return { sx: 0.4, sy: 0 };
  if (t >= SPROUT_TIME) return { sx: 1, sy: 1 };
  const u = t / SPROUT_TIME;
  const UP = 0.6; // share of the time spent pushing up; the rest is a little wobble
  let sy: number;
  if (u < UP) {
    const v = u / UP - 1; // an "ease out back": rises past full height, then comes back to it
    sy = 1 + 2.9 * v ** 3 + 1.9 * v ** 2;
  } else {
    const w = (u - UP) / (1 - UP);
    sy = 1 + 0.06 * Math.sin(w * Math.PI * 2) * (1 - w);
  }
  return { sx: 0.4 + 0.6 * Math.min(1, sy) + (sy > 1 ? (1 - sy) * 0.5 : 0), sy };
}

// A bursting cap squashes down and springs back, bulging out sideways as it squashes.
export function squashScale(t: number) {
  if (t <= 0 || t >= SQUASH_TIME) return { sx: 1, sy: 1 };
  const sy = 1 - 0.38 * Math.exp(-7 * t) * Math.cos(16 * t);
  return { sx: 1 / Math.sqrt(sy), sy };
}

// How far a beetle's leg swings forward (+) or back (-), 0..1 of its reach. Legs move in two
// tripods: front and back on one side with the middle on the other.
export function legSwing(phase: number, leg: number, side: number) {
  const tripod = (leg + (side > 0 ? 1 : 0)) % 2;
  return Math.sin(phase + tripod * Math.PI);
}

// A beaten beetle: it flips over (its vertical scale goes 1 -> -1), then fades.
export function flip(t: number) {
  const f = Math.min(1, Math.max(0, t / FLIP_TIME));
  const turned = 0.5 - 0.5 * Math.cos(f * Math.PI);
  const fade = Math.min(1, Math.max(0, (t - FLIP_TIME) / FADE_TIME));
  return { scaleY: 1 - 2 * turned, alpha: 1 - fade, hop: Math.sin(f * Math.PI) * 4, done: t >= FLIP_TIME + FADE_TIME };
}

// Where a sparkle is on its arcing flight from a to b (t from 0 to 1), easing in.
export function sparkleAt(a: { x: number; y: number }, b: { x: number; y: number }, t: number, lift: number) {
  const u = Math.min(1, Math.max(0, t));
  const e = u * u * (3 - 2 * u);
  const cx = (a.x + b.x) / 2 + lift * 0.3;
  const cy = Math.min(a.y, b.y) - Math.abs(lift);
  const v = 1 - e;
  return { x: v * v * a.x + 2 * v * e * cx + e * e * b.x, y: v * v * a.y + 2 * v * e * cy + e * e * b.y };
}

// --- Spore particles ---

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  r: number;
  color: number;
  swirl: number; // turning speed, radians a second
}

export const SPORE_DRAG = 3.2; // how quickly spores slow down, per second

// The spores a cloud throws out: a ring of specks flying outwards and swirling, so most of them
// end up near the edge of the cloud's reach (range, in pixels).
export function sporeBurst(x: number, y: number, range: number, count: number, colors: number[], rand: () => number) {
  const out: Particle[] = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + rand() * 0.6;
    const reach = range * (0.35 + 0.7 * rand());
    // With drag D, a speed of reach * D carries a particle about `reach` before it stops.
    const speed = reach * SPORE_DRAG;
    out.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      age: 0,
      life: 0.55 + rand() * 0.45,
      r: 0.9 + rand() * 1.6,
      color: colors[Math.floor(rand() * colors.length)],
      swirl: (rand() < 0.5 ? -1 : 1) * (1.5 + rand() * 2),
    });
  }
  return out;
}

export function moveParticle(p: Particle, dt: number) {
  const turn = p.swirl * dt;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const vx = p.vx * c - p.vy * s;
  const vy = p.vx * s + p.vy * c;
  const keep = Math.exp(-SPORE_DRAG * dt);
  p.vx = vx * keep;
  p.vy = vy * keep;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.age += dt;
  return p.age < p.life;
}
