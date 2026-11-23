// The rules of the game: one step moves everything on by dt seconds. Plain TypeScript with no
// drawing, so it can be tested on its own.
import * as C from './constants';
import { canHoldMycelium, idx, inside, MAX_EVENTS, TILE, type Beetle, type Game, type GameEvent, type Mushroom, type Shelf, type Tower } from './world';

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export const coverage = (g: Game) => g.covered / g.growable;

export function sporesPerSecond(g: Game): number {
  let rate = g.covered * C.MYCELIUM_SPORES;
  for (const m of g.mushrooms) rate += (m.mother ? C.MOTHER_SPORES : C.MUSHROOM_SPORES) * g.mods.sporeBoost;
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
    else g.stats.mushroomsLost++;
    g.mushrooms.splice(k, 1);
  }
  const t = g.towers.findIndex((v) => idx(g, v.x, v.y) === i);
  if (t >= 0) g.towers.splice(t, 1);
}

export const mushroomAt = (g: Game, x: number, y: number): Mushroom | undefined =>
  g.mushrooms.find((m) => m.x === x && m.y === y);
export const towerAt = (g: Game, x: number, y: number): Tower | undefined => g.towers.find((t) => t.x === x && t.y === y);
export const shelfAt = (g: Game, x: number, y: number): Shelf | undefined => g.shelves.find((s) => s.x === x && s.y === y);

// A shelf makes nutrients only while the network still touches its tree.
export const shelfConnected = (g: Game, s: { x: number; y: number }) =>
  SIDES.some(([dx, dy]) => inside(g, s.x + dx, s.y + dy) && g.mycelium[idx(g, s.x + dx, s.y + dy)] === 1);

// --- What the player can do. Each returns null when it worked, or a reason it didn't. ---

export function growMycelium(g: Game, x: number, y: number): string | null {
  if (g.status !== 'playing') return 'The level is over';
  if (!canGrowAt(g, x, y)) return 'Mycelium can only grow next to your network, on open ground';
  if (g.spores < g.mods.growCost) return `Growing costs ${g.mods.growCost} spores`;
  g.spores -= g.mods.growCost;
  g.stats.grown++;
  addMycelium(g, idx(g, x, y));
  return null;
}

export function plantMushroom(g: Game, x: number, y: number): string | null {
  if (g.status !== 'playing') return 'The level is over';
  if (!inside(g, x, y) || !g.mycelium[idx(g, x, y)]) return 'Mushrooms grow on your mycelium';
  if (g.tiles[idx(g, x, y)] === TILE.LOG) return 'This log is still rotting';
  if (mushroomAt(g, x, y)) return 'There is a mushroom here already';
  if (towerAt(g, x, y)) return 'There is a spore tower here';
  if (g.nutrients < g.mods.mushroomCost) return `A mushroom costs ${g.mods.mushroomCost} nutrients`;
  g.nutrients -= g.mods.mushroomCost;
  g.stats.mushrooms++;
  g.mushrooms.push({ id: g.nextId++, x, y, mother: false, puffTimer: C.PUFF_INTERVAL, cooldown: 0 });
  return null;
}

// Swap spores for nutrients, or nutrients for spores.
export function digest(g: Game, into: 'nutrients' | 'spores'): string | null {
  if (g.status !== 'playing') return 'The level is over';
  if (into === 'nutrients') {
    if (g.spores < C.DIGEST_SPORES_IN) return `Digesting needs ${C.DIGEST_SPORES_IN} spores`;
    g.spores -= C.DIGEST_SPORES_IN;
    g.nutrients += C.DIGEST_NUTRIENTS_OUT;
  } else {
    if (g.nutrients < C.DIGEST_NUTRIENTS_IN) return `Digesting needs ${C.DIGEST_NUTRIENTS_IN} nutrients`;
    g.nutrients -= C.DIGEST_NUTRIENTS_IN;
    g.spores += C.DIGEST_SPORES_OUT;
  }
  return null;
}

// A shelf fungus on a tree that touches the network.
export function placeShelf(g: Game, x: number, y: number): string | null {
  if (g.status !== 'playing') return 'The level is over';
  if (!inside(g, x, y) || g.tiles[idx(g, x, y)] !== TILE.TREE) return 'Shelf fungus grows on trees';
  if (shelfAt(g, x, y)) return 'This tree has a shelf already';
  if (!shelfConnected(g, { x, y })) return 'The tree must touch your mycelium';
  if (g.nutrients < C.SHELF_COST) return `A shelf costs ${C.SHELF_COST} nutrients`;
  g.nutrients -= C.SHELF_COST;
  g.shelves.push({ id: g.nextId++, x, y });
  return null;
}

// A spore tower on the network.
export function buildTower(g: Game, x: number, y: number): string | null {
  if (g.status !== 'playing') return 'The level is over';
  if (!inside(g, x, y) || !g.mycelium[idx(g, x, y)]) return 'Towers grow on your mycelium';
  if (g.tiles[idx(g, x, y)] === TILE.LOG) return 'This log is still rotting';
  if (mushroomAt(g, x, y)) return 'There is a mushroom here';
  if (towerAt(g, x, y)) return 'There is a tower here already';
  if (g.nutrients < C.TOWER_NUTRIENTS || g.spores < C.TOWER_SPORES) {
    return `A tower costs ${C.TOWER_NUTRIENTS} nutrients and ${C.TOWER_SPORES} spores`;
  }
  g.nutrients -= C.TOWER_NUTRIENTS;
  g.spores -= C.TOWER_SPORES;
  g.towers.push({ id: g.nextId++, x, y, timer: 0 });
  return null;
}

export function burst(g: Game, x: number, y: number): string | null {
  if (g.status !== 'playing') return 'The level is over';
  const m = mushroomAt(g, x, y);
  if (!m) return 'Click a mushroom to burst it';
  if (m.cooldown > 0) return `Ready again in ${Math.ceil(m.cooldown)} s`;
  m.cooldown = g.mods.burstCooldown;
  g.stats.bursts++;
  sporeCloud(g, m.x + 0.5, m.y + 0.5, g.mods.burstRange, g.mods.burstDamage, true);
  return null;
}

// Ready mushrooms with a beetle within reach of their burst.
export function burstable(g: Game): Mushroom[] {
  return g.mushrooms.filter((m) => m.cooldown <= 0 && g.beetles.some((b) =>
    b.hp > 0 && Math.hypot(b.x - (m.x + 0.5), b.y - (m.y + 0.5)) <= g.mods.burstRange));
}

// Burst every ready mushroom that has a beetle within reach (one button, for thumbs mid-fight).
// Returns null when at least one burst, or a reason when none could.
export function burstAll(g: Game): string | null {
  if (g.status !== 'playing') return 'The level is over';
  const ready = burstable(g);
  if (ready.length === 0) {
    return g.mushrooms.some((m) => m.cooldown <= 0) ? 'No beetles near a ready mushroom' : 'No mushroom is ready to burst';
  }
  // One at a time: a beetle beaten by an earlier burst doesn't use up another mushroom.
  for (const m of ready) if (burstable(g).includes(m)) burst(g, m.x, m.y);
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
  towersShoot(g, dt);
  for (const s of g.shelves) if (shelfConnected(g, s)) g.nutrients += C.SHELF_NUTRIENTS * dt;

  const alive = g.beetles.filter((b) => b.hp > 0);
  for (const b of g.beetles) {
    if (b.hp > 0) continue;
    g.kills++;
    g.nutrients += g.mods.beetleNutrients;
    tell(g, { kind: 'defeat', beetle: b.id, x: b.x, y: b.y, nutrients: g.mods.beetleNutrients });
  }
  // Full beetles that have walked off the map are gone.
  g.beetles = alive.filter((b) => b.x > -1 && b.y > -1 && b.x < g.w + 1 && b.y < g.h + 1);

  if (g.status === 'playing' && coverage(g) >= C.WIN_COVERAGE) g.status = 'won';

  g.stats.peakSpores = Math.max(g.stats.peakSpores, sporesPerSecond(g));
  if (g.stats.threeQuartersAt === null && coverage(g) >= C.WIN_COVERAGE * 0.75) g.stats.threeQuartersAt = g.time;
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
    const taken = Math.min(g.logNutrients[i], g.mods.rotSpeed * dt);
    g.logNutrients[i] -= taken;
    g.nutrients += taken;
    if (g.logNutrients[i] <= 0) {
      g.tiles[i] = TILE.SOIL; // rotted away
      g.version++;
    }
  }
}

function creep(g: Game, dt: number) {
  g.creep += g.mods.creep * dt;
  while (g.creep >= 1) {
    g.creep -= 1;
    const edge: number[] = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (canGrowAt(g, x, y)) edge.push(idx(g, x, y));
    if (edge.length === 0) return;
    addMycelium(g, edge[Math.floor(g.rng() * edge.length)]);
  }
}

// Beetles come in from the edges, more often the more of the forest you hold, in small swarms
// that grow with the spread and the time; later beetles are tougher, faster and hungrier.
export function swarmSize(g: Game) {
  const share = Math.min(1, coverage(g) / C.WIN_COVERAGE);
  const most = Math.min(C.SWARM_MAX, 1 + 2 * share + g.time / 120);
  return Math.max(g.rules.swarmMin, Math.min(C.SWARM_MAX, 1 + Math.floor(g.rng() * most)));
}

export function newBeetle(g: Game, x: number, y: number): Beetle {
  const tough = Math.min(C.TOUGHER_MAX, Math.floor(g.time / C.TOUGHER_EVERY));
  const r = g.rng();
  const motherOk = g.time >= C.AIM_MOTHER_FROM; // none go for the mother in the first minute
  const aim = r < C.AIM_MOTHER ? (motherOk ? 'mother' : 'mushroom') : r < C.AIM_MOTHER + C.AIM_MUSHROOM ? 'mushroom' : 'any';
  // Bark beetles (some levels only; no random draw where there are none, so other levels play the
  // same) go for mushrooms, quicker and frailer.
  const bark = g.rules.barkShare > 0 && g.rng() < g.rules.barkShare;
  const hp = Math.max(2, C.BEETLE_HP + tough * C.TOUGHER_HP + (bark ? C.BARK_HP : 0));
  return {
    id: g.nextId++, x, y, hp, maxHp: hp, target: -1, eatTimer: 0, retarget: 0, ate: 0,
    aim: bark ? 'mushroom' : aim,
    kind: bark ? 'bark' : 'beetle',
    speed: C.BEETLE_SPEED * (1 + tough * C.TOUGHER_SPEED) * (bark ? C.BARK_SPEED : 1),
    appetite: C.BEETLE_APPETITE + Math.min(C.HUNGRIER_MAX, Math.floor(g.time / C.HUNGRIER_EVERY)),
    born: g.time,
  };
}

function spawnBeetles(g: Game) {
  const r = g.rules;
  if (g.time < r.firstBeetleAt || g.time < g.nextBeetle || g.beetles.length >= C.MAX_BEETLES) return;
  const share = Math.min(1, coverage(g) / C.WIN_COVERAGE);
  const interval = r.intervalStart - (r.intervalStart - r.intervalMin) * share;
  g.nextBeetle = g.time + interval;
  // Which side: left, right, top or bottom, by the level's weights.
  let pick = g.rng();
  let side = 0;
  while (side < 3 && pick >= r.sides[side]) pick -= r.sides[side++];
  const along = g.rng();
  const x = side === 0 ? -0.5 : side === 1 ? g.w + 0.5 : along * g.w;
  const y = side === 2 ? -0.5 : side === 3 ? g.h + 0.5 : along * g.h;
  const n = Math.min(swarmSize(g), C.MAX_BEETLES - g.beetles.length);
  for (let k = 0; k < n; k++) {
    // A swarm arrives bunched up along the edge.
    const off = (k - (n - 1) / 2) * 0.9;
    g.beetles.push(newBeetle(g, side < 2 ? x : x + off, side < 2 ? y + off : y));
  }
}

// What a beetle goes for: the mother, the nearest mushroom or tower, or the nearest mycelium.
function pickTarget(g: Game, b: Beetle): number {
  const mother = g.mushrooms.find((m) => m.mother);
  if (b.aim === 'mother' && mother && g.mycelium[idx(g, mother.x, mother.y)]) return idx(g, mother.x, mother.y);
  if (b.aim === 'mushroom') {
    let best = -1;
    let bestD = Infinity;
    for (const m of [...g.mushrooms, ...g.towers]) {
      if (('mother' in m && m.mother) || !g.mycelium[idx(g, m.x, m.y)]) continue;
      const d = (m.x + 0.5 - b.x) ** 2 + (m.y + 0.5 - b.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = idx(g, m.x, m.y);
      }
    }
    if (best >= 0) return best;
  }
  return nearestMycelium(g, b);
}

// The mushrooms and towers being eaten right now, and how far along (0..1) the beetle is.
export interface Attacked { x: number; y: number; mother: boolean; tower: boolean; progress: number }
export function underAttack(g: Game): Attacked[] {
  const out: Attacked[] = [];
  const things = [
    ...g.mushrooms.map((m) => ({ x: m.x, y: m.y, mother: m.mother, tower: false })),
    ...g.towers.map((t) => ({ x: t.x, y: t.y, mother: false, tower: true })),
  ];
  for (const m of things) {
    const tile = idx(g, m.x, m.y);
    let most = 0;
    for (const b of g.beetles) if (b.target === tile && b.eatTimer > 0) most = Math.max(most, b.eatTimer / eatTimeFor(g, tile));
    if (most > 0) out.push({ ...m, progress: Math.min(1, most) });
  }
  return out;
}

// How far along (0..1) the beetle furthest into eating this tile is; 0 when none is.
export function isEaten(g: Game, tile: number): number {
  let most = 0;
  for (const b of g.beetles) if (b.target === tile && b.eatTimer > 0) most = Math.max(most, b.eatTimer / eatTimeFor(g, tile));
  return Math.min(1, most);
}

// How long a tile takes to eat: mushrooms, and the mother most of all, hold out longer.
export function eatTimeFor(g: Game, tile: number) {
  const m = g.mushrooms.find((v) => idx(g, v.x, v.y) === tile);
  if (!m && g.towers.some((t) => idx(g, t.x, t.y) === tile)) return g.mods.eatTime * C.TOWER_EAT_FACTOR;
  return g.mods.eatTime * (!m ? 1 : m.mother ? C.MOTHER_EAT_FACTOR : C.MUSHROOM_EAT_FACTOR);
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

// Walk to what it goes for (crawling over anything in the way) and eat it.
function moveBeetle(g: Game, b: Beetle, dt: number) {
  if (b.ate >= (b.appetite ?? C.BEETLE_APPETITE)) return leave(g, b, dt);
  b.retarget -= dt;
  const keen = b.aim === 'mother' || b.aim === 'mushroom'; // these don't get distracted on the way
  if (b.target < 0 || !g.mycelium[b.target] || (!keen && b.retarget <= 0 && b.eatTimer === 0)) {
    b.target = pickTarget(g, b);
    b.retarget = 2;
    b.eatTimer = 0;
  }
  if (b.target < 0) return;
  const tx = (b.target % g.w) + 0.5;
  const ty = Math.floor(b.target / g.w) + 0.5;
  const d = Math.hypot(tx - b.x, ty - b.y);
  if (d > 0.15) {
    const move = Math.min(d, (b.speed ?? C.BEETLE_SPEED) * dt);
    b.x += ((tx - b.x) / d) * move;
    b.y += ((ty - b.y) / d) * move;
    return;
  }
  b.eatTimer += dt;
  if (!g.stats.motherBitten && g.mushrooms.some((m) => m.mother && idx(g, m.x, m.y) === b.target)) g.stats.motherBitten = true;
  if (b.eatTimer >= eatTimeFor(g, b.target)) {
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
  b.x += ((tx - b.x) / d) * (b.speed ?? C.BEETLE_SPEED) * dt;
  b.y += ((ty - b.y) / d) * (b.speed ?? C.BEETLE_SPEED) * dt;
}

function mushroomsPuff(g: Game, dt: number) {
  for (const m of g.mushrooms) {
    m.cooldown = Math.max(0, m.cooldown - dt);
    m.puffTimer -= dt;
    if (m.puffTimer > 0) continue;
    const cx = m.x + 0.5;
    const cy = m.y + 0.5;
    const range = m.mother ? g.mods.motherPuffRange : C.PUFF_RANGE;
    if (!g.beetles.some((b) => b.hp > 0 && Math.hypot(b.x - cx, b.y - cy) <= range)) continue;
    m.puffTimer = m.mother ? g.mods.motherPuffInterval : C.PUFF_INTERVAL;
    sporeCloud(g, cx, cy, range, C.PUFF_DAMAGE, false);
  }
}

// Each tower shoots a spore bolt at the nearest living beetle in range, once a second.
function towersShoot(g: Game, dt: number) {
  for (const t of g.towers) {
    t.timer = Math.max(0, t.timer - dt);
    if (t.timer > 0) continue;
    const cx = t.x + 0.5;
    const cy = t.y + 0.5;
    let best: Beetle | undefined;
    let bestD = C.TOWER_RANGE;
    for (const b of g.beetles) {
      if (b.hp <= 0) continue;
      const d = Math.hypot(b.x - cx, b.y - cy);
      if (d <= bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!best) continue;
    t.timer = C.TOWER_INTERVAL;
    best.hp -= C.TOWER_DAMAGE;
    tell(g, { kind: 'shot', tower: t.id, beetle: best.id, x: cx, y: cy, tx: best.x, ty: best.y });
    tell(g, { kind: 'hit', beetle: best.id, damage: C.TOWER_DAMAGE });
  }
}
