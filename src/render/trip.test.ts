import { describe, expect, test } from 'vitest';
import {
  bandAt, floaterCount, hueShift, MAX_FLOATERS, MAX_HUE, MIN_FLOATERS, RIPPLE_EVERY, RIPPLE_LIFE, ripplesAt, stageFor,
  stageStrength, stageWave, STAGE_WAVE_TIME,
} from './trip';

describe('the trip', () => {
  test('stages are reached at a quarter, half, three quarters and all of the goal', () => {
    expect([0, 0.24, 0.25, 0.49, 0.5, 0.75, 0.99, 1, 1.2].map(stageFor)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4]);
  });

  test('a new stage fades in rather than popping', () => {
    expect(stageStrength(0.25, 1)).toBeCloseTo(0.35);
    expect(stageStrength(0.49, 1)).toBeGreaterThan(0.9);
    expect(stageStrength(0.1, 0)).toBe(0);
  });

  test('colours do not drift at the start, and drift at most MAX_HUE degrees at the goal', () => {
    for (let t = 0; t < 200; t += 3.7) {
      expect(hueShift(t, 0)).toBeCloseTo(0);
      expect(Math.abs(hueShift(t, 1))).toBeLessThanOrEqual(MAX_HUE);
      expect(Math.abs(hueShift(t, 0.3))).toBeLessThan(MAX_HUE * 0.1);
    }
    const swing = Math.max(...Array.from({ length: 200 }, (_, k) => Math.abs(hueShift(k, 1))));
    expect(swing).toBeGreaterThan(MAX_HUE * 0.6);
  });

  test('more specks float the further the spread', () => {
    expect(floaterCount(0)).toBe(MIN_FLOATERS);
    expect(floaterCount(1)).toBe(MAX_FLOATERS);
    expect(floaterCount(0.5)).toBeGreaterThan(MIN_FLOATERS);
    expect(floaterCount(0.5)).toBeLessThan(MAX_FLOATERS);
  });

  test('the stage wave rolls out across the map and fades', () => {
    expect(stageWave(-0.1)).toBeNull();
    expect(stageWave(0)).toMatchObject({ reach: 0, bright: 1, flash: 1 });
    expect(stageWave(STAGE_WAVE_TIME / 2)!.reach).toBeGreaterThan(0.5);
    expect(stageWave(STAGE_WAVE_TIME)).toBeNull();
  });

  test('ripples leave the mother regularly, a few alive at once', () => {
    expect(ripplesAt(0)).toEqual([0]);
    const alive = ripplesAt(30);
    expect(alive.length).toBeGreaterThanOrEqual(Math.floor(RIPPLE_LIFE / RIPPLE_EVERY));
    expect(alive.length).toBeLessThanOrEqual(Math.ceil(RIPPLE_LIFE / RIPPLE_EVERY));
    expect(alive.every((r) => r >= 0 && r < 1)).toBe(true);
  });

  test('the colour band sweeps across and changes colour each lap', () => {
    expect(bandAt(0).pos).toBeLessThan(0);
    expect(bandAt(8.9).pos).toBeGreaterThan(1);
    expect(bandAt(9.1).colour).toBe(bandAt(0).colour + 1);
  });
});
