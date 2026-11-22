// Draws the forest and the battle with PixiJS, and turns clicks on the map into actions.
// The whole forest sits under one colour filter: dull grey at the start, bright and saturated
// as the mycelium takes over.
import { Application, ColorMatrixFilter, Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import { BEETLE_HP, BURST_COOLDOWN, WIN_COVERAGE } from '../game/constants';
import { burst, canGrowAt, coverage, growMycelium, mushroomAt, plantMushroom } from '../game/sim';
import { idx, inside, TILE, type Beetle, type Game } from '../game/world';

export const TS = 20; // pixels per tile, before the view is scaled to fit
export type Tool = 'grow' | 'mushroom';

// The psychedelic colours the mycelium glows in.
const GLOW = [0xff4fd8, 0x4ff3ff, 0xb6ff4f, 0xffb84f, 0x9d6bff];
const glowAt = (noise: number) => GLOW[Math.floor(noise * GLOW.length) % GLOW.length];

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

export interface ViewEvents {
  onMessage: (text: string) => void;
}

export class GameView {
  private app = new Application();
  private world = new Container();
  private ground = new Graphics();
  private network = new Graphics();
  private things = new Graphics();
  private hover = new Graphics();
  private beetleLayer = new Container();
  private beetleShapes = new Map<number, Graphics>();
  private colour = new ColorMatrixFilter();
  private drawnVersion = -1;
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
    view.world.addChild(view.ground, view.network, view.things, view.beetleLayer, view.hover);
    view.world.filters = [view.colour];
    view.app.stage.addChild(view.world);
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
    this.drawnVersion = -1;
    for (const shape of this.beetleShapes.values()) shape.destroy();
    this.beetleShapes.clear();
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

  private fit() {
    const { width, height } = this.app.screen;
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
    if (g.version !== this.drawnVersion) {
      this.drawnVersion = g.version;
      this.drawGround();
      this.drawNetwork();
    }
    // The network breathes, more strongly as the forest comes alive.
    this.network.alpha = 0.82 + 0.18 * Math.sin(this.clock * (1.5 + share * 2)) * Math.min(1, share + 0.2);
    this.drawThings();
    this.drawBeetles();
    this.drawHover();
  }

  private drawGround() {
    const g = this.game;
    const gr = this.ground.clear();
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const i = idx(g, x, y);
        const n = g.noise[i];
        const px = x * TS;
        const py = y * TS;
        gr.rect(px, py, TS, TS).fill(shade(0x6e5a40, 0.85 + n * 0.25));
        const t = g.tiles[i];
        if (t === TILE.TREE) {
          gr.circle(px + TS / 2 + 2, py + TS / 2 + 2, TS * 0.58).fill({ color: 0x000000, alpha: 0.25 });
          gr.circle(px + TS / 2, py + TS / 2, TS * 0.58).fill(shade(0x2f7a3a, 0.8 + n * 0.35));
          gr.circle(px + TS * 0.4, py + TS * 0.38, TS * 0.25).fill({ color: 0xffffff, alpha: 0.08 });
        } else if (t === TILE.ROCK) {
          gr.roundRect(px + 3, py + 4, TS - 6, TS - 7, 5).fill(shade(0x8a8a86, 0.85 + n * 0.3));
          gr.roundRect(px + 5, py + 5, TS * 0.4, TS * 0.25, 3).fill({ color: 0xffffff, alpha: 0.15 });
        } else if (t === TILE.LOG) {
          // A fallen log: bark, a pale cut end with rings, and a patch of moss.
          const vertical = n > 0.5;
          const [w, h] = vertical ? [TS * 0.6, TS + 2] : [TS + 2, TS * 0.6];
          const lx = px + (TS - w) / 2;
          const ly = py + (TS - h) / 2;
          gr.roundRect(lx + 1.5, ly + 2, w, h, 5).fill({ color: 0x000000, alpha: 0.3 });
          gr.roundRect(lx, ly, w, h, 5).fill(0x8a5a32);
          for (let k = 1; k < 4; k++) {
            if (vertical) gr.moveTo(lx + 2, ly + (h * k) / 4).lineTo(lx + w - 2, ly + (h * k) / 4 + 1);
            else gr.moveTo(lx + (w * k) / 4, ly + 2).lineTo(lx + (w * k) / 4 + 1, ly + h - 2);
          }
          gr.stroke({ width: 1, color: 0x5a3519 });
          const ex = vertical ? px + TS / 2 : lx + w - 3;
          const ey = vertical ? ly + 3 : py + TS / 2;
          gr.circle(ex, ey, TS * 0.27).fill(0xd8a86a);
          gr.circle(ex, ey, TS * 0.15).stroke({ width: 1, color: 0x9a6a3a });
          gr.circle(vertical ? lx + w * 0.4 : lx + w * 0.3, vertical ? ly + h * 0.65 : ly + h * 0.4, 2.5).fill(0x6a9a3a);
        }
      }
    }
  }

  private drawNetwork() {
    const g = this.game;
    const net = this.network.clear();
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const i = idx(g, x, y);
        if (!g.mycelium[i]) continue;
        const cx = x * TS + TS / 2;
        const cy = y * TS + TS / 2;
        const color = glowAt(g.noise[i]);
        net.circle(cx, cy, TS * 0.62).fill({ color, alpha: 0.16 });
        net.circle(cx, cy, 2.2).fill({ color, alpha: 0.9 });
        // Threads to the network's neighbours, a little wavy.
        for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
          if (!inside(g, x + dx, y + dy) || !g.mycelium[idx(g, x + dx, y + dy)]) continue;
          const wobble = (g.noise[i] - 0.5) * 6;
          net.moveTo(cx, cy)
            .quadraticCurveTo(cx + dx * TS * 0.5 + dy * wobble, cy + dy * TS * 0.5 + dx * wobble, cx + dx * TS, cy + dy * TS)
            .stroke({ width: 2, color, alpha: 0.75 });
        }
        // A few fine hairs reaching out.
        const a = g.noise[i] * Math.PI * 2;
        net.moveTo(cx, cy).lineTo(cx + Math.cos(a) * TS * 0.45, cy + Math.sin(a) * TS * 0.45)
          .stroke({ width: 1, color: 0xffffff, alpha: 0.35 });
      }
    }
  }

  private drawThings() {
    const g = this.game;
    const th = this.things.clear();
    for (const p of g.puffs) {
      const life = p.age / 0.7;
      const r = p.radius * TS * (0.4 + 0.6 * life);
      th.circle(p.x * TS, p.y * TS, r).fill({ color: p.big ? 0xff7af0 : 0xd8ff7a, alpha: 0.35 * (1 - life) });
      th.circle(p.x * TS, p.y * TS, r).stroke({ width: 2, color: 0xffffff, alpha: 0.5 * (1 - life) });
    }
    for (const m of g.mushrooms) {
      const cx = m.x * TS + TS / 2;
      const cy = m.y * TS + TS / 2;
      const size = m.mother ? 1.5 : 1;
      const bob = Math.sin(this.clock * 2 + m.id) * 0.8;
      th.ellipse(cx + 2, cy + 6, 7 * size, 3 * size).fill({ color: 0x000000, alpha: 0.3 });
      th.roundRect(cx - 2.5 * size, cy - 1, 5 * size, 8 * size, 2).fill(0xf3e6c8);
      const cap = m.mother ? 0xff3d7f : glowAt(g.noise[idx(g, m.x, m.y)]);
      th.ellipse(cx, cy - 2 + bob, 9 * size, 6.5 * size).fill(cap);
      for (const [sx, sy] of [[-4, -4], [3, -5], [0, -1], [5, -1]]) {
        th.circle(cx + sx * size, cy + (sy - 1) * size + bob, 1.4 * size).fill({ color: 0xffffff, alpha: 0.85 });
      }
      // A ring shows the burst filling up again.
      if (m.cooldown > 0) {
        const done = 1 - m.cooldown / BURST_COOLDOWN;
        th.moveTo(cx, cy - 13 * size)
          .arc(cx, cy, 13 * size, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
      }
    }
  }

  private drawBeetles() {
    const g = this.game;
    const alive = new Set<number>();
    for (const b of g.beetles) {
      alive.add(b.id);
      let shape = this.beetleShapes.get(b.id);
      if (!shape) {
        shape = beetleShape();
        this.beetleShapes.set(b.id, shape);
        this.beetleLayer.addChild(shape);
      }
      const nx = b.x * TS;
      const ny = b.y * TS;
      if (Math.hypot(nx - shape.x, ny - shape.y) > 0.05) shape.rotation = Math.atan2(ny - shape.y, nx - shape.x);
      shape.position.set(nx, ny);
      shape.alpha = 0.6 + 0.4 * (b.hp / BEETLE_HP);
      shape.scale.set(eating(b) ? 1 + 0.06 * Math.sin(this.clock * 20) : 1);
    }
    for (const [id, shape] of this.beetleShapes) {
      if (alive.has(id)) continue;
      shape.destroy();
      this.beetleShapes.delete(id);
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

const eating = (b: Beetle) => b.eatTimer > 0;

// A beetle seen from above, facing right: legs, a shiny shell split down the middle, and a head.
function beetleShape() {
  const s = new Graphics();
  for (const lx of [-3, 0, 3]) {
    s.moveTo(lx, -3).lineTo(lx - 1, -7).stroke({ width: 1.2, color: 0x1a1a22 });
    s.moveTo(lx, 3).lineTo(lx - 1, 7).stroke({ width: 1.2, color: 0x1a1a22 });
  }
  s.ellipse(0, 0, 6.5, 4.8).fill(0x2a3550);
  s.moveTo(-6, 0).lineTo(5, 0).stroke({ width: 0.8, color: 0x0d1020 });
  s.ellipse(-1, -2, 3, 1.3).fill({ color: 0xffffff, alpha: 0.25 });
  s.circle(7, 0, 2.6).fill(0x1a1a22);
  return s;
}
