import { describe, expect, test } from 'vitest';
import { describeTile } from './info';
import { burstable, burstAll, growMycelium, newBeetle, plantMushroom } from './sim';
import { createLevel1, idx, TILE, type Game } from './world';

// A round with the mother and one more mushroom 4 tiles to her right, on a network between them.
function withTwoMushrooms(): Game {
  const g = createLevel1(5);
  g.spores = 1000;
  g.nutrients = 1000;
  const mother = g.mushrooms[0];
  for (let x = mother.x + 1; x <= mother.x + 4; x++) growMycelium(g, x, mother.y);
  expect(plantMushroom(g, mother.x + 4, mother.y)).toBeNull();
  return g;
}
const beetleAt = (g: Game, x: number, y: number) => {
  const b = newBeetle(g, x + 0.5, y + 0.5);
  g.beetles.push(b);
  return b;
};

describe('burst all', () => {
  test('bursts only the ready mushrooms with a beetle in reach', () => {
    const g = withTwoMushrooms();
    const [mother, other] = g.mushrooms;
    expect(burstAll(g)).toBe('No beetles near a ready mushroom');
    beetleAt(g, other.x + 2, other.y); // near the new mushroom only (the mother is 6 tiles off)
    expect(burstable(g)).toEqual([other]);
    expect(burstAll(g)).toBeNull();
    expect(other.cooldown).toBeGreaterThan(0);
    expect(mother.cooldown).toBe(0);
    expect(g.stats.bursts).toBe(1);
    expect(burstAll(g)).toBe('No beetles near a ready mushroom');
  });

  test('a beetle already beaten by one burst does not use up the next mushroom', () => {
    const g = withTwoMushrooms();
    const [mother, other] = g.mushrooms;
    const b = beetleAt(g, mother.x + 2, mother.y); // in reach of both
    b.hp = 1;
    expect(burstable(g).length).toBe(2);
    burstAll(g);
    expect(g.stats.bursts).toBe(1);
    expect(mother.cooldown > 0 || other.cooldown > 0).toBe(true);
    expect(mother.cooldown > 0 && other.cooldown > 0).toBe(false);
  });

  test('says when nothing is ready', () => {
    const g = withTwoMushrooms();
    for (const m of g.mushrooms) m.cooldown = 3;
    beetleAt(g, g.mushrooms[0].x + 1, g.mushrooms[0].y);
    expect(burstAll(g)).toBe('No mushroom is ready to burst');
  });
});

describe('what a long press shows', () => {
  test('the mother, a mushroom on cooldown, and one being eaten', () => {
    const g = withTwoMushrooms();
    const [mother, other] = g.mushrooms;
    expect(describeTile(g, mother.x, mother.y)!.title).toBe('The mother');
    expect(describeTile(g, mother.x, mother.y)!.lines).toContain('Burst ready: tap to burst');
    other.cooldown = 2.4;
    expect(describeTile(g, other.x, other.y)!.lines).toContain('Burst ready in 3 s');
    const b = beetleAt(g, other.x, other.y);
    b.target = idx(g, other.x, other.y);
    b.eatTimer = 0.5;
    // The beetle on the tile is what the finger meant.
    expect(describeTile(g, other.x, other.y)!.title).toBe('Beetle');
    expect(describeTile(g, other.x, other.y)!.warning).toBe('Eating your mycelium!');
    b.x += 2; // walked off a little: the mushroom again, under attack
    const info = describeTile(g, other.x, other.y)!;
    expect(info.title).toBe('Mushroom');
    expect(info.warning).toMatch(/^Being eaten! \(\d+%\)$/);
  });

  test('a beetle shows its health and what it goes for', () => {
    const g = withTwoMushrooms();
    const b = beetleAt(g, 2, 2);
    b.aim = 'mother';
    b.hp = 2;
    const info = describeTile(g, 2, 2)!;
    expect(info.lines[0]).toBe(`Health 2 of ${b.maxHp}`);
    expect(info.lines[1]).toBe('Goes for the mother');
  });

  test('the ground: logs, trees, your mycelium and open floor', () => {
    const g = withTwoMushrooms();
    const find = (t: number) => {
      const i = g.tiles.findIndex((v, k) => v === t && !g.mycelium[k]);
      return [i % g.w, Math.floor(i / g.w)] as const;
    };
    const [lx, ly] = find(TILE.LOG);
    expect(describeTile(g, lx, ly)!.lines[0]).toMatch(/^30 nutrients inside$/);
    const [tx, ty] = find(TILE.TREE);
    expect(describeTile(g, tx, ty)!.title).toBe('Tree');
    const m = g.mushrooms[0];
    expect(describeTile(g, m.x + 2, m.y)!.title).toBe('Your mycelium');
    expect(describeTile(g, -1, 0)).toBeNull();
  });
});
