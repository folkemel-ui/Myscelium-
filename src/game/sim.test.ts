import { describe, expect, test } from 'vitest';
import * as C from './constants';
import {
  burst, canGrowAt, coverage, eatTimeFor, underAttack, growMycelium, nearestReadyMushroom, newBeetle, plantMushroom, sporesPerSecond, step,
  swarmSize,
} from './sim';
import { createLevel1, idx, TILE, type Game } from './world';

const mother = (g: Game) => g.mushrooms.find((m) => m.mother)!;
const run = (g: Game, seconds: number, dt = 0.1) => {
  for (let t = 0; t < seconds; t += dt) step(g, dt);
};

describe('level 1', () => {
  test('starts with the mother mushroom on a small patch of mycelium', () => {
    const g = createLevel1();
    expect(g.mushrooms).toHaveLength(1);
    expect(g.covered).toBe(5);
    expect(g.mycelium[idx(g, mother(g).x, mother(g).y)]).toBe(1);
    expect(g.growable).toBeGreaterThan(g.w * g.h * 0.6);
    expect(g.spores).toBe(C.START_SPORES);
  });

  test('the same seed makes the same forest', () => {
    expect(createLevel1(7).tiles).toEqual(createLevel1(7).tiles);
    expect(createLevel1(7).tiles).not.toEqual(createLevel1(8).tiles);
  });
});

describe('spores and mycelium', () => {
  test('mushrooms and mycelium make spores', () => {
    const g = createLevel1();
    expect(sporesPerSecond(g)).toBeCloseTo(C.MOTHER_SPORES + 5 * C.MYCELIUM_SPORES);
  });

  test('mycelium grows only next to the network and costs spores', () => {
    const g = createLevel1();
    const { x, y } = mother(g);
    expect(growMycelium(g, x + 5, y)).not.toBeNull(); // too far
    expect(growMycelium(g, x + 2, y)).toBeNull();
    expect(g.spores).toBe(C.START_SPORES - C.GROW_COST);
    expect(g.covered).toBe(6);
    g.spores = 0;
    expect(growMycelium(g, x + 3, y)).toMatch(/spores/);
  });

  test('it cannot grow onto trees or rocks', () => {
    const g = createLevel1();
    g.tiles[idx(g, mother(g).x + 2, mother(g).y)] = TILE.ROCK;
    expect(canGrowAt(g, mother(g).x + 2, mother(g).y)).toBe(false);
  });

  test('the network creeps out on its own', () => {
    const g = createLevel1();
    run(g, 10);
    expect(g.covered).toBe(5 + Math.floor(10 * C.CREEP_PER_SECOND + 1e-6));
  });
});

describe('nutrients and mushrooms', () => {
  test('covered logs rot into nutrients, then into soil', () => {
    const g = createLevel1();
    const i = idx(g, mother(g).x + 3, mother(g).y - 1);
    expect(g.tiles[i]).toBe(TILE.LOG);
    g.mycelium[i] = 1;
    run(g, 2, 0.5);
    expect(g.nutrients).toBeCloseTo(2 * C.ROT_PER_SECOND);
    run(g, C.LOG_NUTRIENTS / C.ROT_PER_SECOND);
    expect(g.tiles[i]).toBe(TILE.SOIL);
    expect(g.nutrients).toBeCloseTo(C.LOG_NUTRIENTS, 0);
  });

  test('mushrooms grow on mycelium for nutrients', () => {
    const g = createLevel1();
    const { x, y } = mother(g);
    expect(plantMushroom(g, x + 1, y)).toMatch(/nutrients/);
    g.nutrients = C.MUSHROOM_COST;
    expect(plantMushroom(g, x + 6, y)).toMatch(/mycelium/);
    expect(plantMushroom(g, x + 1, y)).toBeNull();
    expect(g.nutrients).toBe(0);
    expect(sporesPerSecond(g)).toBeCloseTo(C.MOTHER_SPORES + C.MUSHROOM_SPORES + 5 * C.MYCELIUM_SPORES);
  });
});

describe('beetles', () => {
  test('come in after a while and head for the mycelium', () => {
    const g = createLevel1();
    run(g, C.FIRST_BEETLE_AT - 1);
    expect(g.beetles).toHaveLength(0);
    run(g, 1.5);
    expect(g.beetles).toHaveLength(1);
    const b = g.beetles[0];
    const before = Math.hypot(b.x - mother(g).x, b.y - mother(g).y);
    run(g, 3);
    expect(Math.hypot(b.x - mother(g).x, b.y - mother(g).y)).toBeLessThan(before);
  });

  test('eat mycelium, and eating the mother loses the level', () => {
    const g = createLevel1();
    const m = mother(g);
    g.mycelium.fill(0);
    g.mycelium[idx(g, m.x, m.y)] = 1;
    g.covered = 1;
    g.beetles.push({ id: 99, x: m.x + 0.5, y: m.y + 0.5, hp: 100, target: -1, eatTimer: 0, retarget: 0, ate: 0 });
    m.puffTimer = 1000;
    g.time = 0;
    run(g, C.BEETLE_EAT_TIME + 0.3);
    expect(g.status).toBe('playing'); // the mother holds out longer than a thread...
    run(g, C.BEETLE_EAT_TIME * (C.MOTHER_EAT_FACTOR - 1));
    expect(g.status).toBe('lost'); // ...but not for ever
  });

  test('a full beetle walks off the map and is gone', () => {
    const g = createLevel1();
    g.beetles.push({ id: 99, x: 3.5, y: 10.5, hp: C.BEETLE_HP, target: -1, eatTimer: 0, retarget: 0, ate: C.BEETLE_APPETITE });
    run(g, 2);
    expect(g.beetles[0].x).toBeLessThan(3.5 - C.BEETLE_SPEED * 1.5);
    run(g, 5);
    expect(g.beetles).toHaveLength(0);
    expect(g.kills).toBe(0);
  });

  test('no more than MAX_BEETLES come at once', () => {
    const g = createLevel1();
    for (let k = 0; k < C.MAX_BEETLES; k++) {
      g.beetles.push({ id: 100 + k, x: 0.5, y: 0.5, hp: 1e9, target: -1, eatTimer: 0, retarget: 0, ate: 0 });
    }
    g.time = C.FIRST_BEETLE_AT + 1;
    step(g, 0.1);
    expect(g.beetles).toHaveLength(C.MAX_BEETLES);
  });

  test('mushrooms puff at beetles nearby, and a burst hits harder', () => {
    const g = createLevel1();
    const m = mother(g);
    g.beetles.push({ id: 99, x: m.x + 2, y: m.y + 0.5, hp: C.BEETLE_HP, target: -1, eatTimer: 0, retarget: 0, ate: 0 });
    step(g, 0.01);
    expect(g.beetles[0].hp).toBe(C.BEETLE_HP - C.PUFF_DAMAGE);
    expect(burst(g, m.x, m.y)).toBeNull();
    expect(burst(g, m.x, m.y)).toMatch(/Ready again/);
    step(g, 0.01);
    expect(g.beetles).toHaveLength(0);
    expect(g.kills).toBe(1);
    expect(g.nutrients).toBe(C.BEETLE_NUTRIENTS);
  });
});

describe('a real threat', () => {
  test('beetles come in swarms, bigger later and the further you spread', () => {
    const early = createLevel1(3);
    early.time = 30;
    const late = createLevel1(3);
    late.time = 300;
    late.covered = Math.ceil(late.growable * C.WIN_COVERAGE * 0.9);
    const avg = (g: Game) => {
      let total = 0;
      for (let k = 0; k < 400; k++) total += swarmSize(g);
      return total / 400;
    };
    expect(avg(early)).toBeLessThan(1.6);
    expect(avg(late)).toBeGreaterThan(2.2);
    for (let k = 0; k < 200; k++) expect(swarmSize(late)).toBeLessThanOrEqual(C.SWARM_MAX);
  });

  test('later beetles are tougher, faster and hungrier, up to a limit', () => {
    const g = createLevel1(3);
    const first = newBeetle(g, 0, 0);
    expect(first).toMatchObject({ hp: C.BEETLE_HP, appetite: C.BEETLE_APPETITE });
    g.time = 150;
    const later = newBeetle(g, 0, 0);
    expect(later.hp).toBe(C.BEETLE_HP + 2 * C.TOUGHER_HP);
    expect(later.speed!).toBeCloseTo(C.BEETLE_SPEED * (1 + 2 * C.TOUGHER_SPEED));
    expect(later.appetite).toBe(C.BEETLE_APPETITE + 1);
    g.time = 3600;
    const veteran = newBeetle(g, 0, 0);
    expect(veteran.hp).toBe(C.BEETLE_HP + C.TOUGHER_MAX * C.TOUGHER_HP);
    expect(veteran.appetite).toBe(C.BEETLE_APPETITE + C.HUNGRIER_MAX);
  });

  test('some beetles go for mushrooms, some for the mother', () => {
    const g = createLevel1(3);
    g.time = C.AIM_MOTHER_FROM;
    const aims = { any: 0, mushroom: 0, mother: 0 };
    for (let k = 0; k < 2000; k++) aims[newBeetle(g, 0, 0).aim!]++;
    expect(aims.mother / 2000).toBeCloseTo(C.AIM_MOTHER, 1);
    expect(aims.mushroom / 2000).toBeCloseTo(C.AIM_MUSHROOM, 1);
  });

  test('no beetle goes for the mother in the first minute', () => {
    const g = createLevel1(3);
    g.time = C.AIM_MOTHER_FROM - 1;
    for (let k = 0; k < 500; k++) expect(newBeetle(g, 0, 0).aim).not.toBe('mother');
  });

  test('a mushroom-hunting beetle walks past threads to a mushroom and eats it', () => {
    const g = createLevel1(3);
    const m = mother(g);
    g.spores = 500;
    g.nutrients = 100;
    for (let x = m.x + 1; x <= m.x + 6; x++) growMycelium(g, x, m.y);
    plantMushroom(g, m.x + 6, m.y);
    const hunter = { ...newBeetle(g, m.x - 6.5, m.y + 0.5), aim: 'mushroom' as const, hp: 1e9, appetite: 99 };
    g.beetles.push(hunter);
    for (const mm of g.mushrooms) mm.puffTimer = 1e9;
    g.nextBeetle = 1e9;
    run(g, 20);
    expect(g.mushrooms.some((mm) => mm.x === m.x + 6)).toBe(false); // eaten
    expect(g.status).toBe('playing');
  });

  test('a mushroom being eaten is known, with how far along', () => {
    const g = createLevel1(3);
    const m = mother(g);
    expect(underAttack(g)).toEqual([]);
    g.beetles.push({ ...newBeetle(g, m.x + 0.5, m.y + 0.5), target: idx(g, m.x, m.y), eatTimer: g.mods.eatTime * C.MOTHER_EAT_FACTOR / 2 });
    const a = underAttack(g);
    expect(a).toHaveLength(1);
    expect(a[0].mushroom.mother).toBe(true);
    expect(a[0].progress).toBeCloseTo(0.5);
  });

  test('mushrooms take longer to eat than threads, and the mother longest', () => {
    const g = createLevel1(3);
    const m = mother(g);
    g.nutrients = 100;
    plantMushroom(g, m.x + 1, m.y);
    expect(eatTimeFor(g, idx(g, m.x, m.y - 1))).toBe(g.mods.eatTime);
    expect(eatTimeFor(g, idx(g, m.x + 1, m.y))).toBe(g.mods.eatTime * C.MUSHROOM_EAT_FACTOR);
    expect(eatTimeFor(g, idx(g, m.x, m.y))).toBe(g.mods.eatTime * C.MOTHER_EAT_FACTOR);
  });
});

describe('events for the drawing', () => {
  const beetleAt = (g: Game, x: number, y: number, hp = C.BEETLE_HP) =>
    g.beetles.push({ id: g.nextId++, x, y, hp, target: -1, eatTimer: 0, retarget: 0, ate: 0 });

  test('hits and defeats are told, with where the beetle fell', () => {
    const g = createLevel1();
    const m = mother(g);
    beetleAt(g, m.x + 1, m.y + 0.5);
    beetleAt(g, m.x + 3, m.y + 0.5, 100);
    burst(g, m.x, m.y);
    expect(g.events.filter((e) => e.kind === 'hit')).toHaveLength(2);
    step(g, 0.01);
    const defeats = g.events.filter((e) => e.kind === 'defeat');
    expect(defeats).toHaveLength(1);
    expect(defeats[0]).toMatchObject({ nutrients: C.BEETLE_NUTRIENTS });
    const d = defeats[0] as { x: number; y: number };
    expect(Math.hypot(d.x - (m.x + 1), d.y - (m.y + 0.5))).toBeLessThan(0.05);
  });

  test('a beetle walking off the map is not a defeat', () => {
    const g = createLevel1();
    g.beetles.push({ id: 99, x: 0.5, y: 10.5, hp: C.BEETLE_HP, target: -1, eatTimer: 0, retarget: 0, ate: C.BEETLE_APPETITE });
    run(g, 5);
    expect(g.beetles).toHaveLength(0);
    expect(g.events.some((e) => e.kind === 'defeat')).toBe(false);
  });

  test('old events are dropped if nobody takes them', () => {
    const g = createLevel1();
    for (let k = 0; k < 500; k++) {
      beetleAt(g, mother(g).x + 0.5, mother(g).y + 0.5, 1000);
      mother(g).cooldown = 0;
      burst(g, mother(g).x, mother(g).y);
      g.beetles.length = 0;
    }
    expect(g.events.length).toBeLessThanOrEqual(200);
  });
});

describe('the round in numbers', () => {
  test('the share held is noted every few seconds, and once more at the end', () => {
    const g = createLevel1();
    expect(g.history).toEqual([{ t: 0, held: 5 / g.growable }]);
    run(g, 10);
    expect(g.history.length).toBe(1 + Math.floor(10 / C.HISTORY_EVERY + 1e-6));
    expect(g.history[g.history.length - 1].held).toBeGreaterThan(g.history[0].held);
    g.covered = Math.ceil(g.growable * C.WIN_COVERAGE);
    const before = g.history.length;
    step(g, 0.01);
    expect(g.status).toBe('won');
    expect(g.history.length).toBe(before + 1);
    expect(g.history[g.history.length - 1].held).toBeGreaterThanOrEqual(C.WIN_COVERAGE);
  });

  test('a long round keeps no more than HISTORY_MAX samples, first and last kept', () => {
    const g = createLevel1();
    for (let k = 0; k < C.HISTORY_MAX * 2.5; k++) step(g, C.HISTORY_EVERY);
    expect(g.history.length).toBeLessThanOrEqual(C.HISTORY_MAX);
    expect(g.history[0].t).toBe(0);
    expect(g.history[g.history.length - 1].t).toBeCloseTo(g.time);
  });

  test('what the player did is counted', () => {
    const g = createLevel1();
    const { x, y } = mother(g);
    growMycelium(g, x + 2, y);
    g.nutrients = C.MUSHROOM_COST;
    plantMushroom(g, x + 1, y);
    burst(g, x, y);
    step(g, 0.01);
    expect(g.stats).toMatchObject({ grown: 1, mushrooms: 1, bursts: 1 });
    expect(g.stats.peakSpores).toBeCloseTo(sporesPerSecond(g));
  });

  test('the nearest mushroom that is ready to burst', () => {
    const g = createLevel1();
    const m = mother(g);
    g.nutrients = 100;
    for (let x = m.x + 1; x <= m.x + 4; x++) growMycelium(g, x, m.y);
    plantMushroom(g, m.x + 4, m.y);
    expect(nearestReadyMushroom(g, m.x + 6, m.y)?.x).toBe(m.x + 4);
    expect(nearestReadyMushroom(g, m.x - 2, m.y)?.mother).toBe(true);
    burst(g, m.x + 4, m.y);
    expect(nearestReadyMushroom(g, m.x + 6, m.y)?.mother).toBe(true); // the other one is not ready
  });
});

test('holding half the forest floor wins', () => {
  const g = createLevel1();
  g.covered = Math.ceil(g.growable * C.WIN_COVERAGE);
  step(g, 0.01);
  expect(coverage(g)).toBeGreaterThanOrEqual(C.WIN_COVERAGE);
  expect(g.status).toBe('won');
});
