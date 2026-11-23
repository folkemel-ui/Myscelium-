// Draws the forest and the battle with PixiJS, and turns clicks on the map into actions.
// The whole forest sits under one colour filter: dull grey at the start, bright and saturated
// as the mycelium takes over.
import { Application, ColorMatrixFilter, Container, Graphics, Sprite, Texture, type FederatedPointerEvent } from 'pixi.js';
import { WIN_COVERAGE } from '../game/constants';
import {
  buildTower, burst, canGrowAt, coverage, growMycelium, mushroomAt, nearestReadyMushroom, placeShelf, plantMushroom, shelfAt,
  shelfConnected, towerAt,
} from '../game/sim';
import { idx, inside, TILE, type Game } from '../game/world';
import { CreatureView } from './CreatureView';
import { paintFloor, paintLightSpot } from './floor';
import { NetworkView } from './NetworkView';
import { TripView } from './TripView';
import { homeCamera, MAX_ZOOM, panBy, pinch, place, zoomAt, type Camera, type Viewport } from './camera';
import { blackLight } from './trip';
import {
  CANOPY_GREENS, crownLayout, hash, PINE_GREENS, lightAt, lightSpots, logLook, sway, TS, type Crown, type LightSpot,
} from './forestLayout';

export type Tool = 'grow' | 'mushroom' | 'shelf' | 'tower';

// How far (screen pixels) a finger may move and still count as a tap rather than a drag.
const TAP_SLOP = 8;

// The smallest a tile should be when a round starts (screen pixels). Where the whole map would be
// smaller than that (a phone), the round starts zoomed in on the mother instead.
const START_TILE_PX = 14;

function startCamera(v: Viewport, g: Game): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, START_TILE_PX / (v.fit * TS)));
  if (zoom === 1) return homeCamera(v);
  const m = g.mushrooms.find((mm) => mm.mother) ?? g.mushrooms[0];
  return { zoom, cx: m ? (m.x + 0.5) * TS : v.mapW / 2, cy: m ? (m.y + 0.5) * TS : v.mapH / 2 };
}

// Patches of sunlight are added on top of what's below, this strong at their brightest.
const LIGHT_STRENGTH = 0.12;


// How dull the forest is: the filter's saturation, from dull at the start to vivid at the
// goal. Pixi's saturate is fully grey at -1 and flips colours to their opposites below that.
// It tops out at +0.45: the colour at the goal comes from what glows, not from turning everything up.
export const MAX_SATURATION = 0.45;
// It starts at -0.6: dull, but logs, mushrooms and beetles can still be told apart (at -0.85 they
// blended into the grey).
export const MIN_SATURATION = -0.6;
export function saturationFor(share: number) {
  return MIN_SATURATION + (MAX_SATURATION - MIN_SATURATION) * Math.min(1, share);
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
  onStage?: (stage: number) => void; // a new stage of the trip was reached
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
  readonly trip = new TripView();
  readonly creatures = new CreatureView();
  private hover = new Graphics();
  private colour = new ColorMatrixFilter();
  private canopyColour = new ColorMatrixFilter(); // turns the crowns towards teal and violet
  private threadColour = new ColorMatrixFilter(); // the slow colour drift, on the threads only
  private pointerTile = -1;
  private pointerAt: { x: number; y: number } | null = null; // the mouse over the map, in tiles
  // While frozen (paused, or the help is open) the game doesn't move on, the forest stands still,
  // and clicks on the map do nothing.
  frozen = false;
  private dragging = false;
  private lastDragTile = -1;
  // The camera, and the pointers on the map: fingers for pinching, a right-drag for moving.
  private cam: Camera = { zoom: 1, cx: 0, cy: 0 };
  private camReady = false; // a new forest starts zoomed out, showing all of it
  private pointers = new Map<number, { x: number; y: number }>();
  private pinching = false;
  private panning = false;
  // A finger that went down but hasn't moved yet: it is a tap if it lifts, a drag if it moves.
  private pendingTap: { id: number; x: number; y: number; tile: number } | null = null;
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
      view.floor, view.trip.ground, view.logs, view.network.glowLayer, view.network.threadLayer, view.canopy, view.creatures.shelfLayer,
      view.trip.spots, view.light, view.lightMask, view.trip.air, view.trip.airMask, view.creatures.halos,
      view.creatures.under, view.creatures.mushroomLayer, view.creatures.spores, view.creatures.beetleLayer, view.creatures.bolts, view.creatures.danger, view.hover,
    );
    view.light.mask = view.lightMask;
    view.lightTexture = Texture.from(paintLightSpot());
    view.world.filters = [view.colour];
    view.canopy.filters = [view.canopyColour];
    view.network.threadLayer.filters = [view.threadColour];
    view.buildForest();
    view.app.stage.addChild(view.world, view.creatures.sparkles);
    view.app.stage.eventMode = 'static';
    view.app.stage.hitArea = view.app.screen;
    view.app.stage.on('pointerdown', (e) => view.pointerDown(e));
    view.app.stage.on('pointermove', (e) => view.pointerMove(e));
    for (const ev of ['pointerup', 'pointerupoutside', 'pointercancel'] as const) view.app.stage.on(ev, (e) => view.pointerUp(e));
    // The mouse wheel zooms around the pointer; the right button is for moving the view.
    const canvas = view.app.canvas;
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      view.cam = zoomAt(view.cam, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top, view.viewport());
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    view.app.ticker.add((t) => {
      const dt = Math.min(0.1, t.deltaMS / 1000);
      if (!view.frozen) onTick(dt);
      view.draw(view.frozen ? 0 : dt);
    });
    return view;
  }

  setGame(game: Game) {
    this.game = game;
    this.camReady = false;
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
    this.trip.build(g, this.crowns.map((c) => c.crown), coverage(g) / WIN_COVERAGE);

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

  // Burst the ready mushroom nearest the mouse (the B key).
  burstNearest() {
    if (this.frozen || !this.pointerAt) return;
    const m = nearestReadyMushroom(this.game, this.pointerAt.x, this.pointerAt.y);
    if (!m) return this.report(this.game.mushrooms.length ? 'No mushroom is ready to burst' : null);
    this.report(burst(this.game, m.x, m.y));
  }

  // Zoom in or out by a factor, around the middle of the view (the + and - keys), or back out to
  // the whole map (0).
  zoomBy(factor: number) {
    const v = this.viewport();
    this.cam = zoomAt(this.cam, factor, v.x0 + v.w / 2, v.y0 + v.h / 2, v);
  }

  resetCamera() {
    this.cam = homeCamera(this.viewport());
  }

  get zoom() {
    return this.cam.zoom;
  }

  private pointerDown(e: FederatedPointerEvent) {
    this.pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
    // A second finger: pinching and moving the view, not growing; what the first finger was about
    // to do is forgotten.
    if (this.pointers.size >= 2) {
      this.pinching = true;
      this.dragging = false;
      this.pendingTap = null;
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) {
      this.panning = true;
      return;
    }
    if (this.frozen) return;
    if (e.pointerType === 'touch') {
      this.pendingTap = { id: e.pointerId, x: e.global.x, y: e.global.y, tile: this.tileAt(e) };
      return;
    }
    this.act(this.tileAt(e));
  }

  // What a click or tap on a tile does: burst a mushroom, plant one, or start growing.
  private act(i: number) {
    if (i < 0) return;
    const g = this.game;
    const x = i % g.w;
    const y = Math.floor(i / g.w);
    // Clicking a mushroom always bursts it, whatever the tool.
    const onMushroom = mushroomAt(g, x, y) !== undefined;
    if (onMushroom) this.report(burst(g, x, y));
    else if (this.tool === 'mushroom') return this.report(plantMushroom(g, x, y));
    else if (this.tool === 'shelf') return this.report(placeShelf(g, x, y));
    else if (this.tool === 'tower') return this.report(buildTower(g, x, y));
    if (this.tool !== 'grow') return;
    this.dragging = true;
    this.lastDragTile = i;
    // A drag may start on your own network, to pull it outwards: nothing to say then.
    if (!g.mycelium[i]) this.report(growMycelium(g, x, y));
  }

  private pointerMove(e: FederatedPointerEvent) {
    const prev = this.pointers.get(e.pointerId);
    const now = { x: e.global.x, y: e.global.y };
    if (prev) {
      if (this.pinching && this.pointers.size >= 2) {
        const [other] = [...this.pointers.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
        this.cam = pinch(this.cam, prev, other, now, other, this.viewport());
        this.pointers.set(e.pointerId, now);
        return;
      }
      this.pointers.set(e.pointerId, now);
      if (this.panning) {
        this.cam = panBy(this.cam, now.x - prev.x, now.y - prev.y, this.viewport());
        return;
      }
    }
    const i = this.tileAt(e);
    this.pointerTile = i;
    const p = this.world.toLocal(e.global);
    this.pointerAt = { x: p.x / TS, y: p.y / TS };
    if (this.frozen) return;
    // A finger that has moved far enough is a drag: it starts where the finger went down.
    const tap = this.pendingTap;
    if (tap && tap.id === e.pointerId && Math.hypot(now.x - tap.x, now.y - tap.y) > TAP_SLOP) {
      this.pendingTap = null;
      this.act(tap.tile);
    }
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

  private pointerUp(e: FederatedPointerEvent) {
    this.pointers.delete(e.pointerId);
    // A finger lifted without moving: a tap.
    const tap = this.pendingTap;
    if (tap && tap.id === e.pointerId) {
      this.pendingTap = null;
      if (!this.frozen) this.act(tap.tile);
    }
    if (this.pointers.size < 2) this.pinching = false;
    if (this.pointers.size === 0) {
      this.dragging = false;
      this.panning = false;
    }
  }

  private report(problem: string | null) {
    if (problem) this.events.onMessage(problem);
  }

  // --- Drawing ---

  // For checking the art up close in development: show tile (x, y) at this scale.
  inspect: { x: number; y: number; scale: number } | null = null;

  // Room to leave at the top for the panel, in screen pixels (the panel can wrap onto two lines).
  topSpace = 76;

  private fit() {
    const { width, height } = this.app.screen;
    if (this.inspect) {
      const { x, y, scale } = this.inspect;
      this.world.scale.set(scale);
      this.world.position.set(width / 2 - (x + 0.5) * TS * scale, height / 2 - (y + 0.5) * TS * scale);
      return;
    }
    const v = this.viewport();
    if (!this.camReady) {
      this.cam = startCamera(v, this.game);
      this.camReady = true;
    }
    const { at, cam } = place(this.cam, v);
    this.cam = cam;
    this.world.scale.set(at.scale);
    this.world.position.set(at.x, at.y);
  }

  // Where the map may be shown: below the panel, inside a small margin.
  viewport(): Viewport {
    const { width, height } = this.app.screen;
    const top = this.topSpace;
    const pad = width < 600 ? 6 : 16;
    const w = width - pad * 2;
    const h = height - top - pad;
    const mapW = this.game.w * TS;
    const mapH = this.game.h * TS;
    return { x0: pad, y0: top, w, h, mapW, mapH, fit: Math.max(0.1, Math.min(w / mapW, h / mapH)) };
  }

  private draw(dt: number) {
    this.clock += dt;
    const g = this.game;
    this.fit();
    const share = coverage(g) / WIN_COVERAGE;
    const trip = this.trip.update(g, this.clock, dt, share);
    this.colour.saturate(saturationFor(share), false);
    // Black light: the forest darkens towards indigo, the glowing things don't.
    const night = blackLight(share).tint;
    this.floor.tint = night;
    this.logs.tint = night;
    this.canopy.tint = night;
    this.canopyColour.hue(trip.canopyHue, false);
    this.threadColour.hue(trip.threadHue, false);
    if (trip.beats > 0) this.network.heartbeat(trip.beats);
    if (trip.flash > 0) this.colour.brightness(1 + 0.22 * trip.flash, true);
    if (trip.newStage !== null) this.events.onStage?.(trip.newStage);
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
    this.creatures.update(g, this.clock, dt, share, {
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
    const onNetwork = g.mycelium[i] === 1 && g.tiles[i] !== TILE.LOG && !towerAt(g, x, y);
    const ok = mushroomAt(g, x, y)
      ? true
      : this.tool === 'grow'
        ? canGrowAt(g, x, y)
        : this.tool === 'shelf'
          ? g.tiles[i] === TILE.TREE && !shelfAt(g, x, y) && shelfConnected(g, { x, y })
          : onNetwork;
    h.rect(x * TS + 1, y * TS + 1, TS - 2, TS - 2).stroke({ width: 2, color: ok ? 0xffffff : 0xff5050, alpha: 0.8 });
  }
}

// A tree crown seen from above: a dark base, clumps of leaves lighter towards the top left, and a
// few glints. Drawn round its own centre so it can sway.
function crownShape(c: Crown) {
  if (c.pine) return pineShape(c);
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

// A pine from above: layers of spiky star shapes, darker at the rim and lighter to the top, with a
// pale tip in the middle.
function pineShape(c: Crown) {
  const s = new Graphics();
  const base = PINE_GREENS[c.green % PINE_GREENS.length];
  const layers = 4;
  for (let k = 0; k < layers; k++) {
    const r = c.r * (1 - k * 0.22);
    const points = 9 + (k % 2);
    const turn = c.edge + k * 0.35;
    const path: number[] = [];
    for (let p = 0; p < points * 2; p++) {
      const a = turn + (p / (points * 2)) * Math.PI * 2;
      const rr = p % 2 === 0 ? r : r * 0.72;
      path.push(Math.cos(a) * rr - k * 0.6, Math.sin(a) * rr - k * 0.6);
    }
    s.poly(path).fill(shade(base, 0.62 + 0.16 * k));
  }
  s.circle(-2.2, -2.2, 1.6).fill({ color: 0xd8ffd0, alpha: 0.35 });
  return s;
}
