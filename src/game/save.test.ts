import { describe, expect, test } from 'vitest';
import { finishRound, modsFor, newProfile } from './progress';
import {
  clearAutosave, KEYS, loadProfile, loadRound, makeBackup, readAutosave, readProfile, readSlot, restoreBackup, saveRound,
  writeAutosave, writeProfile, writeSlot, type Store,
} from './save';
import { burst, growMycelium, step } from './sim';
import { createLevel1, type Game } from './world';

const memoryStore = (): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => (data.set(k, v), true), remove: (k) => void data.delete(k) };
};

// A round well under way: grown, a mushroom, beetles about, a burst on cooldown.
function busyRound(): Game {
  const g = createLevel1(7);
  g.spores = 500;
  const m = g.mushrooms[0];
  for (let x = m.x + 1; x < m.x + 6; x++) growMycelium(g, x, m.y);
  for (let k = 0; k < 400; k++) step(g, 0.1); // 40 s: beetles have arrived
  burst(g, m.x, m.y);
  return g;
}

// Everything about a game that matters for how it carries on.
const essence = (g: Game) => JSON.stringify({ ...saveRound(g), rng: g.rng() });

describe('saving a round', () => {
  test('a loaded round carries on exactly as the original would have', () => {
    const g = busyRound();
    expect(g.beetles.length).toBeGreaterThan(0);
    const copy = loadRound(JSON.parse(JSON.stringify(saveRound(g))))!;
    expect(copy).not.toBeNull();
    for (let k = 0; k < 300; k++) {
      step(g, 0.1);
      step(copy, 0.1);
    }
    expect(essence(copy)).toBe(essence(g));
  });

  test('a round keeps the upgrades it started with', () => {
    const p = { ...newProfile(), upgrades: { cheapGrow: 1, headStart: 2 } };
    const g = createLevel1(3, modsFor(p));
    expect(loadRound(saveRound(g))!.mods).toEqual(g.mods);
  });

  test('broken or foreign data is refused, not half-loaded', () => {
    const good = saveRound(busyRound());
    expect(loadRound(null)).toBeNull();
    expect(loadRound({ hello: 1 })).toBeNull();
    expect(loadRound({ ...good, v: 99 })).toBeNull();
    expect(loadRound({ ...good, tiles: good.tiles.slice(1) })).toBeNull();
    expect(loadRound({ ...good, mycelium: good.mycelium.replace('1', '7') })).toBeNull();
    expect(loadRound({ ...good, spores: 'lots' })).toBeNull();
    expect(loadRound({ ...good, mushrooms: [] })).toBeNull(); // no mother
  });

  test('a saved round is small', () => {
    expect(JSON.stringify(saveRound(busyRound())).length).toBeLessThan(20_000);
  });
});

describe('the profile', () => {
  test('survives storage', () => {
    const store = memoryStore();
    const p = finishRound(newProfile(), { won: true, held: 0.5, kills: 6, time: 170 }).profile;
    writeProfile(store, { ...p, upgrades: { richSpores: 1 } });
    expect(readProfile(store)).toEqual({ ...p, upgrades: { richSpores: 1 } });
  });

  test('missing or broken values fall back, and ranks stay within limits', () => {
    expect(loadProfile(null)).toEqual(newProfile());
    expect(loadProfile({ level: -3, xp: 'x', points: 2.7, upgrades: { cheapGrow: 9, nonsense: 3 }, bestTime: -1 })).toEqual({
      ...newProfile(), points: 2, upgrades: { cheapGrow: 2 },
    });
  });

  test('a profile from before Pack 13 gets the new parts fresh, keeping what it had', () => {
    const old = { level: 4, xp: 30, points: 2, upgrades: { strongBurst: 2 }, rounds: 9, wins: 5, bestTime: 170, forestsWon: [1], bestTimes: { 1: 170 } };
    const p = loadProfile(old);
    expect(p).toMatchObject({ level: 4, points: 2, upgrades: { strongBurst: 2 }, name: '', scheme: 'rose', achievements: [], history: [] });
    expect(p.records.mostKills).toBe(0);
    expect(loadProfile({ ...old, name: '  A   very long name for a fungus indeed  ', scheme: 'nonsense', achievements: ['firstWin', 'made-up'] }))
      .toMatchObject({ name: 'A very long name for a f', scheme: 'rose', achievements: ['firstWin'] });
  });

  test('broken JSON in storage gives a fresh profile', () => {
    const store = memoryStore();
    store.set(KEYS.profile, '{not json');
    expect(readProfile(store)).toEqual(newProfile());
  });
});

describe('autosave, slots and backups', () => {
  test('the autosave is kept until cleared', () => {
    const store = memoryStore();
    expect(readAutosave(store)).toBeNull();
    const g = busyRound();
    writeAutosave(store, g);
    expect(readAutosave(store)!.time).toBe(g.time);
    clearAutosave(store);
    expect(readAutosave(store)).toBeNull();
  });

  test('a backup brings back the profile, the autosave and the slots', () => {
    const a = memoryStore();
    const g = busyRound();
    writeProfile(a, { ...newProfile(), level: 4, points: 1 });
    writeAutosave(a, g);
    writeSlot(a, 2, { name: 'Halfway', savedAt: 1, held: 0.2, time: g.time, picture: '', round: saveRound(g) });
    const file = JSON.stringify(makeBackup(a));

    const b = memoryStore();
    writeSlot(b, 1, { name: 'Old', savedAt: 1, held: 0.1, time: 5, picture: '', round: saveRound(createLevel1(1)) });
    expect(restoreBackup(b, file)).toBeNull();
    expect(readProfile(b).level).toBe(4);
    expect(readAutosave(b)!.time).toBe(g.time);
    expect(readSlot(b, 1)).toBeNull(); // replaced by the backup's empty slot 1
    expect(readSlot(b, 2)!.name).toBe('Halfway');
  });

  test('a file that is not a backup changes nothing', () => {
    const store = memoryStore();
    writeProfile(store, { ...newProfile(), level: 3 });
    expect(restoreBackup(store, 'hello')).toMatch(/not a Mycelium backup/);
    expect(restoreBackup(store, '{"kind":"something-else"}')).toMatch(/not a Mycelium backup/);
    expect(readProfile(store).level).toBe(3);
  });
});
