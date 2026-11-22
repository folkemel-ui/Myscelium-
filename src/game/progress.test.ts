import { describe, expect, test } from 'vitest';
import * as C from './constants';
import {
  buyUpgrade, finishRound, modsFor, newProfile, rank, roundXp, totalXp, UPGRADES, XP_FOR_WIN, xpToNext, type Profile,
} from './progress';
import { burst, growMycelium, sporesPerSecond, step } from './sim';
import { createLevel1 } from './world';

describe('XP', () => {
  test('a typical win earns XP for what was held, beaten, the win and the speed', () => {
    const lines = roundXp({ won: true, held: 0.5, kills: 6, time: 180 });
    expect(lines.map((l) => l.xp)).toEqual([100, 30, XP_FOR_WIN, 40]);
    expect(totalXp(lines)).toBe(270);
  });

  test('a lost round still earns something, with no win or speed bonus', () => {
    const lines = roundXp({ won: false, held: 0.12, kills: 2, time: 60 });
    expect(totalXp(lines)).toBe(24 + 10);
    expect(lines).toHaveLength(2);
  });

  test('a slow win gets no speed bonus', () => {
    expect(roundXp({ won: true, held: 0.5, kills: 0, time: 400 })).toHaveLength(3);
  });
});

describe('levels', () => {
  test('each level needs more XP than the last', () => {
    expect([1, 2, 3, 4].map(xpToNext)).toEqual([150, 250, 350, 450]);
  });

  test('levelling up gives an upgrade point, and leftover XP carries over', () => {
    const { profile, levelsGained } = finishRound(newProfile(), { won: true, held: 0.5, kills: 6, time: 180 });
    expect(levelsGained).toBe(1);
    expect(profile).toMatchObject({ level: 2, xp: 270 - 150, points: 1, rounds: 1, wins: 1, bestTime: 180 });
  });

  test('a big round can give several levels at once', () => {
    const p: Profile = { ...newProfile(), xp: 140 };
    const { profile, levelsGained } = finishRound(p, { won: true, held: 0.5, kills: 60, time: 100 });
    expect(levelsGained).toBe(2);
    expect(profile.points).toBe(2);
  });

  test('the best time is the fastest win, and losses do not count', () => {
    let p = finishRound(newProfile(), { won: true, held: 0.5, kills: 0, time: 200 }).profile;
    p = finishRound(p, { won: false, held: 0.2, kills: 0, time: 50 }).profile;
    p = finishRound(p, { won: true, held: 0.5, kills: 0, time: 170 }).profile;
    expect(p).toMatchObject({ bestTime: 170, rounds: 3, wins: 2 });
  });
});

describe('upgrades', () => {
  test('cost a point a rank, up to their limit', () => {
    let p: Profile | null = { ...newProfile(), points: 5 };
    p = buyUpgrade(p, 'cheapGrow')!;
    p = buyUpgrade(p, 'cheapGrow')!;
    expect(rank(p, 'cheapGrow')).toBe(2);
    expect(p.points).toBe(3);
    expect(buyUpgrade(p, 'cheapGrow')).toBeNull(); // at its limit of 2
    expect(buyUpgrade({ ...newProfile(), points: 0 }, 'richSpores')).toBeNull(); // no points
  });

  test('every upgrade has a description for its next rank', () => {
    for (const u of UPGRADES) expect(u.about(0).length).toBeGreaterThan(10);
  });

  test('no upgrades: the round plays exactly as before', () => {
    expect(modsFor(newProfile())).toEqual(createLevel1().mods);
  });

  test('upgrades change the round', () => {
    const p: Profile = { ...newProfile(), upgrades: { cheapGrow: 1, richSpores: 2, strongBurst: 1, fastCreep: 2, toughMycelium: 1, headStart: 3 } };
    const g = createLevel1(1, modsFor(p));
    const plain = createLevel1(1);
    expect(g.spores).toBe(C.START_SPORES + 45);
    expect(sporesPerSecond(g) - 5 * C.MYCELIUM_SPORES).toBeCloseTo(C.MOTHER_SPORES * 1.4);
    const m = g.mushrooms[0];
    const before = g.spores;
    growMycelium(g, m.x + 2, m.y);
    expect(before - g.spores).toBe(C.GROW_COST - 1);
    // A burst hits harder, and reaches a beetle a plain burst would miss.
    g.beetles.push({ id: 99, x: m.x + 0.5 + C.BURST_RANGE + 0.2, y: m.y + 0.5, hp: 10, target: -1, eatTimer: 0, retarget: 0, ate: 0 });
    burst(g, m.x, m.y);
    expect(g.beetles[0].hp).toBe(10 - (C.BURST_DAMAGE + 1));
    // The network creeps out faster.
    g.beetles.length = 0;
    for (let k = 0; k < 100; k++) {
      step(g, 0.1);
      step(plain, 0.1);
    }
    expect(g.covered - 1).toBeGreaterThanOrEqual(plain.covered + 1); // 1 grown by hand above
    expect(g.covered - 1 - 5).toBeCloseTo((plain.covered - 5) * 1.5, -1);
  });
});
