// Scripted players, to see how long level 1 takes and how much of a threat the beetles are.
// Not a real test: prints numbers. Three players on five maps:
//   - sharp: acts every second, bursts every mushroom that has a beetle near (a perfect player);
//   - casual: acts every 3 seconds, bursts at most one mushroom each time (more like a person);
//   - builder: plays like casual, and also grows shelf fungus on trees and builds spore towers
//     (to check the things to build are worth their price);
//   - idle: nobody playing at all.
import { test } from 'vitest';
import * as C from './constants';
import { buildTower, burst, canGrowAt, coverage, growMycelium, placeShelf, plantMushroom, shelfConnected, step } from './sim';
import { createLevel, idx, TILE, type Game } from './world';

function play(level: number, seed: number, every: number, burstsPerTurn: number, builds = false) {
  const g = createLevel(level, seed);
  let eaten = 0;
  let lostMushrooms = 0;
  let turn = 0;
  while (g.status === 'playing' && g.time < 1800) {
    const covered = g.covered;
    const shrooms = g.mushrooms.length;
    step(g, 0.1);
    if (g.covered < covered) eaten += covered - g.covered;
    if (g.mushrooms.length < shrooms) lostMushrooms += shrooms - g.mushrooms.length;
    if (g.time < turn) continue;
    turn = g.time + every;
    if (builds) build(g);
    act(g, burstsPerTurn);
  }
  return { g, eaten, lostMushrooms };
}

function act(g: Game, burstsPerTurn: number) {
  // Grow towards logs first, then anywhere: as much as the spores allow.
  const edge: number[] = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (canGrowAt(g, x, y)) edge.push(idx(g, x, y));
  edge.sort((a, b) => (g.tiles[b] === TILE.LOG ? 1 : 0) - (g.tiles[a] === TILE.LOG ? 1 : 0) || g.noise[a] - g.noise[b]);
  for (const i of edge) if (growMycelium(g, i % g.w, Math.floor(i / g.w))) break;
  if (g.nutrients >= C.MUSHROOM_COST) {
    for (let i = 0; i < g.tiles.length; i++) {
      if (g.mycelium[i] && g.noise[i] > 0.5 && !plantMushroom(g, i % g.w, Math.floor(i / g.w))) break;
    }
  }
  let bursts = 0;
  for (const m of g.mushrooms) {
    if (bursts >= burstsPerTurn) break;
    if (m.cooldown > 0) continue;
    if (g.beetles.some((b) => Math.hypot(b.x - m.x - 0.5, b.y - m.y - 0.5) < C.BURST_RANGE)) {
      burst(g, m.x, m.y);
      bursts++;
    }
  }
}

// Shelves first (they pay for themselves in about a minute), then towers near the mother, facing
// the side most beetles come from; at most 4 shelves and 4 towers.
const built = new WeakMap<Game, number>(); // towers built in a round
function build(g: Game) {
  const shelves = g.shelves.length;
  if (shelves < 4 && g.nutrients >= C.SHELF_COST) {
    for (let i = 0; i < g.tiles.length; i++) {
      const x = i % g.w;
      const y = Math.floor(i / g.w);
      if (g.tiles[i] === TILE.TREE && shelfConnected(g, { x, y }) && !placeShelf(g, x, y)) return;
    }
  }
  if (shelves >= 2 && g.towers.length < 4 && g.nutrients >= C.TOWER_NUTRIENTS && g.spores >= C.TOWER_SPORES) {
    const mother = g.mushrooms.find((m) => m.mother)!;
    const lean = g.rules.sides[1] > g.rules.sides[0] ? 1 : 0; // towards where they come from
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < g.tiles.length; i++) {
      if (!g.mycelium[i]) continue;
      const x = i % g.w;
      const y = Math.floor(i / g.w);
      const d = Math.abs(Math.hypot(x - mother.x - (lean ? 5 : 0), y - mother.y) - 4) + g.towers.length * 0;
      if (d < bestD && !g.towers.some((t) => Math.hypot(t.x - x, t.y - y) < 4)) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && !buildTower(g, best % g.w, Math.floor(best / g.w))) built.set(g, (built.get(g) ?? 0) + 1);
  }
}

const line = (r: ReturnType<typeof play>) =>
  `${r.g.status} at ${Math.round(r.g.time)}s, beaten ${r.g.kills}, tiles eaten ${r.eaten}, mushrooms lost ${r.lostMushrooms}`;

for (const level of [1, 2]) test(`playthrough, forest ${level}`, { timeout: 300000 }, () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const sharp = play(level, seed, 1, 99);
    const casual = play(level, seed, 3, 1);
    const builder = play(level, seed, 3, 1, true);
    const idle = createLevel(level, seed);
    while (idle.status === 'playing' && idle.time < 900) step(idle, 0.1);
    console.log(`forest ${level} seed ${seed}: sharp ${line(sharp)} | casual ${line(casual)} | builder ${line(builder)}, ${builder.g.shelves.length} shelves, towers ${built.get(builder.g) ?? 0} built ${builder.g.towers.length} left | idle ${idle.status} at ${Math.round(idle.time)}s, held ${Math.round(coverage(idle) * 100)}%`);
  }
});
