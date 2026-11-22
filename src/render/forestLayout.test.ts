import { describe, expect, test } from 'vitest';
import { LOG_NUTRIENTS } from '../game/constants';
import { createLevel1, TILE } from '../game/world';
import { crownLayout, floorScatter, lightAt, lightSpots, logLook, rockOutline, sway, TS } from './forestLayout';

describe('the forest floor', () => {
  test('one crown per tree, sorted top to bottom, in varied sizes', () => {
    const g = createLevel1(3);
    const crowns = crownLayout(g);
    expect(crowns).toHaveLength(g.tiles.filter((t) => t === TILE.TREE).length);
    for (let k = 1; k < crowns.length; k++) expect(crowns[k].y).toBeGreaterThanOrEqual(crowns[k - 1].y);
    const sizes = crowns.map((c) => c.r);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(TS * 0.58);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(TS * 0.9);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeGreaterThan(TS * 0.2);
    expect(crownLayout(createLevel1(3))).toEqual(crowns); // the same forest looks the same
  });

  test('trees sway only a little', () => {
    const c = crownLayout(createLevel1(3))[0];
    for (let t = 0; t < 30; t += 0.7) {
      const s = sway(c, t);
      expect(Math.abs(s.dx)).toBeLessThan(1);
      expect(Math.abs(s.turn)).toBeLessThan(0.04);
    }
  });

  test('logs shrink and crumble as they rot', () => {
    const fresh = logLook(LOG_NUTRIENTS);
    const half = logLook(LOG_NUTRIENTS / 2);
    const gone = logLook(0);
    expect(fresh).toMatchObject({ rot: 0, length: 1, crumbs: 0 });
    expect(half.length).toBeLessThan(fresh.length);
    expect(half.crumbs).toBeGreaterThan(0);
    expect(gone.length).toBeLessThan(half.length);
    expect(gone.crumbs).toBeGreaterThan(half.crumbs);
    expect(logLook(LOG_NUTRIENTS * 0.99).stage).toBe(fresh.stage); // no redraw for tiny changes
  });

  test('rocks come in different shapes and stay on their tile', () => {
    const g = createLevel1(3);
    const rocks = [...g.tiles.keys()].filter((i) => g.tiles[i] === TILE.ROCK);
    const shapes = new Set(rocks.map((i) => rockOutline(g, i).length));
    expect(shapes.size).toBeGreaterThan(1);
    for (const i of rocks) {
      const x = i % g.w;
      const y = (i - x) / g.w;
      const pts = rockOutline(g, i);
      for (let k = 0; k < pts.length; k += 2) {
        expect(Math.abs(pts[k] - (x + 0.5) * TS)).toBeLessThan(TS * 0.75);
        expect(Math.abs(pts[k + 1] - (y + 0.5) * TS)).toBeLessThan(TS * 0.75);
      }
    }
  });

  test('leaves, twigs, pebbles and tufts are scattered over the whole map', () => {
    const g = createLevel1(3);
    const bits = floorScatter(g);
    expect(new Set(bits.map((b) => b.kind))).toEqual(new Set(['leaf', 'twig', 'pebble', 'tuft']));
    expect(bits.every((b) => b.x >= 0 && b.y >= 0 && b.x <= g.w * TS && b.y <= g.h * TS)).toBe(true);
    const left = bits.filter((b) => b.x < (g.w * TS) / 2).length;
    expect(left / bits.length).toBeGreaterThan(0.4);
    expect(left / bits.length).toBeLessThan(0.6);
    expect(floorScatter(createLevel1(3))).toEqual(bits);
  });

  test('patches of light drift and wrap round the map', () => {
    const g = createLevel1(3);
    const [s] = lightSpots(g, 1);
    const w = g.w * TS;
    const h = g.h * TS;
    for (let t = 0; t < 2000; t += 37) {
      const p = lightAt(s, t, w, h);
      expect(p.x).toBeGreaterThanOrEqual(-s.r);
      expect(p.x).toBeLessThanOrEqual(w + s.r);
      expect(p.y).toBeGreaterThanOrEqual(-s.r);
      expect(p.y).toBeLessThanOrEqual(h + s.r);
      expect(p.bright).toBeGreaterThan(0.15);
    }
    expect(lightAt(s, 10, w, h).x).not.toBeCloseTo(lightAt(s, 0, w, h).x);
  });
});
