// Where things go on the forest floor and how they look: plain numbers, no drawing, so they can
// be tested. Everything comes from the level's own noise, so a forest always looks the same.
import { LOG_NUTRIENTS } from '../game/constants';
import { makeRng } from '../game/rng';
import { TILE, type Game } from '../game/world';

export const TS = 20; // pixels per tile, before the view is scaled to fit

// A steady 0..1 value for tile i and the k-th thing about it.
export function hash(g: Game, i: number, k: number) {
  const s = Math.sin(g.noise[i] * 9301.7 + k * 49.297 + i * 0.131) * 43758.5453;
  return s - Math.floor(s);
}

// A seeded random source for things scattered freely over the map (leaves, pebbles...).
export const forestRng = (g: Game) => makeRng(Math.floor(g.noise[0] * 2 ** 31) ^ 0x5eed);

// --- Trees ---

export interface Blob {
  dx: number;
  dy: number;
  r: number;
  light: number; // 0 dark .. 1 light
}

export interface Crown {
  x: number; // centre, in pixels
  y: number;
  r: number;
  green: number; // which green, an index into the canopy palette
  phase: number; // where in its sway it starts
  blobs: Blob[]; // the clumps of leaves that make up the crown, darkest first
  specks: Blob[]; // small glints of light on single leaves, mostly on the lit side
  edge: number; // turns the ring of small clumps round the rim, so crowns differ
  pine: boolean; // a pine seen from above: layered, star-shaped
}

export const PINE_GREENS = [0x1f4a3c, 0x24513f, 0x1c4436, 0x2a5a44, 0x234a46];

export const CANOPY_GREENS = [0x2f6b34, 0x3a7a35, 0x2c5f3f, 0x4a7f2e, 0x336a4a];

// One crown per tree tile, of different sizes and nudged off the grid, sorted top to bottom so
// lower crowns overlap the ones behind them.
export function crownLayout(g: Game): Crown[] {
  const crowns: Crown[] = [];
  for (let i = 0; i < g.tiles.length; i++) {
    if (g.tiles[i] !== TILE.TREE) continue;
    const tx = i % g.w;
    const ty = (i - tx) / g.w;
    const pine = g.biome === 'pine';
    const r = TS * (pine ? 0.55 + 0.22 * hash(g, i, 1) : 0.58 + 0.32 * hash(g, i, 1));
    const blobs: Blob[] = [];
    const count = 4 + Math.floor(hash(g, i, 2) * 3);
    for (let k = 0; k < count; k++) {
      const a = hash(g, i, 10 + k) * Math.PI * 2;
      const d = r * 0.45 * hash(g, i, 20 + k);
      blobs.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: r * (0.45 + 0.25 * hash(g, i, 30 + k)), light: k / count });
    }
    // The light comes from the top left, so the lighter clumps sit that way.
    for (const b of blobs) {
      b.dx -= b.light * r * 0.18;
      b.dy -= b.light * r * 0.18;
    }
    crowns.push({
      x: (tx + 0.5 + (hash(g, i, 3) - 0.5) * 0.35) * TS,
      y: (ty + 0.5 + (hash(g, i, 4) - 0.5) * 0.35) * TS,
      r,
      green: Math.floor(hash(g, i, 5) * CANOPY_GREENS.length),
      phase: hash(g, i, 6) * Math.PI * 2,
      blobs,
      specks: Array.from({ length: 9 }, (_, k) => {
        const a = Math.PI * (1 + 0.25 + (hash(g, i, 40 + k) - 0.5) * 1.6); // around the top left
        const d = r * 0.75 * Math.sqrt(hash(g, i, 50 + k));
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: 0.8 + hash(g, i, 60 + k) * 0.9, light: 1 };
      }),
      edge: hash(g, i, 7) * Math.PI * 2,
      pine,
    });
  }
  return crowns.sort((a, b) => a.y - b.y);
}

// How far a crown has swayed at time t: a small shift in pixels and a turn in radians.
export function sway(c: Crown, t: number) {
  return {
    dx: Math.sin(t * 0.7 + c.phase) * 0.7 + Math.sin(t * 1.9 + c.phase * 2) * 0.25,
    dy: Math.cos(t * 0.6 + c.phase) * 0.35,
    turn: Math.sin(t * 0.5 + c.phase) * 0.035,
  };
}

// --- Logs ---

export interface LogLook {
  rot: number; // 0 fresh .. 1 rotted away
  length: number; // share of its full length left
  crumbs: number; // bits of rotten wood around it
  stage: number; // the look changes in steps; redraw when any log's stage changes
}

export const LOG_STAGES = 8;

export function logLook(nutrientsLeft: number): LogLook {
  const left = Math.max(0, Math.min(1, nutrientsLeft / LOG_NUTRIENTS));
  const stage = Math.round((1 - left) * LOG_STAGES);
  const rot = stage / LOG_STAGES;
  return { rot, length: 1 - 0.55 * rot, crumbs: Math.round(rot * 7), stage };
}

// --- Rocks ---

// An irregular rock outline around a tile's centre, as points in pixels.
export function rockOutline(g: Game, i: number): number[] {
  const x = i % g.w;
  const cx = (x + 0.5) * TS;
  const cy = ((i - x) / g.w + 0.5) * TS;
  const sides = 6 + Math.floor(hash(g, i, 1) * 4);
  const big = 0.36 + 0.14 * hash(g, i, 2);
  const stretch = 0.8 + 0.4 * hash(g, i, 3);
  const pts: number[] = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2;
    const r = TS * big * (0.78 + 0.3 * hash(g, i, 10 + k));
    pts.push(cx + Math.cos(a) * r * stretch, cy + Math.sin(a) * r / stretch);
  }
  return pts;
}

// --- Things scattered on the floor ---

export interface Scatter {
  kind: 'leaf' | 'twig' | 'pebble' | 'tuft';
  x: number;
  y: number;
  size: number;
  angle: number;
  tone: number; // 0..1, picks a colour from the kind's palette
}

// Per tile on average: plenty of leaves, a few twigs, pebbles and tufts of grass.
export const SCATTER_PER_TILE = { leaf: 0.9, twig: 0.08, pebble: 0.1, tuft: 0.14 };

export function floorScatter(g: Game): Scatter[] {
  const rng = forestRng(g);
  const out: Scatter[] = [];
  for (const kind of ['leaf', 'twig', 'pebble', 'tuft'] as const) {
    const n = Math.round(g.w * g.h * SCATTER_PER_TILE[kind]);
    for (let k = 0; k < n; k++) {
      out.push({
        kind,
        x: rng() * g.w * TS,
        y: rng() * g.h * TS,
        size: 0.7 + rng() * 0.6,
        angle: rng() * Math.PI * 2,
        tone: rng(),
      });
    }
  }
  return out;
}

// --- Light through the leaves ---

export interface LightSpot {
  x: number; // where it starts, in pixels
  y: number;
  r: number;
  vx: number; // pixels a second
  vy: number;
  phase: number;
}

export function lightSpots(g: Game, count = 9): LightSpot[] {
  const rng = makeRng(Math.floor(g.noise[1] * 2 ** 31));
  return Array.from({ length: count }, () => ({
    x: rng() * g.w * TS,
    y: rng() * g.h * TS,
    r: TS * (2.5 + rng() * 3),
    vx: (rng() - 0.3) * 4,
    vy: (rng() - 0.5) * 2.5,
    phase: rng() * Math.PI * 2,
  }));
}

// Where a light spot is at time t, drifting slowly and wrapping round the map so the floor never
// runs out of light. Returns the centre and how bright it is now (0..1).
export function lightAt(s: LightSpot, t: number, width: number, height: number) {
  const span = (v: number, size: number) => {
    const m = size + 2 * s.r;
    return ((((v + s.r) % m) + m) % m) - s.r;
  };
  return {
    x: span(s.x + s.vx * t, width),
    y: span(s.y + s.vy * t, height),
    bright: 0.6 + 0.4 * Math.sin(t * 0.35 + s.phase),
  };
}

// The psychedelic colours the mycelium (and its mushrooms) glow in, picked per tile.
export const GLOW = [0xff4fd8, 0x4ff3ff, 0xb6ff4f, 0xffb84f, 0x9d6bff];

// The player's colour scheme: the five glow colours above are changed in place (everything that
// uses them reads them as it draws), and the mother's colour. Set before a round's drawing is made.
export const PALETTE = { mother: 0xff3d7f };
export function applyScheme(glow: number[], mother: number) {
  GLOW.splice(0, GLOW.length, ...glow);
  PALETTE.mother = mother;
}
export const glowAt = (noise: number) => GLOW[Math.floor(noise * GLOW.length) % GLOW.length];
