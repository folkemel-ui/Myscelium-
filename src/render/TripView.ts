// The trip: as the mycelium spreads, the forest gets stranger and more colourful.
//   - The ground under the network glows like neon moss (one pixel per tile, smoothed when drawn
//     big, so the glow blends softly from tile to tile).
//   - Tree crowns get glowing outlines, a band of colour sweeps across the forest, and every colour
//     slowly drifts round the colour wheel.
//   - Glowing specks float up from the territory, more the further it spreads.
//   - Stages at 25%, 50%, 75% and 100% of the goal switch on shimmer, ripples and kaleidoscope
//     edges, each arriving with a wave of light from the mother.
import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { Game } from '../game/world';
import { GLOW, glowAt, TS, type Crown } from './forestLayout';
import { bandTexture, DOT_SIZE, dotTexture, kaleidoTexture } from './textures';
import { bandAt, floaterCount, hueShift, ripplesAt, RIPPLE_LIFE, stageFor, stageStrength, stageWave } from './trip';

const MOSS = 0x3ecf5a;
const TWINKLES = 40; // at full shimmer
const KALEIDO_WIDTH = 1.3; // tiles

function mix(a: number, b: number, t: number) {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

interface Speck {
  sprite: Sprite;
  x: number;
  y: number;
  born: number;
  life: number;
  size: number;
  phase: number;
}

export interface TripState {
  hue: number; // degrees to turn every colour
  flash: number; // 0..1, a brief brightening as a stage arrives
  newStage: number | null; // a stage reached this frame
}

export class TripView {
  readonly ground = new Sprite(); // the glowing territory, just above the floor
  readonly rims = new Graphics(); // outlines on the tree crowns
  readonly air = new Container(); // everything floating over the forest
  readonly airMask = new Graphics();
  private band = new Sprite();
  private rings = new Graphics();
  private twinkleLayer = new Container();
  private floaterLayer = new Container();
  private kaleido: TilingSprite[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private groundTexture: Texture | null = null;
  private version = -1;
  private stage = 0;
  private waveAt = -Infinity;
  private rippleStart = 0;
  private twinkles: Speck[] = [];
  private floaters: Speck[] = [];
  private tiles: number[] = []; // mycelium tiles, to place specks on
  private w = 0;
  private h = 0;

  constructor() {
    this.ground.blendMode = 'add';
    this.rims.blendMode = 'add';
    this.air.blendMode = 'add';
    this.band.texture = bandTexture();
    this.band.anchor.set(0.5);
    this.air.addChild(this.band, this.rings, this.twinkleLayer, this.floaterLayer);
    this.air.mask = this.airMask;
  }

  // A new forest: the territory picture, the crown outlines, the edges. Stages already passed
  // (a loaded round) are simply on, without their waves.
  build(g: Game, crowns: Crown[], share: number) {
    this.w = g.w * TS;
    this.h = g.h * TS;
    this.canvas = document.createElement('canvas');
    this.canvas.width = g.w;
    this.canvas.height = g.h;
    this.groundTexture?.destroy(true);
    this.groundTexture = Texture.from(this.canvas);
    this.ground.texture = this.groundTexture;
    this.ground.width = this.w;
    this.ground.height = this.h;
    this.version = -1;
    this.stage = stageFor(share);
    this.waveAt = -Infinity;
    for (const s of [...this.twinkles, ...this.floaters]) s.sprite.destroy();
    this.twinkles = [];
    this.floaters = [];

    // Outlines on the crowns, grouped by colour so each colour is one stroke.
    const rims = this.rims.clear();
    GLOW.forEach((color, k) => {
      const mine = crowns.filter((_, i) => i % GLOW.length === k);
      if (!mine.length) return;
      for (const c of mine) rims.circle(c.x, c.y, c.r * 0.95);
      rims.stroke({ width: 5, color, alpha: 0.18 });
      for (const c of mine) rims.circle(c.x, c.y, c.r * 0.95);
      rims.stroke({ width: 1.4, color, alpha: 0.7 });
    });

    for (const k of this.kaleido) k.destroy();
    const edge = KALEIDO_WIDTH * TS;
    this.kaleido = [
      [0, 0, this.w, edge], [0, this.h - edge, this.w, edge], [0, 0, edge, this.h], [this.w - edge, 0, edge, this.h],
    ].map(([x, y, width, height]) => {
      const t = new TilingSprite({ texture: kaleidoTexture(), width, height });
      t.position.set(x, y);
      t.tileScale.set(0.5);
      this.air.addChild(t);
      return t;
    });
    this.airMask.clear().rect(0, 0, this.w, this.h).fill(0xffffff);
  }

  update(g: Game, clock: number, dt: number, share: number): TripState {
    if (g.version !== this.version) this.paintGround(g);
    const s = Math.min(1, share);

    // A new stage: its wave rolls out from the mother.
    const stage = stageFor(share);
    let newStage: number | null = null;
    if (stage > this.stage) {
      newStage = stage;
      this.waveAt = clock;
      if (stage >= 2 && this.stage < 2) this.rippleStart = clock;
    }
    this.stage = stage;
    const strength = stageStrength(share, stage);

    this.ground.alpha = 0.05 + 0.2 * s;
    this.rims.alpha = Math.max(0, (s - 0.15) / 0.85) * 0.4;

    // The colour band sweeping across.
    const band = bandAt(clock);
    this.band.visible = s > 0.05;
    this.band.tint = GLOW[band.colour % GLOW.length];
    this.band.alpha = 0.06 + 0.16 * s;
    this.band.width = TS * 7;
    this.band.height = Math.hypot(this.w, this.h) * 1.2;
    this.band.rotation = 0.55;
    this.band.position.set(band.pos * this.w, this.h / 2);

    const mother = g.mushrooms.find((m) => m.mother);
    const cx = mother ? (mother.x + 0.5) * TS : this.w / 2;
    const cy = mother ? (mother.y + 0.5) * TS : this.h / 2;
    const far = Math.hypot(Math.max(cx, this.w - cx), Math.max(cy, this.h - cy));
    const rings = this.rings.clear();

    // Ripples, from stage 2.
    if (stage >= 2) {
      ripplesAt(clock - this.rippleStart).forEach((life, k) => {
        rings.circle(cx, cy, life * far).stroke({
          width: 2 + 4 * (1 - life), color: GLOW[(k + Math.floor((clock - this.rippleStart) / RIPPLE_LIFE)) % GLOW.length],
          alpha: 0.45 * (1 - life) * strength,
        });
      });
    }

    // The wave when a stage arrives.
    const wave = stageWave(clock - this.waveAt);
    if (wave) {
      const r = wave.reach * far;
      rings.circle(cx, cy, r).stroke({ width: 26 * wave.bright + 2, color: 0xfff0ff, alpha: 0.5 * wave.bright });
      rings.circle(cx, cy, r).stroke({ width: 4, color: GLOW[(this.stage - 1) % GLOW.length], alpha: 0.9 * wave.bright });
    }

    // Kaleidoscope edges, from stage 3, drifting along the sides.
    for (const [k, t] of this.kaleido.entries()) {
      t.visible = stage >= 3;
      t.alpha = 0.4 * (stage >= 4 ? 1 : strength);
      const run = clock * 14 * (k % 2 ? -1 : 1);
      if (k < 2) t.tilePosition.x = run;
      else t.tilePosition.y = run;
    }

    this.updateSpecks(clock, dt, s, stage >= 1 ? (stage >= 4 ? 1 : strength) : 0);
    return { hue: hueShift(clock, s), flash: wave?.flash ?? 0, newStage };
  }

  get stageReached() {
    return this.stage;
  }

  // The territory: one pixel per tile, neon moss tinted by the tile's glow colour.
  private paintGround(g: Game) {
    this.version = g.version;
    const ctx = this.canvas!.getContext('2d')!;
    const img = ctx.createImageData(g.w, g.h);
    this.tiles = [];
    for (let i = 0; i < g.mycelium.length; i++) {
      if (!g.mycelium[i]) continue;
      this.tiles.push(i);
      const c = mix(MOSS, glowAt(g.noise[i]), 0.45 + 0.3 * g.noise[(i * 7) % g.noise.length]);
      img.data[i * 4] = (c >> 16) & 255;
      img.data[i * 4 + 1] = (c >> 8) & 255;
      img.data[i * 4 + 2] = c & 255;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.groundTexture!.source.update();
  }

  // Twinkles (shimmer, from stage 1) and floating specks, both on the territory.
  private updateSpecks(clock: number, dt: number, share: number, shimmer: number) {
    const tex = dotTexture();
    const spawn = (list: Speck[], life: number, size: number) => {
      if (!this.tiles.length) return;
      const t = this.tiles[Math.floor(Math.random() * this.tiles.length)];
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.tint = GLOW[Math.floor(Math.random() * GLOW.length)];
      (list === this.twinkles ? this.twinkleLayer : this.floaterLayer).addChild(sprite);
      list.push({
        sprite, born: clock, life: life * (0.7 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8),
        x: (t % (this.w / TS) + Math.random()) * TS, y: (Math.floor(t / (this.w / TS)) + Math.random()) * TS,
        phase: Math.random() * Math.PI * 2,
      });
    };
    const age = (list: Speck[]) =>
      list.filter((p) => {
        if (clock - p.born < p.life) return true;
        p.sprite.destroy();
        return false;
      });

    this.twinkles = age(this.twinkles);
    while (this.twinkles.length < Math.round(TWINKLES * shimmer) && this.tiles.length) spawn(this.twinkles, 0.9, 7);
    for (const p of this.twinkles) {
      const u = (clock - p.born) / p.life;
      p.sprite.position.set(p.x, p.y);
      p.sprite.scale.set((p.size * Math.sin(u * Math.PI)) / DOT_SIZE);
      p.sprite.alpha = 0.9 * Math.sin(u * Math.PI);
    }

    this.floaters = age(this.floaters);
    const want = floaterCount(share);
    for (let k = 0; k < 3 && this.floaters.length < want; k++) spawn(this.floaters, 5.5, 4);
    for (const p of this.floaters) {
      const t = clock - p.born;
      const u = t / p.life;
      p.y -= 7 * dt;
      p.sprite.position.set(p.x + Math.sin(t * 1.3 + p.phase) * 5, p.y);
      p.sprite.scale.set(p.size / DOT_SIZE);
      p.sprite.alpha = 0.8 * Math.min(1, u * 4, (1 - u) * 3);
    }
  }
}

