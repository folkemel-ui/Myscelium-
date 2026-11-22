// Scripted players, to see how long level 1 takes and how much of a threat the beetles are.
// Not a real test: prints numbers. Three players on five maps:
//   - sharp: acts every second, bursts every mushroom that has a beetle near (a perfect player);
//   - casual: acts every 3 seconds, bursts at most one mushroom each time (more like a person);
//   - idle: nobody playing at all.
import { test } from 'vitest';
import * as C from './constants';
import { burst, canGrowAt, coverage, growMycelium, plantMushroom, step } from './sim';
import { createLevel1, idx, TILE, type Game } from './world';

function play(seed: number, every: number, burstsPerTurn: number) {
  const g = createLevel1(seed);
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

const line = (r: ReturnType<typeof play>) =>
  `${r.g.status} at ${Math.round(r.g.time)}s, beaten ${r.g.kills}, tiles eaten ${r.eaten}, mushrooms lost ${r.lostMushrooms}`;

test('playthrough', { timeout: 240000 }, () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const sharp = play(seed, 1, 99);
    const casual = play(seed, 3, 1);
    const idle = createLevel1(seed);
    while (idle.status === 'playing' && idle.time < 900) step(idle, 0.1);
    console.log(`seed ${seed}: sharp ${line(sharp)} | casual ${line(casual)} | idle ${idle.status} at ${Math.round(idle.time)}s, held ${Math.round(coverage(idle) * 100)}%`);
  }
});
