import { describe, expect, test } from 'vitest';
import { createLevel1, idx } from '../game/world';
import { BOLT_TIME, boltAt, shelfFacing, towerKick } from './buildings';

describe('drawing what is built', () => {
  test('a shelf faces the side of its tree that touches the network', () => {
    const g = createLevel1(3);
    g.mycelium.fill(0);
    expect(shelfFacing(g, 10, 10)).toEqual([0, 1]); // nothing near: below
    g.mycelium[idx(g, 9, 10)] = 1;
    expect(shelfFacing(g, 10, 10)).toEqual([-1, 0]);
    g.mycelium[idx(g, 10, 11)] = 1;
    expect(shelfFacing(g, 10, 10)).toEqual([0, 1]); // below wins
  });

  test('a bolt flies from tower to beetle, flashes and is gone', () => {
    expect(boltAt(0)).toEqual({ along: 0, alpha: 1 });
    expect(boltAt(BOLT_TIME / 2)!.along).toBeCloseTo(0.5);
    expect(boltAt(BOLT_TIME)).toEqual({ along: 1, alpha: 1 });
    expect(boltAt(BOLT_TIME * 1.3)!.alpha).toBeCloseTo(0.5);
    expect(boltAt(BOLT_TIME * 2)).toBeNull();
    expect(boltAt(-0.1)).toBeNull();
  });

  test('a tower swells when it shoots and settles back', () => {
    expect(towerKick(0)).toBeCloseTo(1.25);
    expect(towerKick(0.15)).toBeCloseTo(1.125);
    expect(towerKick(0.5)).toBe(1);
    expect(towerKick(-Infinity)).toBe(1);
  });
});
