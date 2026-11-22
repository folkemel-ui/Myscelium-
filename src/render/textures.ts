// Small textures drawn once on a canvas and shared: a soft dot (spores, specks), a soft band (the
// colour wave) and a kaleidoscope tile (the edges at stage 3).
import { Texture } from 'pixi.js';
import { GLOW } from './forestLayout';

export const DOT_SIZE = 32; // the soft dot's size in pixels; a dot of radius r is drawn at r * 2 / DOT_SIZE

const cache = new Map<string, Texture>();
const once = (key: string, paint: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void, w: number, h: number) => {
  let t = cache.get(key);
  if (!t) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    paint(canvas.getContext('2d')!, canvas);
    t = Texture.from(canvas);
    cache.set(key, t);
  }
  return t;
};

export const dotTexture = () =>
  once('dot', (ctx) => {
    const c = DOT_SIZE / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, DOT_SIZE, DOT_SIZE);
  }, DOT_SIZE, DOT_SIZE);

// White, fading out to both sides: tinted and stretched into the sweeping colour band.
export const bandTexture = () =>
  once('band', (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 4);
  }, 128, 4);

// A square of triangles in the glow colours, mirrored both ways like a kaleidoscope, so it tiles
// without seams.
export const kaleidoTexture = () =>
  once('kaleido', (ctx) => {
    const S = 64;
    const h = S / 2;
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    const quarter = () => {
      const tris: [number, number, number, number, number, number, number][] = [
        [0, 0, h, 0, 0, h, 0], [h, 0, h, h, 0, h, 1], [0, 0, h * 0.5, h * 0.5, 0, h, 2],
        [h, 0, h * 0.5, h * 0.5, h, h, 3], [h * 0.25, h * 0.75, h * 0.5, h * 0.5, h * 0.75, h * 0.75, 4],
      ];
      for (const [x1, y1, x2, y2, x3, y3, c] of tris) {
        ctx.fillStyle = hex(GLOW[c % GLOW.length]);
        ctx.globalAlpha = 0.55 + 0.1 * c;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      ctx.save();
      ctx.translate(h, h);
      ctx.scale(sx, sy);
      ctx.translate(-h, -h);
      quarter();
      ctx.restore();
    }
  }, 64, 64);
