import { describe, expect, test } from 'vitest';
import * as C from './constants';
import { finishRound, forestOpen, LEVELS, newProfile } from './progress';
import { loadProfile, loadRound, saveRound } from './save';
import { newBeetle, step } from './sim';
import { canHoldMycelium, createLevel, createPineHollow, idx, TILE, type Game } from './world';

// Every tile mycelium could reach from the mother, optionally without using bridges.
function reach(g: Game, bridges: boolean) {
  const m = g.mushrooms[0];
  const seen = new Uint8Array(g.w * g.h);
  const queue = [idx(g, m.x, m.y)];
  seen[queue[0]] = 1;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % g.w;
    const y = (i - x) / g.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
      const j = idx(g, nx, ny);
      const t = g.tiles[j];
      if (seen[j] || !canHoldMycelium(t) || (!bridges && t === TILE.BRIDGE)) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return seen;
}

describe('Pine Hollow', () => {
  test('a bigger forest, with the mother near the left edge', () => {
    const g = createPineHollow(7);
    expect([g.w, g.h]).toEqual([C.PINE_W, C.PINE_H]);
    expect(g.mushrooms[0].x).toBeLessThan(g.w / 5);
    expect(g.level).toBe(2);
    expect(g.biome).toBe('pine');
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    test(`the stream can only be crossed over the bridges (map ${seed})`, () => {
      const g = createPineHollow(seed);
      const bridges = g.tiles.filter((t) => t === TILE.BRIDGE).length;
      expect(bridges).toBe(C.PINE_BRIDGES * 2);
      const right = (seen: Uint8Array) => [...seen.keys()].some((i) => seen[i] && i % g.w > g.w * 0.75);
      expect(right(reach(g, false))).toBe(false); // without bridges, never across
      expect(right(reach(g, true))).toBe(true); // with them, yes
    });
  }

  test('the bank the mother is on holds less than the goal: the bridges must be crossed', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = createPineHollow(seed);
      const mine = reach(g, false).reduce((n, v) => n + v, 0);
      expect(mine / g.growable).toBeLessThan(C.WIN_COVERAGE * 0.85);
    }
  });

  test('fewer logs than the Little Wood, each richer', () => {
    const pine = createPineHollow(3);
    const wood = createLevel(1, 3);
    const logs = (g: Game) => [...g.tiles].filter((t) => t === TILE.LOG).length;
    expect(logs(pine)).toBeLessThan(logs(wood));
    expect(logs(pine)).toBeGreaterThanOrEqual(C.PINE_LOGS - 2);
    expect(Math.max(...pine.logNutrients)).toBe(C.PINE_LOG_NUTRIENTS);
  });

  test('water and rocks and trees are not counted as ground to take', () => {
    const g = createPineHollow(3);
    const holdable = [...g.tiles].filter(canHoldMycelium).length;
    expect(g.growable).toBe(holdable);
    expect([...g.tiles].filter((t) => t === TILE.WATER).length).toBeGreaterThan(g.h * 2 - C.PINE_BRIDGES * 2 - 1);
  });

  test('beetles come sooner, in pairs at least, mostly from the far side', () => {
    const g = createPineHollow(3);
    g.time = g.rules.firstBeetleAt - 0.05;
    step(g, 0.1);
    expect(g.beetles.length).toBeGreaterThanOrEqual(2);
    let right = 0;
    let total = 0;
    for (let k = 0; k < 300; k++) {
      const h = createPineHollow(100 + k);
      h.time = h.rules.firstBeetleAt;
      step(h, 0.01);
      for (const b of h.beetles) {
        total++;
        if (b.x > h.w) right++;
      }
    }
    expect(right / total).toBeGreaterThan(0.45);
  });

  test('a quarter are bark beetles: quick, frail, after mushrooms', () => {
    const g = createPineHollow(3);
    g.time = 61;
    const all = Array.from({ length: 2000 }, () => newBeetle(g, 0, 0));
    const bark = all.filter((b) => b.kind === 'bark');
    expect(bark.length / all.length).toBeCloseTo(g.rules.barkShare, 1);
    for (const b of bark) {
      expect(b.aim).toBe('mushroom');
      expect(b.speed!).toBeGreaterThan(C.BEETLE_SPEED * 1.2);
      expect(b.maxHp!).toBeLessThan(C.BEETLE_HP + C.TOUGHER_HP + 1);
    }
  });

  test('a saved Pine Hollow round loads back into Pine Hollow and carries on exactly', () => {
    const g = createPineHollow(9);
    for (let k = 0; k < 400; k++) step(g, 0.1);
    const copy = loadRound(JSON.parse(JSON.stringify(saveRound(g))))!;
    expect(copy.level).toBe(2);
    for (let k = 0; k < 200; k++) {
      step(g, 0.1);
      step(copy, 0.1);
    }
    expect(JSON.stringify(saveRound(copy))).toBe(JSON.stringify(saveRound(g)));
  });
});

describe('opening forests', () => {
  const pine = LEVELS.find((l) => l.id === 2)!;

  test('Pine Hollow opens once The Little Wood is won', () => {
    let p = newProfile();
    expect(forestOpen(p, LEVELS[0])).toBe(true);
    expect(forestOpen(p, pine)).toBe(false);
    p = finishRound(p, { forest: 1, won: false, held: 0.3, kills: 2, time: 100 }).profile;
    expect(forestOpen(p, pine)).toBe(false);
    p = finishRound(p, { forest: 1, won: true, held: 0.5, kills: 2, time: 200 }).profile;
    expect(forestOpen(p, pine)).toBe(true);
    expect(p.forestsWon).toEqual([1]);
  });

  test('best times are kept per forest', () => {
    let p = finishRound(newProfile(), { forest: 1, won: true, held: 0.5, kills: 0, time: 200 }).profile;
    p = finishRound(p, { forest: 2, won: true, held: 0.5, kills: 0, time: 300 }).profile;
    p = finishRound(p, { forest: 1, won: true, held: 0.5, kills: 0, time: 180 }).profile;
    expect(p.bestTimes).toEqual({ 1: 180, 2: 300 });
    expect(p.forestsWon).toEqual([1, 2]);
  });

  test('an older profile with a win has The Little Wood won', () => {
    const old = { level: 3, xp: 10, points: 1, upgrades: {}, rounds: 4, wins: 2, bestTime: 190 };
    const p = loadProfile(old);
    expect(p.forestsWon).toEqual([1]);
    expect(p.bestTimes).toEqual({ 1: 190 });
    expect(forestOpen(p, pine)).toBe(true);
  });
});
