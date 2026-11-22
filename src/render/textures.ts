// Small textures drawn once on a canvas and shared: a soft dot (spores, specks, glows) and a soft
// band (the colour wave).
import { Texture } from 'pixi.js';

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
