import { describe, expect, test } from 'vitest';
import { homeCamera, MAX_ZOOM, panBy, pinch, place, zoomAt, type Viewport } from './camera';

// A 960×640 map in a 1200×700 view starting 60 px down, fitting at 1.0 (height-bound).
const v: Viewport = { x0: 0, y0: 60, w: 1200, h: 640, mapW: 960, mapH: 640, fit: 1 };

describe('the camera', () => {
  test('zoom 1 shows the whole map, centred', () => {
    const { at } = place(homeCamera(v), v);
    expect(at).toEqual({ scale: 1, x: 120, y: 60 });
  });

  test('zooming keeps the point under the fingers where it is', () => {
    const sx = 400;
    const sy = 300;
    const before = place(homeCamera(v), v).at;
    const world = { x: (sx - before.x) / before.scale, y: (sy - before.y) / before.scale };
    const cam = zoomAt(homeCamera(v), 2, sx, sy, v);
    const after = place(cam, v).at;
    expect(after.scale).toBe(2);
    expect(after.x + world.x * after.scale).toBeCloseTo(sx);
    expect(after.y + world.y * after.scale).toBeCloseTo(sy);
  });

  test('zoom stays between the whole map and MAX_ZOOM', () => {
    expect(zoomAt(homeCamera(v), 0.2, 600, 380, v).zoom).toBe(1);
    expect(zoomAt(homeCamera(v), 99, 600, 380, v).zoom).toBe(MAX_ZOOM);
  });

  test('the map follows a drag, but never shows past its edges', () => {
    const zoomed = zoomAt(homeCamera(v), 2, 600, 380, v);
    const a = place(zoomed, v).at;
    const moved = place(panBy(zoomed, 50, -30, v), v).at;
    expect(moved.x - a.x).toBeCloseTo(50);
    expect(moved.y - a.y).toBeCloseTo(-30);
    // Drag far to the right: the map's left edge stops at the view's left edge.
    const far = place(panBy(zoomed, 5000, 5000, v), v).at;
    expect(far.x).toBe(v.x0);
    expect(far.y).toBe(v.y0);
    // At zoom 1 the map can't be dragged at all.
    expect(place(panBy(homeCamera(v), 300, 200, v), v).at).toEqual(place(homeCamera(v), v).at);
  });

  test('two fingers moving apart zoom in, and moving together drags', () => {
    const cam = pinch(homeCamera(v), { x: 500, y: 380 }, { x: 700, y: 380 }, { x: 400, y: 380 }, { x: 800, y: 380 }, v);
    expect(cam.zoom).toBeCloseTo(2);
    const a = place(cam, v).at;
    const dragged = pinch(cam, { x: 500, y: 380 }, { x: 700, y: 380 }, { x: 520, y: 390 }, { x: 720, y: 390 }, v);
    const b = place(dragged, v).at;
    expect(dragged.zoom).toBeCloseTo(2);
    expect(b.x - a.x).toBeCloseTo(20);
    expect(b.y - a.y).toBeCloseTo(10);
  });
});
