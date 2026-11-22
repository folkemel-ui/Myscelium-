// Draws the forest and the battle with PixiJS, and turns clicks on the map into actions.
// The whole forest sits under one colour filter: dull grey at the start, bright and saturated
// as the mycelium takes over.
import { Application, ColorMatrixFilter, Container, Graphics, Sprite, Texture, type FederatedPointerEvent } from 'pixi.js';
import { WIN_COVERAGE } from '../game/constants';
import { burst, canGrowAt, coverage, growMycelium, mushroomAt, plantMushroom } from '../game/sim';
import { idx, inside, TILE, type Game } from '../game/world';
import { CreatureView } from './CreatureView';
import { paintFloor, paintLightSpot } from './floor';
import { NetworkView } from './NetworkView';
import {
  CANOPY_GREENS, crownLayout, hash, lightAt, lightSpots, logLook, sway, TS, type Crown, type LightSpot,
} from './forestLayout';

export type Tool = 'grow' | 'mushroom';

// Patches of sunlight are added on top of what's below, this strong at their brightest.
const LIGHT_STRENGTH = 0.12;


// How dull the forest is: the filter's saturation, from nearly grey at the start to vivid at the
// goal. Pixi's saturate is fully grey at -1 and flips colours to their opposites below that.
export function saturationFor(share: number) {
  return -0.85 + 1.85 * Math.min(1, share);
}

function shade(color: number, f: number) {
  const r = Math.min(255, ((color >> 16) & 255) * f);
  const g = Math.min(255, ((color >> 8) & 255) * f);
  const b = Math.min(255, (color & 255) * f);
  return (r << 16) | (g << 8) | b;
}

// A colour part of the way (t, 0..1) from a to b.
function mix(a: number, b: number, t: number) {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export interface ViewEvents {
  onMessage: (text: string) => void;
  // Where the nutrient counter is, in the canvas's pixels, for sparkles to fly to.
  nutrientCounter: () => { x: number; y: number } | null;
  onSparkle: () => void; // a nutrient sparkle reached the counter
}

export class GameView {
  private app = new Application();
  private world = new Container();
  // Layers, bottom to top: the painted floor, logs, the mycelium, tree crowns, patches of light,
  // then mushrooms and puffs, beetles and the hover outline.
  private floor = new Sprite();
  private logs = new Graphics();
  private logKey = '';
  private logTiles: number[] = []; // where logs lie or lay, so rotted ones leave some crumbs
  private canopy = new Container();
  private crowns: { crown: Crown; shape: Graphics }[] = [];
  private light = new Container();
  private lightMask = new Graphics();
  private lights: { spot: LightSpot; sprite: Sprite }[] = [];
  private lightTexture = Texture.EMPTY;
  readonly network = new NetworkView();
  readonly creatures = new CreatureView();
  private hover = new Graphics();
  private colour = new ColorMatrixFilter();
  private pointerTile = -1;
  private dragging = false;
  private lastDragTile = -1;
  private clock = 0;
  private destroyed = false;
  game: Game;
  tool: Tool = 'grow';

  private constructor(game: Game, private events: ViewEvents) {
    this.game = game;
  }

  static async create(host: HTMLElement, game: Game, events: ViewEvents, onTick: (dt: number) => void) {
    const view = new GameView(game, events);
    await view.app.init({ resizeTo: host, background: 0x15110d, antialias: true });
    host.appendChild(view.app.canvas);
    view.world.addChild(
      view.floor, view.logs, view.network.glowLayer, view.network.threadLayer, view.canopy, view.light, view.lightMask,
      view.creatures.under, view.creatures.mushroomLayer, view.creatures.spores, view.creatures.beetleLayer, view.hover,
    );
    view.light.mask = view.lightMask;
    view.lightTexture = Texture.from(paintLightSpot());
    view.world.filters = [view.colour];
    view.buildForest();
    view.app.stage.addChild(view.world, view.creatures.sparkles);
    view.app.stage.eventMode = 'static';
    view.app.stage.hitArea = view.app.screen;
    view.app.stage.on('pointerdown', (e) => view.pointerDown(e));
    view.app.stage.on('pointermove', (e) => view.pointerMove(e));
    view.app.stage.on('pointerup', () => (view.dragging = false));
    view.app.stage.on('pointerupoutside', () => (view.dragging = false));
    view.app.ticker.add((t) => {
      const dt = Math.min(0.1, t.deltaMS / 1000);
      onTick(dt);
      view.draw(dt);
    });
    return view;
  }

  setGame(game: Game) {
    this.game = game;
    this.network.reset();
    this.creatures.reset();
    this.buildForest();
  }

  // Everything about a forest that is drawn once: the floor, the crowns, the patches of light.
  private buildForest() {
    const g = this.game;
    const old = this.floor.texture;
    this.floor.texture = Texture.from(paintFloor(g));
    this.floor.width = g.w * TS;
    this.floor.height = g.h * TS;
    if (old !== Texture.EMPTY) old.destroy(true);

    for (const c of this.canopy.removeChildren()) c.destroy();
    this.crowns = crownLayout(g).map((crown) => {
      const shape = crownShape(crown);
      this.canopy.addChild(shape);
      return { crown, shape };
    });

    this.logTiles = [...g.logNutrients.keys()].filter((i) => g.logNutrients[i] > 0);
    this.logKey = '';

    for (const c of this.light.removeChildren()) c.destroy();
    this.lights = lightSpots(g).map((spot) => {
      const sprite = new Sprite(this.lightTexture);
      sprite.anchor.set(0.5);
      sprite.width = sprite.height = spot.r * 2;
      sprite.tint = 0xfff0c8;
      sprite.blendMode = 'add';
      this.light.addChild(sprite);
      return { spot, sprite };
    });
    this.lightMask.clear().rect(0, 0, g.w * TS, g.h * TS).fill(0xffffff);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.app.destroy(true, { children: true });
  }

  // --- Input ---

  private tileAt(e: FederatedPointerEvent) {
    const p = this.world.toLocal(e.global);
    const x = Math.floor(p.x / TS);
    const y = Math.floor(p.y / TS);
    return inside(this.game, x, y) ? idx(this.game, x, y) : -1;
  }

  private pointerDown(e: FederatedPointerEvent) {
    const i = this.tileAt(e);
    if (i < 0) return;
    const g = this.game;
    const x = i % g.w;
    const y = Math.floor(i / g.w);
    // Clicking a mushroom always bursts it, whatever the tool.
    const onMushroom = mushroomAt(g, x, y) !== undefined;
    if (onMushroom) this.report(burst(g, x, y));
    else if (this.tool === 'mushroom') return this.report(plantMushroom(g, x, y));
    if (this.tool !== 'grow') return;
    this.dragging = true;
    this.lastDragTile = i;
    // A drag may start on your own network, to pull it outwards: nothing to say then.
    if (!g.mycelium[i]) this.report(growMycelium(g, x, y));
  }

  private pointerMove(e: FederatedPointerEvent) {
    const i = this.tileAt(e);
    this.pointerTile = i;
    if (!this.dragging || i < 0 || i === this.lastDragTile) return;
    const g = this.game;
    // Grow every tile on the line from the last one, so a fast drag leaves no gaps. Tiles that
    // can't be grown are skipped quietly; the first missing spores are reported.
    const from = this.lastDragTile;
    this.lastDragTile = i;
    let x = from % g.w;
    let y = Math.floor(from / g.w);
    const tx = i % g.w;
    const ty = Math.floor(i / g.w);
    while (x !== tx || y !== ty) {
      if (Math.abs(tx - x) >= Math.abs(ty - y)) x += Math.sign(tx - x);
      else y += Math.sign(ty - y);
      if (!canGrowAt(g, x, y)) continue;
      const problem = growMycelium(g, x, y);
      if (problem) return this.report(problem);
    }
  }

  private report(problem: string | null) {
    if (problem) this.events.onMessage(problem);
  }

  // --- Drawing ---

  // For checking the art up close in development: show tile (x, y) at this scale.
  inspect: { x: number; y: number; scale: number } | null = null;

  private fit() {
    const { width, height } = this.app.screen;
    if (this.inspect) {
      const { x, y, scale } = this.inspect;
      this.world.scale.set(scale);
      this.world.position.set(width / 2 - (x + 0.5) * TS * scale, height / 2 - (y + 0.5) * TS * scale);
      return;
    }
    const top = 76; // room for the panel at the top
    const pad = 16;
    const scale = Math.min((width - pad * 2) / (this.game.w * TS), (height - top - pad) / (this.game.h * TS));
    this.world.scale.set(Math.max(0.2, scale));
    this.world.x = (width - this.game.w * TS * this.world.scale.x) / 2;
    this.world.y = top + (height - top - pad - this.game.h * TS * this.world.scale.y) / 2;
  }

  private draw(dt: number) {
    this.clock += dt;
    const g = this.game;
    this.fit();
    const share = coverage(g) / WIN_COVERAGE;
    this.colour.saturate(saturationFor(share), false);
    this.network.update(g, this.clock, dt, share);
    this.drawLogs();
    for (const { crown, shape } of this.crowns) {
      const s = sway(crown, this.clock);
      shape.position.set(crown.x + s.dx, crown.y + s.dy);
      shape.rotation = s.turn;
    }
    for (const { spot, sprite } of this.lights) {
      const p = lightAt(spot, this.clock, g.w * TS, g.h * TS);
      sprite.position.set(p.x, p.y);
      sprite.alpha = LIGHT_STRENGTH * p.bright;
    }
    this.creatures.update(g, this.clock, dt, {
      toScreen: (x, y) => this.world.toGlobal({ x, y }),
      counter: this.events.nutrientCounter,
      onSparkle: this.events.onSparkle,
    });
    this.drawHover();
  }

  // Logs shrink, darken, grow moss and drop crumbs as they rot; a rotted log leaves a dark patch
  // of crumbs. Redrawn only when some log reaches its next stage.
  private drawLogs() {
    const g = this.game;
    const key = this.logTiles.map((i) => (g.tiles[i] === TILE.LOG ? logLook(g.logNutrients[i]).stage : 'x')).join();
    if (key === this.logKey) return;
    this.logKey = key;
    const gr = this.logs.clear();
    for (const i of this.logTiles) {
      const cx = (i % g.w + 0.5) * TS;
      const cy = (Math.floor(i / g.w) + 0.5) * TS;
      const crumbs = (count: number, spread: number) => {
        for (let k = 0; k < count; k++) {
          const a = hash(g, i, 60 + k) * Math.PI * 2;
          const d = spread * (0.4 + 0.6 * hash(g, i, 70 + k));
          const s = 1 + hash(g, i, 80 + k) * 1.4;
          gr.rect(cx + Math.cos(a) * d - s / 2, cy + Math.sin(a) * d - s / 2, s, s).fill(k % 2 ? 0x6a4a2e : 0x4e3420);
        }
      };
      if (g.tiles[i] !== TILE.LOG) {
        gr.circle(cx, cy, TS * 0.42).fill({ color: 0x2e2014, alpha: 0.35 });
        crumbs(8, TS * 0.45);
        continue;
      }
      const look = logLook(g.logNutrients[i]);
      const vertical = hash(g, i, 50) > 0.5;
      const len = (TS + 4) * look.length;
      const thick = TS * 0.62 * (1 - 0.15 * look.rot);
      const [w, h] = vertical ? [thick, len] : [len, thick];
      const lx = cx - w / 2;
      const ly = cy - h / 2;
      crumbs(look.crumbs, TS * 0.55);
      gr.roundRect(lx + 1.5, ly + 2, w, h, thick / 2.2).fill({ color: 0x000000, alpha: 0.3 });
      gr.roundRect(lx, ly, w, h, thick / 2.2).fill(mix(0x8a5a32, 0x5a3c24, look.rot));
      // Bark grain along the log.
      for (let k = 1; k < 4; k++) {
        const f = k / 4;
        if (vertical) gr.moveTo(lx + w * f, ly + 3).lineTo(lx + w * f + (k - 2) * 0.6, ly + h - 3);
        else gr.moveTo(lx + 3, ly + h * f).lineTo(lx + w - 3, ly + h * f + (k - 2) * 0.6);
      }
      gr.stroke({ width: 0.8, color: mix(0x5a3519, 0x3a2414, look.rot), alpha: 0.8 });
      // The cut end, with rings.
      const ex = vertical ? cx : lx + w - thick / 2.2;
      const ey = vertical ? ly + thick / 2.2 : cy;
      gr.circle(ex, ey, thick * 0.42).fill(mix(0xd8a86a, 0x8a6a48, look.rot));
      gr.circle(ex, ey, thick * 0.24).stroke({ width: 0.8, color: 0x9a6a3a, alpha: 0.8 });
      // Moss, more of it as the log softens.
      for (let k = 0; k < 1 + Math.round(look.rot * 3); k++) {
        const along = (hash(g, i, 90 + k) - 0.5) * (vertical ? h : w) * 0.6;
        const side = (hash(g, i, 95 + k) - 0.5) * thick * 0.5;
        gr.circle(cx + (vertical ? side : along), cy + (vertical ? along : side), 1.8 + hash(g, i, 99 + k) * 1.5)
          .fill({ color: 0x6a9a3a, alpha: 0.9 });
      }
    }
  }

  private drawHover() {
    const h = this.hover.clear();
    const g = this.game;
    const i = this.pointerTile;
    if (i < 0 || g.status !== 'playing') return;
    const x = i % g.w;
    const y = Math.floor(i / g.w);
    const ok = mushroomAt(g, x, y)
      ? true
      : this.tool === 'grow'
        ? canGrowAt(g, x, y)
        : g.mycelium[i] === 1 && g.tiles[i] !== TILE.LOG;
    h.rect(x * TS + 1, y * TS + 1, TS - 2, TS - 2).stroke({ width: 2, color: ok ? 0xffffff : 0xff5050, alpha: 0.8 });
  }
}

// A tree crown seen from above: a dark base, clumps of leaves lighter towards the top left, and a
// few glints. Drawn round its own centre so it can sway.
function crownShape(c: Crown) {
  const s = new Graphics();
  const base = CANOPY_GREENS[c.green];
  s.circle(0, 0, c.r * 0.85).fill(shade(base, 0.6));
  // A ring of small clumps makes a ragged, leafy rim, darker on the shaded bottom right.
  const rim = 11;
  for (let k = 0; k < rim; k++) {
    const a = c.edge + (k / rim) * Math.PI * 2;
    const lit = 0.5 - 0.5 * Math.cos(a - Math.PI * 1.25); // 1 towards the top left
    s.circle(Math.cos(a) * c.r * 0.72, Math.sin(a) * c.r * 0.72, c.r * (0.3 + 0.06 * (k % 3)))
      .fill(shade(base, 0.6 + 0.3 * lit));
  }
  for (const b of c.blobs) s.circle(b.dx, b.dy, b.r).fill(shade(base, 0.75 + 0.45 * b.light));
  for (const p of c.specks) s.circle(p.dx, p.dy, p.r).fill({ color: 0xe8ffd0, alpha: 0.2 });
  return s;
}
