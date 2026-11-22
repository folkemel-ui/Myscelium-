// A scripted player, to see how long level 1 takes. Not a real test: prints numbers.
import { test } from 'vitest';
import * as C from './constants';
import { burst, canGrowAt, coverage, growMycelium, plantMushroom, step } from './sim';
import { createLevel1, idx, TILE } from './world';

test('playthrough', { timeout: 60000 }, () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = createLevel1(seed);
    const marks: string[] = [];
    let next = 0.25;
    while (g.status === 'playing' && g.time < 3600) {
      step(g, 0.1);
      if (Math.round(g.time * 10) % 10 !== 0) continue; // the player acts once a second
      // Grow towards logs first, then anywhere.
      const edge: number[] = [];
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (canGrowAt(g, x, y)) edge.push(idx(g, x, y));
      edge.sort((a, b) => (g.tiles[b] === TILE.LOG ? 1 : 0) - (g.tiles[a] === TILE.LOG ? 1 : 0) || g.noise[a] - g.noise[b]);
      for (const i of edge) if (growMycelium(g, i % g.w, Math.floor(i / g.w))) break;
      if (g.nutrients >= C.MUSHROOM_COST) {
        for (let i = 0; i < g.tiles.length; i++) {
          if (g.mycelium[i] && g.noise[i] > 0.5 && !plantMushroom(g, i % g.w, Math.floor(i / g.w))) break;
        }
      }
      for (const m of g.mushrooms) {
        if (g.beetles.some((b) => Math.hypot(b.x - m.x - 0.5, b.y - m.y - 0.5) < C.BURST_RANGE)) burst(g, m.x, m.y);
      }
      if (coverage(g) >= next * C.WIN_COVERAGE) {
        marks.push(`${Math.round(next * 100)}% of goal at ${Math.round(g.time)}s`);
        next += 0.25;
      }
    }
    console.log(`seed ${seed}: ${g.status} at ${Math.round(g.time)}s, ${g.mushrooms.length} mushrooms, ${g.kills} beetles beaten, ${g.beetles.length} left; ${marks.join(', ')}`);
  }
});
