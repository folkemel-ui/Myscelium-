import * as C from './constants';
import { HISTORY_EVERY, LOG_NUTRIENTS, MAP_H, MAP_W } from './constants';
import { makeRng, type Rng } from './rng';

export const TILE = { SOIL: 0, TREE: 1, ROCK: 2, LOG: 3, WATER: 4, BRIDGE: 5 } as const;
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
  ate: number; // tiles eaten; at its appetite it is full and walks off the map
  aim?: 'any' | 'mushroom' | 'mother'; // what it goes for (any: the nearest mycelium)
  maxHp?: number; // its health when it arrived (BEETLE_HP if missing)
  speed?: number; // tiles a second (BEETLE_SPEED if missing)
  appetite?: number; // tiles it eats before leaving (BEETLE_APPETITE if missing)
  born?: number; // when it arrived, in round seconds
  kind?: 'beetle' | 'bark'; // bark beetles go for mushrooms, are quicker and frailer
}

// A shelf fungus on a tree: makes nutrients while the network touches its tree.
export interface Shelf {
  id: number;
  x: number;
  y: number;
}

// A spore tower on the network: shoots the nearest beetle in range.
export interface Tower {
  id: number;
  x: number;
  y: number;
  timer: number; // seconds until it can shoot again
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
  burstCooldown: number; // seconds before a mushroom can burst again
  motherPuffInterval: number; // seconds between the mother's puffs
  motherPuffRange: number; // tiles
  rotSpeed: number; // nutrients a second from a covered log
  beetleNutrients: number; // from each beaten beetle
  mushroomCost: number; // nutrients
  startPatch: number; // the mother's patch reaches this many tiles out (1: 5 tiles, 2: 13)
}

export const DEFAULT_MODS: Mods = {
  growCost: C.GROW_COST,
  sporeBoost: 1,
  burstDamage: C.BURST_DAMAGE,
  burstRange: C.BURST_RANGE,
  creep: C.CREEP_PER_SECOND,
  eatTime: C.BEETLE_EAT_TIME,
  startSpores: C.START_SPORES,
  burstCooldown: C.BURST_COOLDOWN,
  motherPuffInterval: C.PUFF_INTERVAL,
  motherPuffRange: C.PUFF_RANGE,
  rotSpeed: C.ROT_PER_SECOND,
  beetleNutrients: C.BEETLE_NUTRIENTS,
  mushroomCost: C.MUSHROOM_COST,
  startPatch: 1,
};

// What a level does differently: when and how beetles come.
export interface LevelRules {
  firstBeetleAt: number; // seconds
  intervalStart: number; // seconds between swarms at the start...
  intervalMin: number; // ...and at the goal
  swarmMin: number; // beetles in a swarm, at least
  barkShare: number; // share of beetles that are bark beetles
  sides: [number, number, number, number]; // how likely a swarm comes from the left, right, top, bottom
}

export const LEVEL1_RULES: LevelRules = {
  firstBeetleAt: C.FIRST_BEETLE_AT,
  intervalStart: C.BEETLE_INTERVAL_START,
  intervalMin: C.BEETLE_INTERVAL_MIN,
  swarmMin: 1,
  barkShare: 0,
  sides: [0.25, 0.25, 0.25, 0.25],
};

export const PINE_RULES: LevelRules = {
  firstBeetleAt: 15,
  intervalStart: 6,
  intervalMin: 2,
  swarmMin: 2,
  barkShare: 0.25,
  sides: [0.04, 0.6, 0.18, 0.18], // mostly from the far side, away from the mother
};

export type Biome = 'wood' | 'pine';

// Counted over a round, for the end screen.
export interface RoundStats {
  grown: number; // tiles of mycelium grown by hand
  mushrooms: number; // mushrooms grown (not counting the mother)
  bursts: number; // mushrooms burst by clicking
  peakSpores: number; // the most spores a second
  mushroomsLost: number; // mushrooms eaten by beetles (not counting the mother)
  motherBitten: boolean; // a beetle started eating the mother
  threeQuartersAt: number | null; // when the share held first reached 3/4 of the goal
}

// Things that happened, for the drawing to show (a flash, a beetle flipping over). The view takes
// them as it draws; the game keeps only the latest MAX_EVENTS if nobody does.
export type GameEvent =
  | { kind: 'hit'; beetle: number; damage: number }
  | { kind: 'defeat'; beetle: number; x: number; y: number; nutrients: number }
  | { kind: 'shot'; tower: number; beetle: number; x: number; y: number; tx: number; ty: number }; // from and to, in tiles
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
  shelves: Shelf[];
  towers: Tower[];
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
  seed: number; // the level is made again from this when a saved round is loaded
  level: number; // which forest (1 The Little Wood, 2 Pine Hollow)
  biome: Biome; // how it looks
  rules: LevelRules;
}

export const idx = (g: Game, x: number, y: number) => y * g.w + x;
export const inside = (g: Game, x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h;
export const canHoldMycelium = (t: number) => t === TILE.SOIL || t === TILE.LOG || t === TILE.BRIDGE;

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

  return finishLevel({ w, h, tiles, noise, logNutrients, mx, my, seed, rng, mods, level: 1, biome: 'wood', rules: LEVEL1_RULES });
}

// The parts every level shares: the game itself, and the mother on a small patch of mycelium.
function finishLevel(p: {
  w: number; h: number; tiles: Uint8Array; noise: Float32Array; logNutrients: Float32Array; mx: number; my: number;
  seed: number; rng: Rng; mods: Mods; level: number; biome: Biome; rules: LevelRules;
}): Game {
  const { w, h, tiles, noise, logNutrients, mx, my, seed, rng, mods } = p;
  const n = w * h;
  const g: Game = {
    w, h, tiles, noise, logNutrients,
    mycelium: new Uint8Array(n),
    growable: 0,
    covered: 0,
    mushrooms: [],
    shelves: [],
    towers: [],
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
    stats: { grown: 0, mushrooms: 0, bursts: 0, peakSpores: 0, mushroomsLost: 0, motherBitten: false, threeQuartersAt: null },
    nextId: 1,
    version: 0,
    rng,
    seed,
    level: p.level,
    biome: p.biome,
    rules: p.rules,
  };
  // The mother mushroom and a patch of mycelium around her: the tiles up to startPatch steps away
  // (5 tiles, or 13 with Deep roots).
  const reach = mods.startPatch;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > reach || !inside(g, mx + dx, my + dy)) continue;
      const i = idx(g, mx + dx, my + dy);
      if (tiles[i] !== TILE.LOG && tiles[i] !== TILE.BRIDGE) tiles[i] = TILE.SOIL;
      g.mycelium[i] = 1;
    }
  }
  for (let i = 0; i < n; i++) if (canHoldMycelium(tiles[i])) g.growable++;
  g.covered = g.mycelium.reduce((s, v) => s + v, 0);
  g.history.push({ t: 0, held: g.covered / g.growable });
  g.nextSample = HISTORY_EVERY;
  g.mushrooms.push({ id: g.nextId++, x: mx, y: my, mother: true, puffTimer: 0, cooldown: 0 });
  return g;
}

// Where the stream runs, as a share of the way across: far enough left that the mother's bank holds
// well under half the ground, so the bridges must be crossed to win.
const STREAM_AT = 0.36;

// Level 2, Pine Hollow: a bigger pine forest split from top to bottom by a stream that mycelium
// can't cross except over a few fallen-log bridges. The mother starts near the left edge and the
// beetles come mostly from the right, so there is a front to hold. Fewer logs, but richer.
export function createPineHollow(seed = 1, mods: Mods = DEFAULT_MODS): Game {
  const rng = makeRng(seed ^ 0x5bd1e995);
  const w = C.PINE_W;
  const h = C.PINE_H;
  const n = w * h;
  const tiles = new Uint8Array(n);
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = rng();
  const mx = 6;
  const my = Math.floor(h / 2);
  const at = (x: number, y: number) => y * w + x;
  const near = (x: number, y: number, cx: number, cy: number, r: number) => Math.hypot(x - cx, y - cy) < r;

  // The stream: two tiles wide, winding gently; it never shifts more than a tile from one row to
  // the next, so there is no gap to slip through.
  const phase = rng() * Math.PI * 2;
  const streamX: number[] = [];
  let c = Math.round(w * STREAM_AT);
  for (let y = 0; y < h; y++) {
    const want = Math.round(w * STREAM_AT + Math.sin(y * 0.22 + phase) * 3);
    c += Math.sign(want - c);
    streamX.push(c);
    tiles[at(c - 1, y)] = TILE.WATER;
    tiles[at(c, y)] = TILE.WATER;
  }
  // Bridges: fallen logs across the stream, spread from top to bottom.
  const bridgeRows: number[] = [];
  for (let k = 0; k < C.PINE_BRIDGES; k++) {
    const y = Math.round(((k + 0.5) / C.PINE_BRIDGES) * h + (rng() - 0.5) * 3);
    bridgeRows.push(y);
    tiles[at(streamX[y] - 1, y)] = TILE.BRIDGE;
    tiles[at(streamX[y], y)] = TILE.BRIDGE;
  }
  const clear = (x: number, y: number) =>
    near(x, y, mx, my, 5) || bridgeRows.some((by) => Math.abs(y - by) <= 1 && Math.abs(x - streamX[by]) <= 3);
  const plant = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h || clear(x, y) || tiles[at(x, y)] !== TILE.SOIL) return;
    tiles[at(x, y)] = TILE.TREE;
  };

  // Pines grow in long rows and in clumps.
  for (let k = 0; k < 11; k++) {
    let x = rng() * w;
    let y = rng() * h;
    const angle = (rng() - 0.5) * 1.2 + (rng() < 0.5 ? 0 : Math.PI / 2);
    const length = 6 + Math.floor(rng() * 9);
    for (let s2 = 0; s2 < length; s2++) {
      if (rng() < 0.85) plant(Math.round(x), Math.round(y));
      if (rng() < 0.35) plant(Math.round(x + Math.sin(angle)), Math.round(y - Math.cos(angle)));
      x += Math.cos(angle);
      y += Math.sin(angle);
    }
  }
  for (let k = 0; k < 7; k++) {
    const cx = rng() * w;
    const cy = rng() * h;
    const r = 1.5 + rng() * 1.5;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r && rng() < 0.7) plant(x, y);
    }
  }
  // Rocks along the stream and scattered.
  for (let k = 0; k < 10; k++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    if (!clear(x, y) && tiles[at(x, y)] === TILE.SOIL) tiles[at(x, y)] = TILE.ROCK;
  }
  // Fewer logs than in the Little Wood, but each holds twice as much; two near the start.
  const logNutrients = new Float32Array(n);
  const logs: [number, number][] = [[mx + 4, my - 2], [mx + 2, my + 4]];
  while (logs.length < C.PINE_LOGS) logs.push([Math.floor(rng() * w), Math.floor(rng() * h)]);
  for (const [x, y] of logs) {
    if (x < 0 || y < 0 || x >= w || y >= h || tiles[at(x, y)] === TILE.WATER || tiles[at(x, y)] === TILE.BRIDGE) continue;
    tiles[at(x, y)] = TILE.LOG;
    logNutrients[at(x, y)] = C.PINE_LOG_NUTRIENTS;
  }
  return finishLevel({ w, h, tiles, noise, logNutrients, mx, my, seed, rng, mods, level: 2, biome: 'pine', rules: PINE_RULES });
}

// A level by its number.
export function createLevel(level: number, seed = 1, mods: Mods = DEFAULT_MODS): Game {
  return level === 2 ? createPineHollow(seed, mods) : createLevel1(seed, mods);
}
