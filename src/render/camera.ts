// The camera: how far in the player has zoomed and where they are looking. Plain maths, tested.
//
// Zoom 1 shows the whole map, fitted into the view area (below the panel); zoom 4 is the closest.
// The camera never shows past the map's edges: when the map is smaller than the view it is centred,
// otherwise it is kept covering the view.

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface Camera {
  zoom: number;
  cx: number; // the world point at the middle of the view, in world pixels
  cy: number;
}

// Where the map can be shown: a rectangle of the screen, the map's size in world pixels, and the
// scale at which the whole map just fits.
export interface Viewport {
  x0: number;
  y0: number;
  w: number;
  h: number;
  mapW: number;
  mapH: number;
  fit: number;
}

export interface Placement {
  scale: number;
  x: number; // where the map's top-left corner goes on the screen
  y: number;
}

export const homeCamera = (v: Pick<Viewport, 'mapW' | 'mapH'>): Camera => ({ zoom: 1, cx: v.mapW / 2, cy: v.mapH / 2 });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// One axis: centre the map if it is smaller than the view, otherwise keep it covering the view.
function clampAxis(pos: number, size: number, start: number, span: number) {
  if (size <= span) return start + (span - size) / 2;
  return clamp(pos, start + span - size, start);
}

// Where the map goes on the screen for a camera, and the camera as it really ends up (pulled back
// inside the map's edges).
export function place(cam: Camera, v: Viewport): { at: Placement; cam: Camera } {
  const zoom = clamp(cam.zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = v.fit * zoom;
  const midX = v.x0 + v.w / 2;
  const midY = v.y0 + v.h / 2;
  const x = clampAxis(midX - cam.cx * scale, v.mapW * scale, v.x0, v.w);
  const y = clampAxis(midY - cam.cy * scale, v.mapH * scale, v.y0, v.h);
  return { at: { scale, x, y }, cam: { zoom, cx: (midX - x) / scale, cy: (midY - y) / scale } };
}

// Zoom by a factor, keeping the world point under a screen point where it is.
export function zoomAt(cam: Camera, factor: number, sx: number, sy: number, v: Viewport): Camera {
  const { at } = place(cam, v);
  const wx = (sx - at.x) / at.scale;
  const wy = (sy - at.y) / at.scale;
  const zoom = clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const scale = v.fit * zoom;
  const x = sx - wx * scale;
  const y = sy - wy * scale;
  return place({ zoom, cx: (v.x0 + v.w / 2 - x) / scale, cy: (v.y0 + v.h / 2 - y) / scale }, v).cam;
}

// Move the view by a drag of (dx, dy) screen pixels: the map follows the finger.
export function panBy(cam: Camera, dx: number, dy: number, v: Viewport): Camera {
  const scale = v.fit * cam.zoom;
  return place({ ...cam, cx: cam.cx - dx / scale, cy: cam.cy - dy / scale }, v).cam;
}

type Pt = { x: number; y: number };

// Two fingers moved from (a, b) to (a2, b2): zoom by how much further apart they are, around
// their middle, and move with the middle.
export function pinch(cam: Camera, a: Pt, b: Pt, a2: Pt, b2: Pt, v: Viewport): Camera {
  const before = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const after = Math.hypot(a2.x - b2.x, a2.y - b2.y) || 1;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const mid2 = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
  const zoomed = zoomAt(cam, after / before, mid.x, mid.y, v);
  return panBy(zoomed, mid2.x - mid.x, mid2.y - mid.y, v);
}
