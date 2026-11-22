// The rules of the game: one step moves everything on by dt seconds. Plain TypeScript with no
// drawing, so it can be tested on its own.
import * as C from './constants';
import { canHoldMycelium, idx, inside, MAX_EVENTS, TILE, type Beetle, type Game, type GameEvent, type Mushroom } from './world';

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export const coverage = (g: Game) => g.covered / g.growable;

export function sporesPerSecond(g: Game): number {
  let rate = g.covered * C.MYCELIUM_SPORES;
  for (const m of g.mushrooms) rate += m.mother ? C.MOTHER_SPORES : C.MUSHROOM_SPORES;
  return rate;
}

// A tile the network can grow into: holds mycelium, has none yet, and touches the network.
export function canGrowAt(g: Game, x: number, y: number): boolean {
  if (!inside(g, x, y)) return false;
  const i = idx(g, x, y);
  if (g.mycelium[i] || !canHoldMycelium(g.tiles[i])) return false;
  return SIDES.some(([dx, dy]) => inside(g, x + dx, y + dy) && g.mycelium[idx(g, x + dx, y + dy)] === 1);
}

function addMycelium(g: Game, i: number) {
  g.mycelium[i] = 1;
  g.covered++;
  g.version++;
}

function removeMycelium(g: Game, i: number) {
  g.mycelium[i] = 0;
  g.covered--;
  g.version++;
  const k = g.mushrooms.findIndex((m) => idx(g, m.x, m.y) === i);
  if (k >= 0) {
    if (g.mushrooms[k].mother) g.status = 'lost';
    g.mushrooms.splice(k, 1);
  }
}

export const mushroomAt = (g: Game, x: number, y: number): Mushroom | undefined =>
  g.mushrooms.find((m) => m.x === x && m.y === y);

// --- What the player can do. Each returns null when it worked, or a reason it didn't. ---

export function growMycelium(g: Game, x: number, y: number): string | null {
  if (g.status !== 'playing') return 'The level is over';
  if (!canGrowAt(g, x, y)) return 'Mycelium can only grow next to your network, on open ground';
  if (g.spores < C.GROW_COST) return `Growing costs ${C.GROW_COST} spores`;
  g.spores -= C.GROW_COST;
  g.stats.grown++;
  addMycelium(g, idx(g, x, y));
  return null;
}

export function plantMushroom(g: Game, x: number, y: number): string | null {
  if (g.status !== 'playing') return 'The level is over';
  if (!inside(g, x, y) || !g.mycelium[idx(g, x, y)]) return 'Mushrooms grow on your mycelium';
  if (g.tiles[idx(g, x, y)] === TILE.LOG) return 'This log is still rotting';
  if (mushroomAt(g, x, y)) return 'There is a mushroom here already';
  if (g.nutrients < C.MUSHROOM_COST) return `A mushroom costs ${C.MUSHROOM_COST} nutrients`;
  g.nutrients -= C.MUSHROOM_COST;
  g.stats.mushrooms++;
  g.mushrooms.push({ id: g.nextId++, x, y, mother: false, puffTimer: C.PUFF_INTERVAL, cooldown: 0 });
  return null;
}

export function burst(g: Game, x: number, y: number): string | null {
  if (g.status !== 'playing') return 'The level is over';
  const m = mushroomAt(g, x, y);
  if (!m) return 'Click a mushroom to burst it';
  if (m.cooldown > 0) return `Ready again in ${Math.ceil(m.cooldown)} s`;
  m.cooldown = C.BURST_COOLDOWN;
  g.stats.bursts++;
  sporeCloud(g, m.x + 0.5, m.y + 0.5, C.BURST_RANGE, C.BURST_DAMAGE, true);
  return null;
}

function sporeCloud(g: Game, cx: number, cy: number, range: number, damage: number, big: boolean) {
  g.puffs.push({ x: cx, y: cy, radius: range, age: 0, big });
  for (const b of g.beetles) {
    if (b.hp <= 0 || Math.hypot(b.x - cx, b.y - cy) > range) continue;
    b.hp -= damage;
    tell(g, { kind: 'hit', beetle: b.id, damage });
  }
}

function tell(g: Game, e: GameEvent) {
  g.events.push(e);
  if (g.events.length > MAX_EVENTS) g.events.splice(0, g.events.length - MAX_EVENTS);
}

// --- The step ---

export function step(g: Game, dt: number) {
  for (const p of g.puffs) p.age += dt;
  g.puffs = g.puffs.filter((p) => p.age < 0.7);
  if (g.status !== 'playing') return;
  g.time += dt;

  g.spores += sporesPerSecond(g) * dt;
  rotLogs(g, dt);
  creep(g, dt);
  spawnBeetles(g);
  for (const b of g.beetles) moveBeetle(g, b, dt);
  mushroomsPuff(g, dt);

  const alive = g.beetles.filter((b) => b.hp > 0);
  for (const b of g.beetles) {
    if (b.hp > 0) continue;
    g.kills++;
    g.nutrients += C.BEETLE_NUTRIENTS;
    tell(g, { kind: 'defeat', beetle: b.id, x: b.x, y: b.y, nutrients: C.BEETLE_NUTRIENTS });
  }
  // Full beetles that have walked off the map are gone.
  g.beetles = alive.filter((b) => b.x > -1 && b.y > -1 && b.x < g.w + 1 && b.y < g.h + 1);

  if (g.status === 'playing' && coverage(g) >= C.WIN_COVERAGE) g.status = 'won';

  g.stats.peakSpores = Math.max(g.stats.peakSpores, sporesPerSecond(g));
  if (g.time >= g.nextSample || g.status !== 'playing') {
    g.history.push({ t: g.time, held: coverage(g) });
    g.nextSample += C.HISTORY_EVERY;
    if (g.history.length > C.HISTORY_MAX) g.history = g.history.filter((_, k) => k % 2 === 0 || k === g.history.length - 1);
  }
}

// The mushroom nearest to (x, y), in tiles, that is ready to burst.
export function nearestReadyMushroom(g: Game, x: number, y: number): Mushroom | undefined {
  let best: Mushroom | undefined;
  let bestD = Infinity;
  for (const m of g.mushrooms) {
    if (m.cooldown > 0) continue;
    const d = Math.hypot(m.x + 0.5 - x, m.y + 0.5 - y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

function rotLogs(g: Game, dt: number) {
  for (let i = 0; i < g.tiles.length; i++) {
    if (g.tiles[i] !== TILE.LOG || !g.mycelium[i]) continue;
    const taken = Math.min(g.logNutrients[i], C.ROT_PER_SECOND * dt);
    g.logNutrients[i] -= taken;
    g.nutrients += taken;
    if (g.logNutrients[i] <= 0) {
      g.tiles[i] = TILE.SOIL; // rotted away
      g.version++;
    }
  }
}

function creep(g: Game, dt: number) {
  g.creep += C.CREEP_PER_SECOND * dt;
  while (g.creep >= 1) {
    g.creep -= 1;
    const edge: number[] = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (canGrowAt(g, x, y)) edge.push(idx(g, x, y));
    if (edge.length === 0) return;
    addMycelium(g, edge[Math.floor(g.rng() * edge.length)]);
  }
}

// Beetles come in from the edges, more often the more of the forest you hold.
function spawnBeetles(g: Game) {
  if (g.time < C.FIRST_BEETLE_AT || g.time < g.nextBeetle || g.beetles.length >= C.MAX_BEETLES) return;
  const share = Math.min(1, coverage(g) / C.WIN_COVERAGE);
  const interval = C.BEETLE_INTERVAL_START - (C.BEETLE_INTERVAL_START - C.BEETLE_INTERVAL_MIN) * share;
  g.nextBeetle = g.time + interval;
  const side = Math.floor(g.rng() * 4);
  const along = g.rng();
  const x = side === 0 ? -0.5 : side === 1 ? g.w + 0.5 : along * g.w;
  const y = side === 2 ? -0.5 : side === 3 ? g.h + 0.5 : along * g.h;
  g.beetles.push({ id: g.nextId++, x, y, hp: C.BEETLE_HP, target: -1, eatTimer: 0, retarget: 0, ate: 0 });
}

function nearestMycelium(g: Game, b: Beetle): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < g.mycelium.length; i++) {
    if (!g.mycelium[i]) continue;
    const x = i % g.w;
    const d = (x + 0.5 - b.x) ** 2 + ((i - x) / g.w + 0.5 - b.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// Walk to the nearest mycelium (crawling over anything in the way) and eat it.
function moveBeetle(g: Game, b: Beetle, dt: number) {
  if (b.ate >= C.BEETLE_APPETITE) return leave(g, b, dt);
  b.retarget -= dt;
  if (b.target < 0 || !g.mycelium[b.target] || (b.retarget <= 0 && b.eatTimer === 0)) {
    b.target = nearestMycelium(g, b);
    b.retarget = 2;
    b.eatTimer = 0;
  }
  if (b.target < 0) return;
  const tx = (b.target % g.w) + 0.5;
  const ty = Math.floor(b.target / g.w) + 0.5;
  const d = Math.hypot(tx - b.x, ty - b.y);
  if (d > 0.15) {
    const move = Math.min(d, C.BEETLE_SPEED * dt);
    b.x += ((tx - b.x) / d) * move;
    b.y += ((ty - b.y) / d) * move;
    return;
  }
  b.eatTimer += dt;
  if (b.eatTimer >= C.BEETLE_EAT_TIME) {
    removeMycelium(g, b.target);
    b.ate++;
    b.target = -1;
    b.eatTimer = 0;
  }
}

// A full beetle heads straight for the nearest edge of the map.
function leave(g: Game, b: Beetle, dt: number) {
  const exits = [[b.x, -2], [b.x, g.h + 2], [-2, b.y], [g.w + 2, b.y]];
  const [tx, ty] = exits.reduce((a, e) => (Math.hypot(e[0] - b.x, e[1] - b.y) < Math.hypot(a[0] - b.x, a[1] - b.y) ? e : a));
  const d = Math.hypot(tx - b.x, ty - b.y);
  b.x += ((tx - b.x) / d) * C.BEETLE_SPEED * dt;
  b.y += ((ty - b.y) / d) * C.BEETLE_SPEED * dt;
}

function mushroomsPuff(g: Game, dt: number) {
  for (const m of g.mushrooms) {
    m.cooldown = Math.max(0, m.cooldown - dt);
    m.puffTimer -= dt;
    if (m.puffTimer > 0) continue;
    const cx = m.x + 0.5;
    const cy = m.y + 0.5;
    if (!g.beetles.some((b) => b.hp > 0 && Math.hypot(b.x - cx, b.y - cy) <= C.PUFF_RANGE)) continue;
    m.puffTimer = C.PUFF_INTERVAL;
    sporeCloud(g, cx, cy, C.PUFF_RANGE, C.PUFF_DAMAGE, false);
  }
}
