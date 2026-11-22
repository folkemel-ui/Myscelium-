// Draws the living things: mushrooms that sprout and squash when they burst, clouds of spore
// particles, beetles with walking legs and chomping jaws that flash when hit, beaten beetles that
// flip over and fade, and nutrient sparkles that fly up to the counter.
//
// Pixi rebuilds a shape's geometry whenever it is redrawn, so what moves every frame is kept
// cheap: spores are sprites of one small texture, and a beetle's shell is drawn once; only its
// legs, jaws and antennae are redrawn each frame.
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { DOT_SIZE, dotTexture } from './textures';
import { BEETLE_HP, BURST_COOLDOWN } from '../game/constants';
import { underAttack } from '../game/sim';
import type { Game, Mushroom, Puff } from '../game/world';
import {
  flip, FLASH_TIME, legSwing, moveParticle, sparkleAt, SPARKLE_TIME, sporeBurst, sproutScale, squashScale,
  type Particle,
} from './anim';
import { GLOW, glowAt, hash, TS } from './forestLayout';

const SMALL_SPORES = [0xd8ff7a, 0xeaffb0, 0xb6ff4f];
const SPARKLES = [0xffe066, 0xd8ff6a, 0xfff3b0];
const MAX_PARTICLES = 900;
const ARRIVAL_WARNING = 2.5; // seconds an arrow shows where beetles came in

type Point = { x: number; y: number };

export interface CreatureHooks {
  toScreen: (x: number, y: number) => Point; // world pixels to screen pixels
  counter: () => Point | null; // where the nutrient counter is on screen
  onSparkle: () => void; // a sparkle reached the counter
}

function shade(color: number, f: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * f));
  const b = Math.min(255, Math.round((color & 255) * f));
  return (r << 16) | (g << 8) | b;
}

interface Bug {
  root: Container;
  parts: BeetleParts;
  walk: number;
  flash: number;
  x: number;
  y: number;
  angle: number;
}

export class CreatureView {
  readonly under = new Graphics(); // auras, cooldown rings and cloud rings, under the mushrooms
  readonly halos = new Container(); // a soft glow under each mushroom, in its colour
  readonly mushroomLayer = new Container();
  readonly spores = new Container();
  readonly beetleLayer = new Container();
  readonly danger = new Graphics(); // arrows where beetles come in, rings on what is being eaten
  readonly sparkles = new Graphics(); // on the screen, above the forest and its colour filter
  private shrooms = new Map<number, { shape: Graphics; halo: Sprite; born: number; burst: number }>();
  private seenPuffs = new WeakSet<Puff>();
  private particles: Particle[] = [];
  private sporeSprites: Sprite[] = [];
  private sporeTex: Texture | null = null;
  private rings: { x: number; y: number; r: number; start: number; big: boolean }[] = [];
  private bugs = new Map<number, Bug>();
  private corpses: { root: Container; parts: BeetleParts; start: number; x: number; y: number; angle: number }[] = [];
  private flying: { from: Point; start: number; lift: number; color: number }[] = [];
  private fresh = true; // the first look at a game: what's there already doesn't sprout

  constructor() {
    this.halos.blendMode = 'add';
    this.mushroomLayer.sortableChildren = true;
    this.spores.blendMode = 'add';
    this.sparkles.blendMode = 'add';
  }

  reset() {
    for (const layer of [this.halos, this.mushroomLayer, this.beetleLayer]) for (const c of layer.removeChildren()) c.destroy({ children: true });
    this.shrooms.clear();
    this.bugs.clear();
    this.corpses = [];
    this.particles = [];
    this.rings = [];
    this.flying = [];
    this.fresh = true;
  }

  get particleCount() {
    return this.particles.length;
  }

  update(g: Game, clock: number, dt: number, share: number, hooks: CreatureHooks) {
    this.drawDanger(g, clock);
    this.updateMushrooms(g, clock, share);
    this.updatePuffs(g, clock, dt);
    this.updateBeetles(g, clock, hooks);
    this.updateCorpses(clock);
    this.updateSparkles(clock, hooks);
    this.fresh = false;
  }

  // --- Mushrooms ---

  private updateMushrooms(g: Game, clock: number, share: number) {
    const alive = new Set<number>();
    for (const m of g.mushrooms) {
      alive.add(m.id);
      let s = this.shrooms.get(m.id);
      if (!s) {
        const halo = new Sprite(dotTexture());
        halo.anchor.set(0.5);
        halo.tint = m.mother ? 0xff3d7f : glowAt(g.noise[m.y * g.w + m.x]);
        this.halos.addChild(halo);
        s = { shape: mushroomShape(g, m), halo, born: this.fresh ? -Infinity : clock, burst: -Infinity };
        this.shrooms.set(m.id, s);
        this.mushroomLayer.addChild(s.shape);
      }
      // The glow grows with the trip, and breathes.
      const big = (m.mother ? 2.2 : 1.4) * TS * 2;
      s.halo.position.set((m.x + 0.5) * TS, (m.y + 0.5) * TS);
      s.halo.width = s.halo.height = big * Math.min(1, sproutScale(clock - s.born).sy || 0);
      s.halo.alpha = (0.2 + 0.45 * Math.min(1, share)) * (0.85 + 0.15 * Math.sin(clock * 2 + m.id));
      const sprout = sproutScale(clock - s.born);
      const squash = squashScale(clock - s.burst);
      s.shape.scale.set(sprout.sx * squash.sx, sprout.sy * squash.sy);
      s.shape.position.set((m.x + 0.5) * TS, (m.y + 0.5) * TS + 6);
      s.shape.rotation = Math.sin(clock * 1.3 + m.id) * 0.025;
      s.shape.zIndex = m.y;
    }
    for (const [id, s] of this.shrooms) {
      if (alive.has(id)) continue;
      s.shape.destroy();
      s.halo.destroy();
      this.shrooms.delete(id);
    }

    const under = this.under.clear();
    for (const m of g.mushrooms) {
      const cx = (m.x + 0.5) * TS;
      const cy = (m.y + 0.5) * TS;
      if (m.mother) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 2.2);
        under.circle(cx, cy, TS * (0.9 + 0.15 * pulse)).fill({ color: 0xff3d7f, alpha: 0.1 + 0.06 * pulse });
      }
      if (m.cooldown > 0) {
        const r = m.mother ? 17 : 12;
        const done = 1 - m.cooldown / BURST_COOLDOWN;
        under.moveTo(cx, cy - r).arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.55 });
      }
    }
  }

  // --- Danger ---

  // Arrows at the edge where beetles have just come in (for ARRIVAL_WARNING seconds), and a red,
  // pulsing glow with a ring filling up round any mushroom being eaten.
  private drawDanger(g: Game, clock: number) {
    const d = this.danger.clear();
    const W = g.w * TS;
    const H = g.h * TS;
    const blink = 0.55 + 0.45 * Math.sin(clock * 9);
    for (const b of g.beetles) {
      const age = g.time - (b.born ?? -99);
      if (age < 0 || age > ARRIVAL_WARNING) continue;
      // The arrow sits just inside the map's edge, pointing in.
      const x = Math.min(W - 10, Math.max(10, b.x * TS));
      const y = Math.min(H - 10, Math.max(10, b.y * TS));
      const [nx, ny] = b.x < 0.5 ? [1, 0] : b.x > g.w - 0.5 ? [-1, 0] : b.y < 0.5 ? [0, 1] : [0, -1];
      const fade = 1 - age / ARRIVAL_WARNING;
      const s = 12;
      d.moveTo(x + nx * s, y + ny * s).lineTo(x - ny * s * 0.8, y + nx * s * 0.8).lineTo(x + ny * s * 0.8, y - nx * s * 0.8).closePath()
        .fill({ color: 0xff4a3d, alpha: 0.85 * fade * blink });
    }
    for (const { mushroom: m, progress } of underAttack(g)) {
      const cx = (m.x + 0.5) * TS;
      const cy = (m.y + 0.5) * TS;
      const r = m.mother ? 22 : 15;
      d.circle(cx, cy, r + 6 * blink).fill({ color: 0xff2a2a, alpha: 0.18 + 0.14 * blink });
      d.circle(cx, cy, r).stroke({ width: 2, color: 0xff6a5a, alpha: 0.4 });
      d.moveTo(cx, cy - r).arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2)
        .stroke({ width: 3.5, color: 0xff3b2f, alpha: 0.95 });
    }
  }

  // --- Spore clouds ---

  private updatePuffs(g: Game, clock: number, dt: number) {
    for (const p of g.puffs) {
      if (this.seenPuffs.has(p)) continue;
      this.seenPuffs.add(p);
      const x = p.x * TS;
      const y = p.y * TS;
      const room = MAX_PARTICLES - this.particles.length;
      this.particles.push(...sporeBurst(x, y, p.radius * TS, Math.min(room, p.big ? 70 : 18), p.big ? GLOW : SMALL_SPORES, Math.random));
      this.rings.push({ x, y, r: p.radius * TS, start: clock, big: p.big });
      if (p.big) {
        const m = g.mushrooms.find((v) => (v.x + 0.5) * TS === x && (v.y + 0.5) * TS === y);
        const s = m && this.shrooms.get(m.id);
        if (s) s.burst = clock;
      }
    }
    this.particles = this.particles.filter((p) => moveParticle(p, dt));

    // One sprite per spore, reused from frame to frame.
    this.sporeTex ??= dotTexture();
    while (this.sporeSprites.length < this.particles.length) {
      const sprite = new Sprite(this.sporeTex);
      sprite.anchor.set(0.5);
      this.spores.addChild(sprite);
      this.sporeSprites.push(sprite);
    }
    this.sporeSprites.forEach((sprite, k) => {
      const p = this.particles[k];
      sprite.visible = p !== undefined;
      if (!p) return;
      const life = p.age / p.life;
      sprite.position.set(p.x, p.y);
      sprite.scale.set((p.r * 2 * (1 + life * 0.6)) / DOT_SIZE);
      sprite.tint = p.color;
      sprite.alpha = 0.75 * (life < 0.15 ? life / 0.15 : 1 - (life - 0.15) / 0.85);
    });

    this.rings = this.rings.filter((r) => clock - r.start < 0.6);
    for (const r of this.rings) {
      const e = (clock - r.start) / 0.6;
      this.under.circle(r.x, r.y, r.r * (0.45 + 0.55 * e)).stroke({
        width: r.big ? 2 : 1.2, color: r.big ? 0xffc0f4 : 0xe8ffc0, alpha: (r.big ? 0.5 : 0.3) * (1 - e),
      });
    }
  }

  // --- Beetles ---

  private updateBeetles(g: Game, clock: number, hooks: CreatureHooks) {
    const alive = new Set<number>();
    for (const b of g.beetles) {
      alive.add(b.id);
      const x = b.x * TS;
      const y = b.y * TS;
      let bug = this.bugs.get(b.id);
      if (!bug) {
        const parts = beetleParts();
        bug = { root: parts.root, parts, walk: 0, flash: -Infinity, x, y, angle: 0 };
        this.bugs.set(b.id, bug);
        this.beetleLayer.addChild(bug.root);
      }
      const moved = Math.hypot(x - bug.x, y - bug.y);
      if (moved > 0.02) {
        bug.angle = Math.atan2(y - bug.y, x - bug.x);
        bug.walk += moved * 1.3;
      }
      bug.x = x;
      bug.y = y;
      const flash = Math.max(0, 1 - (clock - bug.flash) / FLASH_TIME);
      const jaw = b.eatTimer > 0 ? 0.45 + 0.4 * Math.sin(clock * 22) : 0.15;
      drawLimbs(bug.parts.limbs, { walk: bug.walk, jaw, belly: false, clock });
      bug.parts.flash.alpha = 0.85 * flash;
      setCracks(bug.parts, b.hp / (b.maxHp ?? BEETLE_HP));
      // Tougher (later) beetles are a little bigger.
      bug.root.scale.set(1 + 0.07 * ((b.maxHp ?? BEETLE_HP) - BEETLE_HP));
      // A hit knocks it back a touch.
      const knock = flash * 1.5;
      bug.root.position.set(x - Math.cos(bug.angle) * knock, y - Math.sin(bug.angle) * knock);
      bug.root.rotation = bug.angle;
    }

    for (const e of g.events) {
      if (e.kind === 'hit') {
        const bug = this.bugs.get(e.beetle);
        if (bug) bug.flash = clock;
      } else {
        const bug = this.bugs.get(e.beetle);
        const parts = beetleParts();
        this.beetleLayer.addChild(parts.root);
        const x = e.x * TS;
        const y = e.y * TS;
        this.corpses.push({ root: parts.root, parts, start: clock, x, y, angle: bug?.angle ?? 0 });
        const from = hooks.toScreen(x, y);
        for (let k = 0; k < e.nutrients; k++) {
          this.flying.push({
            from: { x: from.x + (Math.random() - 0.5) * 10, y: from.y + (Math.random() - 0.5) * 10 },
            start: clock + 0.25 + k * 0.07, lift: 40 + Math.random() * 50, color: SPARKLES[k % SPARKLES.length],
          });
        }
      }
    }
    g.events.length = 0;

    for (const [id, bug] of this.bugs) {
      if (alive.has(id)) continue;
      bug.root.destroy({ children: true });
      this.bugs.delete(id);
    }
  }

  private updateCorpses(clock: number) {
    this.corpses = this.corpses.filter((c) => {
      const f = flip(clock - c.start);
      if (f.done) {
        c.root.destroy({ children: true });
        return false;
      }
      setBelly(c.parts, f.scaleY < 0);
      drawLimbs(c.parts.limbs, { walk: 0, jaw: 0.6, belly: f.scaleY < 0, clock });
      c.root.position.set(c.x, c.y - f.hop);
      c.root.rotation = c.angle;
      c.root.scale.set(1, Math.abs(f.scaleY) < 0.01 ? 0.01 : f.scaleY);
      c.root.alpha = f.alpha;
      return true;
    });
  }

  // --- Nutrient sparkles ---

  private updateSparkles(clock: number, hooks: CreatureHooks) {
    const sp = this.sparkles.clear();
    const to = hooks.counter();
    if (!to) {
      this.flying = [];
      return;
    }
    this.flying = this.flying.filter((f) => {
      const t = (clock - f.start) / SPARKLE_TIME;
      if (t < 0) return true;
      if (t >= 1) {
        hooks.onSparkle();
        return false;
      }
      const p = sparkleAt(f.from, to, t, f.lift);
      const size = 2.2 + Math.sin(t * Math.PI) * 1.8;
      const twinkle = 0.7 + 0.3 * Math.sin(clock * 30 + f.lift);
      sp.circle(p.x, p.y, size * 2.2).fill({ color: f.color, alpha: 0.25 * twinkle });
      sp.circle(p.x, p.y, size * 0.8).fill({ color: 0xffffff, alpha: 0.9 });
      sp.moveTo(p.x - size * 2, p.y).lineTo(p.x + size * 2, p.y).moveTo(p.x, p.y - size * 2).lineTo(p.x, p.y + size * 2)
        .stroke({ width: 1, color: f.color, alpha: 0.8 * twinkle });
      return true;
    });
  }
}

// --- Shapes ---

// A mushroom seen from a little above and the side, with its stem's foot at (0, 0). Caps come in
// three shapes (a round dome, a wide flat cap, a tall cone) and sizes from 0.85 to 1.15; the
// mother is a big spotted dome with a frilly ring on her stem.
function mushroomShape(g: Game, m: Mushroom) {
  const s = new Graphics();
  const tile = m.y * g.w + m.x;
  const kind = m.mother ? 0 : Math.floor(hash(g, tile, 200) * 3);
  const k = m.mother ? 1.55 : 0.85 + 0.3 * hash(g, tile, 201);
  const cap = m.mother ? 0xff3d7f : glowAt(g.noise[tile]);
  const stem = 0xf3e6c8;
  const gill = shade(cap, 0.45);

  s.ellipse(2 * k, 0, 8.5 * k, 3 * k).fill({ color: 0x000000, alpha: 0.3 });
  const stemTop = kind === 1 ? -7 : kind === 2 ? -11 : -9;
  const stemW = kind === 2 ? 4 : 5;
  s.roundRect((-stemW / 2) * k, stemTop * k, stemW * k, -stemTop * k, 2 * k).fill(stem);
  s.rect(0.3 * k, stemTop * k, (stemW / 2 - 0.3) * k, -stemTop * k).fill({ color: 0x000000, alpha: 0.12 });
  if (m.mother) {
    s.ellipse(0, -4.8 * k, 4 * k, 1.5 * k).fill(0xfff6e0); // a frilly ring round her stem
    for (let a = -3; a <= 3; a++) s.circle(a * 1.2 * k, -3.6 * k, 0.6 * k).fill(0xfff6e0);
  }

  // Gills: the cap's underside, seen as a band below its rim, with fine lines fanning out.
  const [gy, gw, gh] = kind === 1 ? [-7.5, 10.5, 2.1] : kind === 2 ? [-10.5, 6.5, 1.8] : [-9, 8.5, 2.3];
  s.ellipse(0, gy * k, gw * k, gh * k).fill(gill);
  for (let a = -4; a <= 4; a++) {
    s.moveTo(0, gy * k).lineTo((a / 4) * gw * k * 0.95, (gy + gh * (1 - Math.abs(a / 4) * 0.5)) * k);
  }
  s.stroke({ width: 0.5, color: shade(cap, 0.25), alpha: 0.6 });

  // The cap, its darker rim, a shine on the top left, and its markings.
  if (kind === 0) {
    s.moveTo(-9 * k, -10 * k).bezierCurveTo(-9 * k, -20 * k, 9 * k, -20 * k, 9 * k, -10 * k)
      .quadraticCurveTo(0, -7.6 * k, -9 * k, -10 * k).fill(cap).stroke({ width: 1, color: shade(cap, 0.6), alpha: 0.8 });
    s.ellipse(-3.2 * k, -14.5 * k, 3.4 * k, 1.8 * k).fill({ color: 0xffffff, alpha: 0.3 });
    for (const [x, y, r] of [[-4.5, -12, 1.3], [2.5, -15.5, 1.5], [5.5, -11.5, 1.1], [-0.5, -11, 1], [-6, -14.5, 0.9]]) {
      s.circle(x * k, y * k, r * k).fill({ color: 0xffffff, alpha: 0.85 });
    }
  } else if (kind === 1) {
    s.moveTo(-11 * k, -8 * k).bezierCurveTo(-10 * k, -14.5 * k, 10 * k, -14.5 * k, 11 * k, -8 * k)
      .quadraticCurveTo(0, -6.2 * k, -11 * k, -8 * k).fill(cap).stroke({ width: 1, color: shade(cap, 0.6), alpha: 0.8 });
    s.ellipse(0, -11.4 * k, 3 * k, 1.2 * k).fill(shade(cap, 0.75)); // a dimple in the middle
    s.ellipse(-4.5 * k, -11.3 * k, 3.5 * k, 1.2 * k).fill({ color: 0xffffff, alpha: 0.28 });
    for (let a = 0; a < 7; a++) {
      const t = (a / 6) * Math.PI;
      s.circle(Math.cos(t) * 7.5 * k, (-9.4 - Math.sin(t) * 2.6) * k, 0.7 * k).fill({ color: 0xffffff, alpha: 0.7 });
    }
  } else {
    s.moveTo(-7 * k, -11 * k).bezierCurveTo(-6 * k, -17 * k, -2 * k, -24 * k, 0, -25 * k)
      .bezierCurveTo(2 * k, -24 * k, 6 * k, -17 * k, 7 * k, -11 * k)
      .quadraticCurveTo(0, -9.2 * k, -7 * k, -11 * k).fill(cap).stroke({ width: 1, color: shade(cap, 0.6), alpha: 0.8 });
    for (const y of [-14, -18]) {
      s.moveTo(-5.4 * k * ((y + 25) / 14), y * k).quadraticCurveTo(0, (y + 1.4) * k, 5.4 * k * ((y + 25) / 14), y * k);
    }
    s.stroke({ width: 0.9, color: shade(cap, 1.35), alpha: 0.75 });
    s.ellipse(-2.4 * k, -17.5 * k, 1.4 * k, 3.6 * k).fill({ color: 0xffffff, alpha: 0.28 });
  }
  return s;
}

// A beetle from above, facing +x, in parts: limbs (legs, antennae, jaws) redrawn every frame, and a
// shell, a white flash and cracks that are drawn once and only shown, hidden or faded.
interface BeetleParts {
  root: Container;
  limbs: Graphics;
  shell: Graphics;
  belly: Graphics;
  cracks: Graphics;
  flash: Graphics;
  crackLevel: number;
}

function beetleParts(): BeetleParts {
  const root = new Container();
  const limbs = new Graphics();
  const shell = new Graphics();
  const belly = new Graphics();
  const cracks = new Graphics();
  const flash = new Graphics();

  shell.ellipse(-1, 0, 6.6, 4.9).fill(0x2a3550).stroke({ width: 0.8, color: 0x161c2e });
  shell.ellipse(-2, -1.9, 3.4, 1.3).fill({ color: 0xffffff, alpha: 0.22 });
  shell.ellipse(-2.4, 2.1, 2.2, 0.8).fill({ color: 0x7f9fff, alpha: 0.18 });
  shell.moveTo(-7, 0).lineTo(4.6, 0).stroke({ width: 0.8, color: 0x0d1020 });
  shell.ellipse(5, 0, 2.8, 3.4).fill(0x232c42);
  shell.circle(8.2, 0, 2.3).fill(0x1a1a22);

  belly.ellipse(-1, 0, 6.4, 4.7).fill(0x6a5a46);
  for (const x of [-5, -3, -1, 1]) belly.moveTo(x, -3.8).quadraticCurveTo(x + 0.8, 0, x, 3.8);
  belly.stroke({ width: 0.6, color: 0x3a3024, alpha: 0.7 });
  belly.ellipse(5, 0, 2.6, 3).fill(0x4e4234);
  belly.circle(8.2, 0, 2.1).fill(0x2a2a30);
  belly.visible = false;

  cracks.moveTo(-4, -3).lineTo(-2.2, -1.2).lineTo(-3.4, 0.4).moveTo(1, 2.8).lineTo(-0.3, 1.2)
    .stroke({ width: 0.6, color: 0xffffff, alpha: 0.6 });
  cracks.visible = false;

  flash.ellipse(-1, 0, 7, 5.3).fill(0xffffff);
  flash.circle(8.2, 0, 2.5).fill(0xffffff);
  flash.alpha = 0;

  root.addChild(limbs, shell, belly, cracks, flash);
  return { root, limbs, shell, belly, cracks, flash, crackLevel: 1 };
}

// Cracks show once a beetle is hurt, plainer the more hurt it is.
function setCracks(p: BeetleParts, hp: number) {
  if (hp === p.crackLevel) return;
  p.crackLevel = hp;
  p.cracks.visible = hp < 1;
  p.cracks.alpha = 0.3 + 0.7 * (1 - Math.max(0, hp));
}

function setBelly(p: BeetleParts, up: boolean) {
  p.belly.visible = up;
  p.shell.visible = !up;
  p.cracks.visible = !up && p.crackLevel < 1;
}

interface LimbLook {
  walk: number; // how far it has walked, which sets where its legs are
  jaw: number; // how wide its jaws are open, 0..1
  belly: boolean; // on its back, legs in the air
  clock: number;
}

function drawLimbs(s: Graphics, o: LimbLook) {
  s.clear();
  for (let i = 0; i < 3; i++) {
    const lx = 3.2 - i * 3;
    for (const side of [-1, 1]) {
      if (o.belly) {
        // Legs in the air, curled and kicking.
        const kick = Math.sin(o.clock * 26 + i * 2 + side) * 1.2;
        s.moveTo(lx, side * 2.4).lineTo(lx + 1 + kick, side * 5).lineTo(lx + 2.5, side * 4 + kick * 0.5);
      } else {
        const swing = legSwing(o.walk, i, side) * 1.8;
        const spread = (1 - i) * 1.3;
        s.moveTo(lx, side * 2.8).lineTo(lx + swing * 0.6 + spread, side * 6).lineTo(lx + swing + spread * 2, side * 8);
      }
    }
  }
  s.stroke({ width: 1.1, color: o.belly ? 0x2a2a30 : 0x1a1a22, cap: 'round', join: 'round' });
  if (o.belly) return;
  const sway = Math.sin(o.walk * 0.5) * 0.6;
  for (const side of [-1, 1]) {
    s.moveTo(9.5, side * 1.2).quadraticCurveTo(12, side * (2.5 + sway), 13.5, side * (4.5 + sway));
  }
  s.stroke({ width: 0.7, color: 0x1a1a22 });
  for (const side of [-1, 1]) {
    s.moveTo(9.6, side * 0.9).lineTo(11.4, side * (0.7 + o.jaw * 1.8)).lineTo(12.2, side * (0.25 + o.jaw * 0.8));
  }
  s.stroke({ width: 1.2, color: 0x101015, cap: 'round' });
}
