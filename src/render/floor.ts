// Paints the forest floor once per forest onto a canvas: soft blended soil, shade under the
// trees, leaves, twigs, pebbles, tufts of grass, and the rocks. Pixi shows it as one texture, so
// the floor costs nothing per frame.
import { TILE, type Game } from '../game/world';
import { crownLayout, floorScatter, forestRng, hash, rockOutline, TS } from './forestLayout';

export const FLOOR_RES = 2; // canvas pixels per world pixel, so it stays sharp when scaled up

const SOIL = '#6b573d';
const PATCHES = ['#5a4630', '#7f6646', '#665a48', '#5c6338', '#735237', '#544232'];
const LEAVES = ['#8a6a35', '#a07a3a', '#6f5a2e', '#7a7a3a', '#9a5a2e', '#b08a48'];
const TUFTS = ['#6f8a3a', '#5f7a34', '#7f9a44'];

export function paintFloor(g: Game): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = g.w * TS * FLOOR_RES;
  canvas.height = g.h * TS * FLOOR_RES;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(FLOOR_RES, FLOOR_RES);
  const W = g.w * TS;
  const H = g.h * TS;
  const rng = forestRng(g);

  // Soil: a base colour with large soft patches blended over it.
  ctx.fillStyle = SOIL;
  ctx.fillRect(0, 0, W, H);
  const patches = Math.round((g.w * g.h) / 6);
  for (let k = 0; k < patches; k++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = TS * (1.2 + rng() * 3);
    softSpot(ctx, x, y, r, PATCHES[Math.floor(rng() * PATCHES.length)], 0.45);
  }
  // A fine grain of specks.
  for (let k = 0; k < g.w * g.h * 3; k++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 240, 210, 0.08)';
    ctx.fillRect(rng() * W, rng() * H, 1, 1);
  }

  // Shade under the trees (the crowns themselves are drawn on top, by Pixi, so they can sway).
  for (const c of crownLayout(g)) softSpot(ctx, c.x + 4, c.y + 5, c.r * 1.35, '#1c160c', 0.5);

  // Leaves, twigs, pebbles and tufts, but not on rocks or under trunks.
  for (const s of floorScatter(g)) {
    const t = g.tiles[Math.floor(s.y / TS) * g.w + Math.floor(s.x / TS)];
    if (t === TILE.ROCK || (t === TILE.TREE && s.kind === 'tuft')) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    if (s.kind === 'leaf') {
      ctx.fillStyle = LEAVES[Math.floor(s.tone * LEAVES.length)];
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.4 * s.size, 1.2 * s.size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60, 40, 20, 0.5)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(-2.4 * s.size, 0);
      ctx.lineTo(2.4 * s.size, 0);
      ctx.stroke();
    } else if (s.kind === 'twig') {
      const len = 5 + 5 * s.size;
      ctx.strokeStyle = '#4e3a24';
      ctx.lineWidth = 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 2, 0);
      ctx.moveTo(len * 0.1, 0);
      ctx.lineTo(len * 0.3, -len * 0.25);
      ctx.stroke();
    } else if (s.kind === 'pebble') {
      const r = 0.9 + s.size;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.arc(0.6, 0.7, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.tone < 0.5 ? '#8f8a80' : '#a09a8c';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(-s.angle); // grass grows upwards
      ctx.strokeStyle = TUFTS[Math.floor(s.tone * TUFTS.length)];
      ctx.lineWidth = 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let b = -2; b <= 2; b++) {
        ctx.moveTo(b * 0.8, 0);
        ctx.quadraticCurveTo(b * 1.2, -2 * s.size, b * 1.8 + (s.tone - 0.5) * 2, -3.5 * s.size);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Rocks: an irregular outline, a shadow, a light top-left face, a crack and some moss.
  for (let i = 0; i < g.tiles.length; i++) {
    if (g.tiles[i] !== TILE.ROCK) continue;
    const pts = rockOutline(g, i);
    const path = (dx: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(pts[0] + dx, pts[1] + dy);
      for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k] + dx, pts[k + 1] + dy);
      ctx.closePath();
    };
    const x = i % g.w;
    const cx = (x + 0.5) * TS;
    const cy = ((i - x) / g.w + 0.5) * TS;
    path(2, 2.5);
    ctx.fillStyle = 'rgba(15, 10, 5, 0.4)';
    ctx.fill();
    const grey = 120 + Math.floor(hash(g, i, 40) * 30);
    const face = ctx.createLinearGradient(cx - TS / 2, cy - TS / 2, cx + TS / 2, cy + TS / 2);
    face.addColorStop(0, `rgb(${grey + 30}, ${grey + 28}, ${grey + 22})`);
    face.addColorStop(1, `rgb(${grey - 35}, ${grey - 36}, ${grey - 38})`);
    path(0, 0);
    ctx.fillStyle = face;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(40, 35, 30, 0.45)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - 2 + hash(g, i, 41) * 4, cy - TS * 0.3);
    ctx.lineTo(cx + 1, cy);
    ctx.lineTo(cx - 1 + hash(g, i, 42) * 4, cy + TS * 0.3);
    ctx.stroke();
    if (hash(g, i, 43) < 0.7) softSpot(ctx, cx - TS * 0.15, cy - TS * 0.2, TS * 0.28, '#6a8a3a', 0.85);
    ctx.restore();
  }
  return canvas;
}

// A soft round spot that fades out to its edge.
function softSpot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, color + '00');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

// A white spot fading to nothing, as a texture for patches of light.
export function paintLightSpot(size = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}
