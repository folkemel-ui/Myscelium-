import { describe, expect, test } from 'vitest';
import { makeRng } from '../game/rng';
import {
  flip, FLIP_TIME, FADE_TIME, legSwing, moveParticle, sparkleAt, sporeBurst, sproutScale, SPROUT_TIME, squashScale,
  SQUASH_TIME,
} from './anim';

describe('animations', () => {
  test('a new mushroom pushes up, overshoots, and settles', () => {
    expect(sproutScale(0).sy).toBe(0);
    expect(sproutScale(SPROUT_TIME)).toEqual({ sx: 1, sy: 1 });
    let peak = 0;
    for (let t = 0; t < SPROUT_TIME; t += 0.01) peak = Math.max(peak, sproutScale(t).sy);
    expect(peak).toBeGreaterThan(1.03); // it overshoots
    expect(peak).toBeLessThan(1.25);
  });

  test('a bursting cap squashes and springs back', () => {
    expect(squashScale(0)).toEqual({ sx: 1, sy: 1 });
    expect(squashScale(0.01).sy).toBeLessThan(0.7);
    expect(squashScale(0.01).sx).toBeGreaterThan(1.15); // bulges out as it squashes
    expect(squashScale(SQUASH_TIME)).toEqual({ sx: 1, sy: 1 });
    expect(Math.abs(squashScale(SQUASH_TIME - 0.01).sy - 1)).toBeLessThan(0.03); // nearly still at the end
  });

  test('beetle legs move in two tripods', () => {
    for (const phase of [0.3, 1.1, 2.5]) {
      expect(legSwing(phase, 0, 1)).toBeCloseTo(-legSwing(phase, 1, 1)); // neighbours opposite
      expect(legSwing(phase, 0, 1)).toBeCloseTo(-legSwing(phase, 0, -1)); // sides opposite
      expect(legSwing(phase, 0, 1)).toBeCloseTo(legSwing(phase, 2, 1)); // front and back together
    }
  });

  test('a beaten beetle flips over, then fades', () => {
    expect(flip(0)).toMatchObject({ scaleY: 1, alpha: 1, done: false });
    expect(flip(FLIP_TIME).scaleY).toBeCloseTo(-1);
    expect(flip(FLIP_TIME).alpha).toBe(1);
    expect(flip(FLIP_TIME + FADE_TIME)).toMatchObject({ alpha: 0, done: true });
  });

  test('sparkles arc from where the beetle fell to the counter', () => {
    const a = { x: 400, y: 300 };
    const b = { x: 120, y: 30 };
    expect(sparkleAt(a, b, 0, 60)).toEqual(a);
    const end = sparkleAt(a, b, 1, 60);
    expect(end.x).toBeCloseTo(b.x);
    expect(end.y).toBeCloseTo(b.y);
  });

  test('spores fly out to about the edge of the cloud, and fade', () => {
    const rand = makeRng(5);
    const range = 70;
    const spores = sporeBurst(0, 0, range, 60, [1, 2, 3], rand);
    expect(spores).toHaveLength(60);
    const ends: number[] = [];
    for (const p of spores) {
      while (moveParticle(p, 1 / 60));
      ends.push(Math.hypot(p.x, p.y));
    }
    const mean = ends.reduce((s, d) => s + d, 0) / ends.length;
    expect(mean).toBeGreaterThan(range * 0.4);
    expect(mean).toBeLessThan(range * 1.1);
    expect(Math.max(...ends)).toBeLessThan(range * 1.15);
  });
});
