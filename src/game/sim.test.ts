import { describe, expect, test } from 'vitest';
import * as C from './constants';
import { burst, canGrowAt, coverage, growMycelium, plantMushroom, sporesPerSecond, step } from './sim';
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
    expect(g.status).toBe('lost');
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

test('holding half the forest floor wins', () => {
  const g = createLevel1();
  g.covered = Math.ceil(g.growable * C.WIN_COVERAGE);
  step(g, 0.01);
  expect(coverage(g)).toBeGreaterThanOrEqual(C.WIN_COVERAGE);
  expect(g.status).toBe('won');
});
