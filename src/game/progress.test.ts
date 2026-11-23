import { describe, expect, test } from 'vitest';
import * as C from './constants';
import {
  ACHIEVEMENTS, award, branchPoints, canBuy, CAPSTONE_POINTS, motherTier, SCHEMES, upgradeInfo,
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
    // 270 for the round, and 35 for two achievements: First spores and The forest is yours.
    expect(profile).toMatchObject({ level: 2, xp: 270 + 35 - 150, points: 1, rounds: 1, wins: 1, bestTime: 180 });
    expect(profile.achievements).toEqual(['firstRound', 'firstWin']);
  });

  test('a big round can give several levels at once', () => {
    const p: Profile = { ...newProfile(), xp: 140 };
    const { profile, levelsGained } = finishRound(p, { won: true, held: 0.5, kills: 60, time: 100 });
    expect(levelsGained).toBeGreaterThanOrEqual(2);
    expect(profile.points).toBe(levelsGained);
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

describe('the upgrade tree', () => {
  const withPoints = (n: number): Profile => ({ ...newProfile(), points: n });

  test('the middle of a branch needs its first upgrade', () => {
    const p = withPoints(3);
    expect(canBuy(p, 'fastCreep')).toEqual({ ok: false, why: 'Needs Thrifty threads' });
    const q = buyUpgrade(p, 'cheapGrow')!;
    expect(canBuy(q, 'fastCreep').ok).toBe(true);
  });

  test('the last upgrade needs points in its branch, and other branches do not count', () => {
    let p = withPoints(20);
    expect(canBuy(p, 'deepRoots').why).toMatch(/4 points in Growth/);
    p = buyUpgrade(p, 'strongBurst')!;
    p = buyUpgrade(p, 'strongBurst')!;
    p = buyUpgrade(p, 'strongBurst')!;
    p = buyUpgrade(p, 'cheapGrow')!;
    expect(canBuy(p, 'deepRoots').ok).toBe(false);
    for (const id of ['cheapGrow', 'fastCreep', 'fastCreep'] as const) p = buyUpgrade(p, id)!;
    expect(branchPoints(p, 'growth')).toBe(CAPSTONE_POINTS);
    expect(canBuy(p, 'deepRoots').ok).toBe(true);
  });

  test('every branch has a start, a middle and an end, all with descriptions', () => {
    for (const b of ['growth', 'defence', 'decay']) {
      const tiers = new Set(UPGRADES.filter((u) => u.branch === b).map((u) => u.tier));
      expect([...tiers].sort()).toEqual([1, 2, 3]);
    }
    for (const u of UPGRADES) expect(u.about(0).length).toBeGreaterThan(10);
  });

  test('the new upgrades change the round', () => {
    const p: Profile = { ...newProfile(), upgrades: { quickRecovery: 2, mothersWrath: 1, rotFast: 1, feast: 2, cheapCaps: 1, deepRoots: 1 } };
    const g = createLevel1(1, modsFor(p));
    const m = g.mushrooms[0];
    expect(g.covered).toBe(13); // Deep roots: a bigger patch
    burst(g, m.x, m.y);
    expect(m.cooldown).toBe(C.BURST_COOLDOWN - 2);
    g.nutrients = 10;
    growMycelium(g, m.x + 3, m.y); // (needs spores; any is fine)
    expect(g.mods.mushroomCost).toBe(10);
    expect(g.mods.beetleNutrients).toBe(C.BEETLE_NUTRIENTS + 4);
    expect(g.mods.rotSpeed).toBeCloseTo(C.ROT_PER_SECOND * 1.5);
    expect(g.mods.motherPuffInterval).toBe(C.PUFF_INTERVAL / 2);
    // Every upgrade bought at its limit still makes a playable round.
    const all: Profile = { ...newProfile(), upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, u.max])) };
    const h = createLevel1(2, modsFor(all));
    for (let k = 0; k < 600; k++) step(h, 0.1);
    expect(h.mods.growCost).toBeGreaterThanOrEqual(1);
    expect(h.mods.burstCooldown).toBeGreaterThan(0);
  });
});

describe('records, history and totals', () => {
  test('records are kept, and called new only when one was beaten', () => {
    const stats = { grown: 80, mushrooms: 12, bursts: 9, peakSpores: 11.26, mushroomsLost: 1, motherBitten: false, threeQuartersAt: 150 };
    const first = finishRound(newProfile(), { won: true, held: 0.5, kills: 20, time: 200, stats });
    expect(first.newRecords).toEqual([]);
    expect(first.profile.records).toEqual({ mostKills: 20, mostSpores: 11.3, mostMushrooms: 12, fewestHandWin: 80 });
    const second = finishRound(first.profile, { won: true, held: 0.5, kills: 25, time: 190, stats: { ...stats, grown: 70 } });
    expect(second.newRecords).toEqual(['Fastest win in The Little Wood', 'Most beetles in a round: 25', 'Fewest tiles grown by hand in a win: 70']);
  });

  test('the history keeps the last 50 rounds, and totals add up', () => {
    let p = newProfile();
    for (let k = 0; k < 55; k++) p = finishRound(p, { won: false, held: 0.1, kills: 2, time: 60 + k }).profile;
    expect(p.history).toHaveLength(50);
    expect(p.history[49].time).toBe(60 + 54);
    expect(p.totals.kills).toBe(110);
    expect(p.totals.time).toBe(55 * 60 + (54 * 55) / 2);
  });
});

describe('achievements', () => {
  test('earned once, with their XP, and some stay hidden', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.filter((a) => a.hidden).length).toBeGreaterThanOrEqual(5);
    const out = finishRound(newProfile(), { won: false, held: 0.1, kills: 12, time: 90 });
    expect(out.earned.map((a) => a.id).sort()).toEqual(['firstRound', 'squasher']);
    const again = finishRound(out.profile, { won: false, held: 0.1, kills: 12, time: 90 });
    expect(again.earned).toEqual([]);
  });

  test('naming the fungus and new colours earn theirs outside a round', () => {
    const named = award({ ...newProfile(), name: 'The Violet Bloom', scheme: 'ocean' });
    expect(named.earned.map((a) => a.id).sort()).toEqual(['named', 'newColours']);
    expect(named.profile.xp).toBe(20);
  });

  test('an achievement that brings a level can earn another (Growing up)', () => {
    const p: Profile = { ...newProfile(), level: 4, xp: xpToNext(4) - 5, rounds: 0 };
    const out = finishRound(p, { won: false, held: 0, kills: 0, time: 10 });
    expect(out.profile.level).toBeGreaterThanOrEqual(5);
    expect(out.earned.map((a) => a.id)).toContain('growingUp');
  });
});

describe('looks', () => {
  test('colour schemes open as you level, each with five glow colours', () => {
    expect(SCHEMES[0].level).toBe(1);
    for (const s of SCHEMES) expect(s.glow).toHaveLength(5);
    expect(SCHEMES.map((s) => s.level)).toEqual([...SCHEMES.map((s) => s.level)].sort((a, b) => a - b));
  });

  test('the mother grows grander every 2 levels, up to 5 steps', () => {
    expect([1, 2, 3, 5, 9, 11, 30].map(motherTier)).toEqual([0, 0, 1, 2, 4, 5, 5]);
  });

  test('the name of an upgrade can be found by its id', () => {
    expect(upgradeInfo('mothersWrath').branch).toBe('defence');
  });
});
