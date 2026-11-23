import { describe, expect, test } from 'vitest';
import * as C from './constants';
import { loadRound, saveRound } from './save';
import { incomingSwarm, step } from './sim';
import { createLevel } from './world';

describe('warning of a swarm', () => {
  for (const level of [1, 2]) test(`forest ${level}: a swarm is announced ${C.SWARM_WARNING} s ahead, where it then comes in`, () => {
    const g = createLevel(level, 11);
    let warned: ReturnType<typeof incomingSwarm> = null;
    let warnedAt = 0;
    let swarms = 0;
    while (swarms < 5 && g.time < 300) {
      const before = g.beetles.length;
      step(g, 0.1);
      if (g.beetles.length > before) {
        // It came where (and about when) it was announced.
        expect(warned).not.toBeNull();
        expect(g.time - warnedAt).toBeGreaterThanOrEqual(C.SWARM_WARNING - 0.15);
        const first = g.beetles[g.beetles.length - 1];
        const along = warned!.side < 2 ? Math.abs(first.x - warned!.x) : Math.abs(first.y - warned!.y);
        expect(along).toBeLessThan(0.6);
        expect(incomingSwarm(g)).toBeNull();
        warned = null;
        swarms++;
      }
      const now = incomingSwarm(g);
      if (now && !warned) {
        warned = now;
        warnedAt = g.time;
        expect(now.in).toBeLessThanOrEqual(C.SWARM_WARNING);
      }
    }
    expect(swarms).toBe(5);
  });

  test('a saved round keeps the announced swarm', () => {
    const g = createLevel(1, 4);
    while (!incomingSwarm(g)) step(g, 0.1);
    const copy = loadRound(JSON.parse(JSON.stringify(saveRound(g))))!;
    expect(incomingSwarm(copy)).toEqual(incomingSwarm(g));
  });
});
