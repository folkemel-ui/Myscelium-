// The trip: as the mycelium spreads, the forest gets stranger, darker and more colourful, in a
// "black light" style: the forest itself darkens towards indigo (GameView tints it), and what
// glows stands out against it.
//   - The territory becomes deep, dark, fertile soil (one pixel per tile, smoothed when drawn big),
//     so the threads glow against it.
//   - Tree crowns slowly turn teal and violet (GameView turns their hue) and grow a few glowing
//     spots, like bioluminescent fungi.
//   - A faint band of colour sweeps across the forest; glowing specks float up from the territory.
//   - Stages at 25%, 50%, 75% and 100% of the goal: shimmer, heartbeats of light along the network,
//     soft colour at the corners, then everything at full strength. Each arrives with a soft wave
//     of light rolling out from the mother.
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Game } from '../game/world';
import { GLOW, hash, SURROUND, TS, type Crown } from './forestLayout';
import { mixColour, rampColours } from './networkLayout';
import { bandTexture, DOT_SIZE, dotTexture } from './textures';
import {
  beatsBetween, bandAt, canopyHue, floaterCount, hueShift, stageFor, stageStrength, stageWave,
} from './trip';

const TWINKLES = 40; // at full shimmer
const SOIL = [0x120820, 0x1c0d2e, 0x0e1424]; // the dark, rich colours of the territory
const SPOT_COLOURS = [0x6ff7ff, 0xb48cff, 0x9dff9a];
const CORNER_REACH = 14; // tiles the corner glows reach in from each corner

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
  threadHue: number; // degrees to turn the threads' colours (the forest itself stays put)
  canopyHue: number; // degrees to turn the tree crowns towards teal and violet
  flash: number; // 0..1, a brief brightening as a stage arrives
  newStage: number | null; // a stage reached this frame
  beats: number; // heartbeats of light to send along the network this frame
}

export class TripView {
  readonly ground = new Sprite(); // the dark territory, just above the floor
  readonly spots = new Graphics(); // glowing spots on the tree crowns
  readonly air = new Container(); // everything floating over the forest
  readonly airMask = new Graphics();
  private band = new Sprite();
  private waveGlow = new Sprite();
  private corners: Sprite[] = [];
  private twinkleLayer = new Container();
  private floaterLayer = new Container();
  private canvas: HTMLCanvasElement | null = null;
  private groundTexture: Texture | null = null;
  private version = -1;
  private stage = 0;
  private waveAt = -Infinity;
  private beatFrom = 0;
  private lastClock = 0;
  private twinkles: Speck[] = [];
  private floaters: Speck[] = [];
  // Finished specks' sprites wait here to be used again: making and throwing away a sprite for
  // every speck made the browser stop now and then to clean up.
  private spareTwinkles: Sprite[] = [];
  private spareFloaters: Sprite[] = [];
  private tiles: number[] = []; // mycelium tiles, to place specks on
  private w = 0;
  private h = 0;

  constructor() {
    this.spots.blendMode = 'add';
    this.air.blendMode = 'add';
    this.band.texture = bandTexture();
    this.band.anchor.set(0.5);
    this.corners = [0, 1, 2, 3].map(() => {
      const s = new Sprite(dotTexture());
      s.anchor.set(0.5);
      return s;
    });
    this.waveGlow.texture = dotTexture();
    this.waveGlow.anchor.set(0.5);
    this.air.addChild(this.band, ...this.corners, this.waveGlow, this.twinkleLayer, this.floaterLayer);
    this.air.mask = this.airMask;
  }

  // A new forest. Stages already passed (a loaded round) are simply on, without their waves.
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
    for (const p of this.twinkles) this.retire(p.sprite, this.spareTwinkles);
    for (const p of this.floaters) this.retire(p.sprite, this.spareFloaters);
    this.twinkles = [];
    this.floaters = [];

    // A few glowing spots on about a third of the crowns, near their edges, grouped by colour.
    const spots = this.spots.clear();
    SPOT_COLOURS.forEach((color, k) => {
      for (const [i, c] of crowns.entries()) {
        if (i % 3 !== 0 || (i / 3) % SPOT_COLOURS.length !== k) continue;
        const n = 2 + (i % 3);
        for (let j = 0; j < n; j++) {
          const a = ((i * 7 + j * 13) % 31) / 31 * Math.PI * 2;
          const d = c.r * (0.45 + 0.4 * (((i + j * 5) % 7) / 7));
          spots.circle(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 1 + (j % 2) * 0.6);
        }
      }
      spots.fill({ color, alpha: 0.95 });
    });
    // The air reaches over the forest past the edge too (where it fades into the dark), so the
    // map doesn't show as a lighter rectangle.
    const out = SURROUND * TS;
    this.airMask.clear().rect(-out, -out, this.w + out * 2, this.h + out * 2).fill(0xffffff);
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
      if (stage >= 2 && this.stage < 2) this.beatFrom = clock;
    }
    this.stage = stage;
    const strength = stage >= 4 ? 1 : stageStrength(share, stage);

    // The territory darkens into rich soil; spots on the trees glow and breathe.
    this.ground.alpha = 0.1 + 0.5 * s;
    this.spots.alpha = Math.max(0, (s - 0.2) / 0.8) * (0.65 + 0.35 * Math.sin(clock * 1.7));

    // A faint colour band sweeping across.
    const band = bandAt(clock);
    this.band.visible = s > 0.05;
    this.band.tint = GLOW[band.colour % GLOW.length];
    this.band.alpha = 0.03 + 0.08 * s;
    this.band.width = TS * 7;
    this.band.height = Math.hypot(this.w, this.h) * 1.2;
    this.band.rotation = 0.55;
    this.band.position.set(band.pos * this.w, this.h / 2);

    // Soft colour drifting in at the corners, from stage 3.
    const reach = CORNER_REACH * TS;
    this.corners.forEach((c, k) => {
      c.visible = stage >= 3;
      if (!c.visible) return;
      // Fainter, and only in the far colours of the network's colour ramp (no yellow-green haze).
      const ramp = rampColours();
      const far = [ramp[1], ramp[2]];
      const cycle = clock / 6 + k * 1.3;
      c.tint = mixColour(far[Math.floor(cycle) % 2], far[(Math.floor(cycle) + 1) % 2], cycle % 1);
      c.width = c.height = reach * 2 * (1 + 0.08 * Math.sin(clock * 0.4 + k));
      c.position.set(k % 2 ? this.w : 0, k < 2 ? 0 : this.h);
      c.alpha = 0.1 * strength;
    });

    // The wave when a stage arrives: a soft glow spreading out from the mother, with only a faint
    // brighter edge, not a ring.
    const mother = g.mushrooms.find((m) => m.mother);
    const cx = mother ? (mother.x + 0.5) * TS : this.w / 2;
    const cy = mother ? (mother.y + 0.5) * TS : this.h / 2;
    const far = Math.hypot(Math.max(cx, this.w - cx), Math.max(cy, this.h - cy));
    const wave = stageWave(clock - this.waveAt);
    this.waveGlow.visible = wave !== null;
    if (wave) {
      const r = wave.reach * far;
      const color = GLOW[(this.stage - 1) % GLOW.length];
      this.waveGlow.tint = color;
      this.waveGlow.position.set(cx, cy);
      this.waveGlow.width = this.waveGlow.height = Math.max(1, r * 2.3);
      this.waveGlow.alpha = 0.32 * wave.bright;
      // No outline: a sharp circle across the map looked like a mistake (Pack 18).
    }

    // Heartbeats of light along the network, from stage 2.
    const beats = stage >= 2 ? beatsBetween(this.lastClock - this.beatFrom, clock - this.beatFrom) * (stage >= 4 ? 8 : 5) : 0;
    this.lastClock = clock;

    this.updateSpecks(clock, dt, s, stage >= 1 ? strength : 0);
    return { threadHue: hueShift(clock, s), canopyHue: canopyHue(s), flash: wave?.flash ?? 0, newStage, beats };
  }

  get stageReached() {
    return this.stage;
  }

  // The territory: one pixel per tile in dark, rich soil colours.
  private paintGround(g: Game) {
    this.version = g.version;
    const ctx = this.canvas!.getContext('2d')!;
    const img = ctx.createImageData(g.w, g.h);
    this.tiles = [];
    for (let i = 0; i < g.mycelium.length; i++) {
      if (!g.mycelium[i]) continue;
      this.tiles.push(i);
      const c = SOIL[Math.floor(hash(g, i, 300) * SOIL.length)];
      img.data[i * 4] = (c >> 16) & 255;
      img.data[i * 4 + 1] = (c >> 8) & 255;
      img.data[i * 4 + 2] = c & 255;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.groundTexture!.source.update();
  }

  // A sprite from the spares, or a new one if there are none.
  private take(spare: Sprite[], layer: Container) {
    const sprite = spare.pop();
    if (sprite) {
      sprite.visible = true;
      return sprite;
    }
    const made = new Sprite(dotTexture());
    made.anchor.set(0.5);
    layer.addChild(made);
    return made;
  }

  private retire(sprite: Sprite, spare: Sprite[]) {
    sprite.visible = false;
    spare.push(sprite);
  }

  // Twinkles (shimmer, from stage 1) and floating specks, both on the territory.
  private updateSpecks(clock: number, dt: number, share: number, shimmer: number) {
    const spawn = (list: Speck[], life: number, size: number) => {
      if (!this.tiles.length) return;
      const t = this.tiles[Math.floor(Math.random() * this.tiles.length)];
      const twinkle = list === this.twinkles;
      const sprite = this.take(twinkle ? this.spareTwinkles : this.spareFloaters, twinkle ? this.twinkleLayer : this.floaterLayer);
      sprite.tint = GLOW[Math.floor(Math.random() * GLOW.length)];
      list.push({
        sprite, born: clock, life: life * (0.7 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8),
        x: (t % (this.w / TS) + Math.random()) * TS, y: (Math.floor(t / (this.w / TS)) + Math.random()) * TS,
        phase: Math.random() * Math.PI * 2,
      });
    };
    const age = (list: Speck[], spare: Sprite[]) =>
      list.filter((p) => {
        if (clock - p.born < p.life) return true;
        this.retire(p.sprite, spare);
        return false;
      });

    this.twinkles = age(this.twinkles, this.spareTwinkles);
    while (this.twinkles.length < Math.round(TWINKLES * shimmer) && this.tiles.length) spawn(this.twinkles, 0.9, 7);
    for (const p of this.twinkles) {
      const u = (clock - p.born) / p.life;
      p.sprite.position.set(p.x, p.y);
      p.sprite.scale.set((p.size * Math.sin(u * Math.PI)) / DOT_SIZE);
      p.sprite.alpha = 0.9 * Math.sin(u * Math.PI);
    }

    this.floaters = age(this.floaters, this.spareFloaters);
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
