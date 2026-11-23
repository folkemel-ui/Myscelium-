// Things to build during a round: digest, shelf fungus and spore towers.
import { describe, expect, test } from 'vitest';
import * as C from './constants';
import { newProfile, nextUnlock, unlocked } from './progress';
import { loadRound, saveRound } from './save';
import {
  buildTower, digest, eatTimeFor, newBeetle, placeShelf, plantMushroom, shelfConnected, step, towerAt, underAttack,
} from './sim';
import { createLevel1, idx, inside, TILE, type Game } from './world';

const mother = (g: Game) => g.mushrooms.find((m) => m.mother)!;
const run = (g: Game, seconds: number, dt = 0.1) => {
  for (let t = 0; t < seconds; t += dt) step(g, dt);
};
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// A tree with mycelium next to it (laid down by hand for the test), and that mycelium tile.
function treeByNetwork(g: Game) {
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    if (g.tiles[idx(g, x, y)] !== TILE.TREE) continue;
    for (const [dx, dy] of SIDES) {
      const nx = x + dx;
      const ny = y + dy;
      if (inside(g, nx, ny) && g.tiles[idx(g, nx, ny)] === TILE.SOIL) {
        g.mycelium[idx(g, nx, ny)] = 1;
        g.covered++;
        return { tree: { x, y }, thread: { x: nx, y: ny } };
      }
    }
  }
  throw new Error('no tree');
}

// A quiet round: no beetles until we say so.
const quiet = (seed = 3) => {
  const g = createLevel1(seed);
  g.rules = { ...g.rules, firstBeetleAt: 1e9 };
  return g;
};

describe('digest', () => {
  test('swaps spores for nutrients and nutrients for spores', () => {
    const g = quiet();
    g.spores = 25;
    g.nutrients = 0;
    expect(digest(g, 'nutrients')).toBeNull();
    expect(g.spores).toBe(25 - C.DIGEST_SPORES_IN);
    expect(g.nutrients).toBe(C.DIGEST_NUTRIENTS_OUT);
    g.nutrients = 7;
    expect(digest(g, 'spores')).toBeNull();
    expect(g.nutrients).toBe(7 - C.DIGEST_NUTRIENTS_IN);
    expect(g.spores).toBe(25 - C.DIGEST_SPORES_IN + C.DIGEST_SPORES_OUT);
  });

  test('says why when there is not enough, and changes nothing', () => {
    const g = quiet();
    g.spores = 9;
    g.nutrients = 4;
    expect(digest(g, 'nutrients')).toMatch(/10 spores/);
    expect(digest(g, 'spores')).toMatch(/5 nutrients/);
    expect([g.spores, g.nutrients]).toEqual([9, 4]);
  });

  test('a round trip loses something, so it is a swap and not a money machine', () => {
    // 10 spores make 3 nutrients; 3 nutrients are worth less than 5, which would give back 8 spores.
    expect((C.DIGEST_NUTRIENTS_OUT / C.DIGEST_NUTRIENTS_IN) * C.DIGEST_SPORES_OUT).toBeLessThan(C.DIGEST_SPORES_IN);
  });
});

describe('shelf fungus', () => {
  test('grows on a tree that touches the network, for its price', () => {
    const g = quiet();
    const { tree } = treeByNetwork(g);
    g.nutrients = C.SHELF_COST + 1;
    expect(placeShelf(g, tree.x, tree.y)).toBeNull();
    expect(g.shelves).toHaveLength(1);
    expect(g.nutrients).toBeCloseTo(1);
    expect(placeShelf(g, tree.x, tree.y)).toMatch(/already/);
  });

  test('not on open ground, nor on a tree away from the network, nor when too poor', () => {
    const g = quiet();
    const m = mother(g);
    g.nutrients = 100;
    expect(placeShelf(g, m.x, m.y)).toMatch(/trees/);
    let far = -1;
    for (let i = 0; i < g.tiles.length && far < 0; i++) {
      if (g.tiles[i] === TILE.TREE && !shelfConnected(g, { x: i % g.w, y: Math.floor(i / g.w) })) far = i;
    }
    expect(placeShelf(g, far % g.w, Math.floor(far / g.w))).toMatch(/touch/);
    const { tree } = treeByNetwork(g);
    g.nutrients = C.SHELF_COST - 1;
    expect(placeShelf(g, tree.x, tree.y)).toMatch(/costs/);
    expect(g.shelves).toHaveLength(0);
  });

  test('makes nutrients while connected, and none once cut off', () => {
    const g = quiet();
    const { tree, thread } = treeByNetwork(g);
    g.nutrients = C.SHELF_COST;
    placeShelf(g, tree.x, tree.y);
    // Compare with the same round without the shelf, so the logs' nutrients don't count.
    const without = quiet();
    without.mycelium[idx(without, thread.x, thread.y)] = 1;
    without.covered++;
    without.creep = -1e9; // no creep in either, so the networks stay the same
    g.creep = -1e9;
    run(g, 10);
    run(without, 10);
    expect(g.nutrients - without.nutrients).toBeCloseTo(10 * C.SHELF_NUTRIENTS, 1);
    // Cut it off: every tile round the tree loses its mycelium.
    for (const [dx, dy] of SIDES) if (inside(g, tree.x + dx, tree.y + dy)) g.mycelium[idx(g, tree.x + dx, tree.y + dy)] = 0;
    expect(shelfConnected(g, g.shelves[0])).toBe(false);
    const before = g.nutrients;
    const beforeWithout = without.nutrients;
    for (const [dx, dy] of SIDES) if (inside(without, tree.x + dx, tree.y + dy)) without.mycelium[idx(without, tree.x + dx, tree.y + dy)] = 0;
    run(g, 5);
    run(without, 5);
    expect(g.nutrients - before).toBeCloseTo(without.nutrients - beforeWithout, 5);
    expect(g.shelves).toHaveLength(1); // dormant, not gone
  });
});

describe('spore towers', () => {
  const placed = () => {
    const g = quiet();
    const m = mother(g);
    g.nutrients = C.TOWER_NUTRIENTS;
    g.spores = C.TOWER_SPORES;
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy }))
      .find((p) => g.mycelium[idx(g, p.x, p.y)] && g.tiles[idx(g, p.x, p.y)] !== TILE.LOG)!;
    expect(buildTower(g, spot.x, spot.y)).toBeNull();
    return { g, t: g.towers[0] };
  };

  test('built on mycelium for nutrients and spores', () => {
    const { g, t } = placed();
    expect(g.nutrients).toBe(0);
    expect(g.spores).toBe(0);
    expect(towerAt(g, t.x, t.y)).toBe(t);
    g.nutrients = 100;
    g.spores = 100;
    expect(buildTower(g, t.x, t.y)).toMatch(/already/);
    expect(plantMushroom(g, t.x, t.y)).toMatch(/tower/);
    const m = mother(g);
    expect(buildTower(g, m.x, m.y)).toMatch(/mushroom/);
    expect(buildTower(g, 0, 0)).toMatch(/mycelium/);
  });

  test('needs both prices', () => {
    const g = quiet();
    const m = mother(g);
    g.nutrients = C.TOWER_NUTRIENTS;
    g.spores = C.TOWER_SPORES - 1;
    expect(buildTower(g, m.x + 1, m.y)).toMatch(/costs/);
    expect(g.towers).toHaveLength(0);
  });

  test('shoots the nearest beetle in range once a second, and tells the drawing', () => {
    const { g, t } = placed();
    const near = { ...newBeetle(g, t.x + 0.5 + 2, t.y + 0.5), hp: 10, speed: 0 };
    const far = { ...newBeetle(g, t.x + 0.5 + 4, t.y + 0.5), hp: 10, speed: 0 };
    const outside = { ...newBeetle(g, t.x + 0.5 + C.TOWER_RANGE + 1, t.y + 0.5), hp: 10, speed: 0 };
    g.beetles.push(near, far, outside);
    g.mushrooms = g.mushrooms.filter((m) => !m.mother).concat([{ ...mother(g), puffTimer: 1e9 }]); // the mother keeps still
    g.events.length = 0;
    run(g, 2.95);
    expect(near.hp).toBe(10 - 3 * C.TOWER_DAMAGE); // at 0, 1 and 2 s
    expect(far.hp).toBe(10);
    expect(outside.hp).toBe(10);
    const shots = g.events.filter((e) => e.kind === 'shot');
    expect(shots).toHaveLength(3);
    expect(shots[0]).toMatchObject({ tower: t.id, beetle: near.id, x: t.x + 0.5, y: t.y + 0.5 });
  });

  test('a tower with nothing in range keeps its shot ready', () => {
    const { g, t } = placed();
    run(g, 3);
    expect(t.timer).toBe(0);
    expect(g.events.filter((e) => e.kind === 'shot')).toHaveLength(0);
  });

  test('beetles eat it as slowly as a mushroom, and it falls with its tile', () => {
    const { g, t } = placed();
    const tile = idx(g, t.x, t.y);
    expect(eatTimeFor(g, tile)).toBe(g.mods.eatTime * C.TOWER_EAT_FACTOR);
    const b = { ...newBeetle(g, t.x + 0.5, t.y + 0.5), aim: 'mushroom' as const, hp: 100, target: tile, eatTimer: 0.01 };
    g.beetles.push(b);
    const attacked = underAttack(g).find((a) => a.tower)!;
    expect(attacked).toMatchObject({ x: t.x, y: t.y, mother: false });
    run(g, g.mods.eatTime * C.TOWER_EAT_FACTOR + 0.3);
    expect(g.mycelium[tile]).toBe(0);
    expect(g.towers).toHaveLength(0);
  });

  test('beetles that hunt mushrooms go for towers too', () => {
    const { g, t } = placed();
    const b = { ...newBeetle(g, t.x + 0.5 + 3, t.y + 0.5), aim: 'mushroom' as const, hp: 100 };
    g.beetles.push(b);
    step(g, 0.1);
    expect(b.target).toBe(idx(g, t.x, t.y));
  });
});

describe('saving what was built', () => {
  test('shelves and towers come back with a loaded round, and older saves load without them', () => {
    const g = quiet();
    const { tree } = treeByNetwork(g);
    g.nutrients = 200;
    g.spores = 200;
    placeShelf(g, tree.x, tree.y);
    const m = mother(g);
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy }))
      .find((p) => g.mycelium[idx(g, p.x, p.y)] && g.tiles[idx(g, p.x, p.y)] !== TILE.LOG)!;
    buildTower(g, spot.x, spot.y);
    g.towers[0].timer = 0.4;
    const copy = loadRound(JSON.parse(JSON.stringify(saveRound(g))))!;
    expect(copy.shelves).toEqual(g.shelves);
    expect(copy.towers).toEqual(g.towers);
    const old = saveRound(g) as unknown as Record<string, unknown>;
    delete old.shelves;
    delete old.towers;
    const loaded = loadRound(old)!;
    expect(loaded.shelves).toEqual([]);
    expect(loaded.towers).toEqual([]);
  });
});

describe('what opens with the player level', () => {
  test('digest at 2, shelf fungus at 3, spore tower at 5', () => {
    const at = (level: number) => ({ ...newProfile(), level });
    expect(unlocked(at(1), 'digest')).toBe(false);
    expect(unlocked(at(2), 'digest')).toBe(true);
    expect(unlocked(at(2), 'shelf')).toBe(false);
    expect(unlocked(at(3), 'shelf')).toBe(true);
    expect(unlocked(at(4), 'tower')).toBe(false);
    expect(unlocked(at(5), 'tower')).toBe(true);
    expect(nextUnlock(at(1))?.id).toBe('digest');
    expect(nextUnlock(at(3))?.id).toBe('tower');
    expect(nextUnlock(at(5))).toBeNull();
  });
});
