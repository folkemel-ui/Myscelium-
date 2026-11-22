import * as C from './constants';
import { HISTORY_EVERY, LOG_NUTRIENTS, MAP_H, MAP_W } from './constants';
import { makeRng, type Rng } from './rng';

export const TILE = { SOIL: 0, TREE: 1, ROCK: 2, LOG: 3 } as const;
export type Tile = (typeof TILE)[keyof typeof TILE];

export interface Mushroom {
  id: number;
  x: number;
  y: number;
  mother: boolean;
  puffTimer: number; // counts down to the next automatic puff
  cooldown: number; // seconds until it can burst again
}

export interface Beetle {
  id: number;
  x: number; // tile units; a tile's centre is at +0.5
  y: number;
  hp: number;
  target: number; // tile index it is heading for, -1 for none
  eatTimer: number;
  retarget: number;
  ate: number; // tiles eaten; at BEETLE_APPETITE it is full and walks off the map
}

// A spore cloud, for the drawing only.
export interface Puff {
  x: number;
  y: number;
  radius: number;
  age: number;
  big: boolean;
}

export type Status = 'playing' | 'won' | 'lost';

// The numbers a round plays with, which upgrades can change (see progress.ts).
export interface Mods {
  growCost: number; // spores per tile grown by hand
  sporeBoost: number; // mushrooms' spores are multiplied by this
  burstDamage: number;
  burstRange: number; // tiles
  creep: number; // tiles a second the network creeps out on its own
  eatTime: number; // seconds a beetle takes to eat a tile
  startSpores: number;
}

export const DEFAULT_MODS: Mods = {
  growCost: C.GROW_COST,
  sporeBoost: 1,
  burstDamage: C.BURST_DAMAGE,
  burstRange: C.BURST_RANGE,
  creep: C.CREEP_PER_SECOND,
  eatTime: C.BEETLE_EAT_TIME,
  startSpores: C.START_SPORES,
};

// Counted over a round, for the end screen.
export interface RoundStats {
  grown: number; // tiles of mycelium grown by hand
  mushrooms: number; // mushrooms grown (not counting the mother)
  bursts: number; // mushrooms burst by clicking
  peakSpores: number; // the most spores a second
}

// Things that happened, for the drawing to show (a flash, a beetle flipping over). The view takes
// them as it draws; the game keeps only the latest MAX_EVENTS if nobody does.
export type GameEvent =
  | { kind: 'hit'; beetle: number; damage: number }
  | { kind: 'defeat'; beetle: number; x: number; y: number; nutrients: number };
export const MAX_EVENTS = 200;

export interface Game {
  w: number;
  h: number;
  tiles: Uint8Array;
  mycelium: Uint8Array; // 1 where the network is
  logNutrients: Float32Array; // nutrients left in each rotting log
  noise: Float32Array; // a fixed 0..1 value per tile, for variety in the drawing
  growable: number; // how many tiles mycelium can cover
  covered: number;
  mushrooms: Mushroom[];
  beetles: Beetle[];
  puffs: Puff[];
  events: GameEvent[];
  spores: number;
  nutrients: number;
  time: number;
  nextBeetle: number;
  creep: number; // build-up towards the next tile of creep
  status: Status;
  kills: number;
  history: { t: number; held: number }[]; // the share of the forest held, every HISTORY_EVERY seconds
  nextSample: number;
  stats: RoundStats;
  mods: Mods;
  nextId: number;
  version: number; // goes up whenever tiles or the network change, so the ground is redrawn
  rng: Rng;
}

export const idx = (g: Game, x: number, y: number) => y * g.w + x;
export const inside = (g: Game, x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h;
export const canHoldMycelium = (t: number) => t === TILE.SOIL || t === TILE.LOG;

// Level 1: a small forest with clumps of trees, a few rocks and rotting logs, and the mother
// mushroom in the middle on a clear patch.
export function createLevel1(seed = 1, mods: Mods = DEFAULT_MODS): Game {
  const rng = makeRng(seed);
  const w = MAP_W;
  const h = MAP_H;
  const n = w * h;
  const tiles = new Uint8Array(n);
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = rng();
  const mx = Math.floor(w / 2);
  const my = Math.floor(h / 2);
  const nearMother = (x: number, y: number, r: number) => Math.hypot(x - mx, y - my) < r;

  // Clumps of trees.
  for (let c = 0; c < 16; c++) {
    const cx = Math.floor(rng() * w);
    const cy = Math.floor(rng() * h);
    const r = 1.5 + rng() * 2.5;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h || nearMother(x, y, 5)) continue;
        if (Math.hypot(x - cx, y - cy) <= r && rng() < 0.75) tiles[y * w + x] = TILE.TREE;
      }
    }
  }
  // Rocks.
  for (let k = 0; k < 14; k++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    if (!nearMother(x, y, 4)) tiles[y * w + x] = TILE.ROCK;
  }
  // Rotting logs: a few near the start so nutrients come early, more further out.
  const logs: [number, number][] = [[mx + 3, my - 1], [mx - 4, my + 2], [mx + 1, my + 4]];
  for (let k = 0; k < 14; k++) logs.push([Math.floor(rng() * w), Math.floor(rng() * h)]);
  const logNutrients = new Float32Array(n);
  for (const [x, y] of logs) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    tiles[y * w + x] = TILE.LOG;
    logNutrients[y * w + x] = LOG_NUTRIENTS;
  }

  const g: Game = {
    w, h, tiles, noise, logNutrients,
    mycelium: new Uint8Array(n),
    growable: 0,
    covered: 0,
    mushrooms: [],
    beetles: [],
    puffs: [],
    events: [],
    spores: mods.startSpores,
    mods,
    nutrients: 0,
    time: 0,
    nextBeetle: 0,
    creep: 0,
    status: 'playing',
    kills: 0,
    history: [],
    nextSample: 0,
    stats: { grown: 0, mushrooms: 0, bursts: 0, peakSpores: 0 },
    nextId: 1,
    version: 0,
    rng,
  };
  // The mother mushroom and a small patch of mycelium around her.
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const i = idx(g, mx + dx, my + dy);
    tiles[i] = TILE.SOIL;
    g.mycelium[i] = 1;
  }
  for (let i = 0; i < n; i++) if (canHoldMycelium(tiles[i])) g.growable++;
  g.covered = 5;
  g.history.push({ t: 0, held: g.covered / g.growable });
  g.nextSample = HISTORY_EVERY;
  g.mushrooms.push({ id: g.nextId++, x: mx, y: my, mother: true, puffTimer: 0, cooldown: 0 });
  return g;
}
