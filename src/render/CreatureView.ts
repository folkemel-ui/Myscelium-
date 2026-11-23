// Draws the living things: mushrooms that sprout and squash when they burst, clouds of spore
// particles, beetles with walking legs and chomping jaws that flash when hit, beaten beetles that
// flip over and fade, and nutrient sparkles that fly up to the counter.
//
// Pixi rebuilds a shape's geometry whenever it is redrawn, so what moves every frame is kept
// cheap: spores are sprites of one small texture, and a beetle's shell is drawn once; only its
// legs, jaws and antennae are redrawn each frame.
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { DOT_SIZE, dotTexture } from './textures';
import { BEETLE_HP, SWARM_WARNING } from '../game/constants';
import { incomingSwarm, shelfConnected, underAttack } from '../game/sim';
import type { Game, Mushroom, Puff, Tower } from '../game/world';
import { boltAt, shelfFacing, towerKick } from './buildings';
import {
  flip, FLASH_TIME, legSwing, moveParticle, sparkleAt, SPARKLE_TIME, sporeBurst, sproutScale, squashScale,
  type Particle,
} from './anim';
import { GLOW, glowAt, hash, PALETTE, TS } from './forestLayout';

const SMALL_SPORES = [0xd8ff7a, 0xeaffb0, 0xb6ff4f];
const SPARKLES = [0xffe066, 0xd8ff6a, 0xfff3b0];
const MAX_PARTICLES = 900;
const ARRIVAL_WARNING = 2.5; // seconds an arrow shows where beetles came in
const BEACON_TIME = 5; // seconds the mother sends out rings at the start of a round

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
  readonly shelfLayer = new Graphics(); // shelf fungus, on the tree crowns
  readonly bolts = new Graphics(); // spore bolts flying from towers to beetles
  private towerShapes = new Map<number, { shape: Graphics; born: number; shot: number }>();
  private flyingBolts: { x: number; y: number; tx: number; ty: number; start: number; color: number }[] = [];
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
  motherTier = 0; // how grand the mother looks (0..5), from the player's level

  constructor() {
    this.halos.blendMode = 'add';
    this.mushroomLayer.sortableChildren = true;
    this.spores.blendMode = 'add';
    this.sparkles.blendMode = 'add';
    this.bolts.blendMode = 'add';
  }

  reset() {
    for (const layer of [this.halos, this.mushroomLayer, this.beetleLayer]) for (const c of layer.removeChildren()) c.destroy({ children: true });
    this.shrooms.clear();
    this.towerShapes.clear();
    this.flyingBolts = [];
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
    this.updateBuildings(g, clock);
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
        halo.tint = m.mother ? PALETTE.mother : glowAt(g.noise[m.y * g.w + m.x]);
        this.halos.addChild(halo);
        s = { shape: mushroomShape(g, m, this.motherTier), halo, born: this.fresh ? -Infinity : clock, burst: -Infinity };
        this.shrooms.set(m.id, s);
        this.mushroomLayer.addChild(s.shape);
      }
      // The glow grows with the trip, and breathes. Where mushrooms stand close together each glow
      // is dimmer, so the halos don't pile up into one big blotch (Pack 20).
      const big = (m.mother ? 1.8 : 1.1) * TS * 2;
      let crowd = 0;
      for (const o of g.mushrooms) if (o !== m && Math.hypot(o.x - m.x, o.y - m.y) < 3) crowd++;
      s.halo.position.set((m.x + 0.5) * TS, (m.y + 0.5) * TS);
      s.halo.width = s.halo.height = big * Math.min(1, sproutScale(clock - s.born).sy || 0);
      s.halo.alpha = ((0.2 + 0.4 * Math.min(1, share)) / Math.sqrt(1 + crowd)) * (0.85 + 0.15 * Math.sin(clock * 2 + m.id));
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
        under.circle(cx, cy, TS * (0.9 + 0.15 * pulse)).fill({ color: PALETTE.mother, alpha: 0.1 + 0.06 * pulse });
        // The first seconds of a round: soft rings of her colour roll out from her, so she is
        // found at once.
        if (g.time < BEACON_TIME) {
          const end = 1 - g.time / BEACON_TIME;
          for (let k = 0; k < 3; k++) {
            const f = ((g.time + k * 0.55) % 1.65) / 1.65;
            under.circle(cx, cy, TS * (0.8 + 3.2 * f)).stroke({ width: 3 * (1 - f) + 1, color: PALETTE.mother, alpha: 0.55 * (1 - f) * end });
          }
          under.circle(cx, cy, TS * 1.6).fill({ color: PALETTE.mother, alpha: 0.12 * end });
        }
      }
      const r = m.mother ? 17 : 12;
      if (m.cooldown > 0) {
        const done = 1 - m.cooldown / g.mods.burstCooldown;
        under.moveTo(cx, cy - r).arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.55 });
      } else {
        // Ready to burst: the ring is whole and breathes softly.
        const breathe = 0.5 + 0.5 * Math.sin(clock * 3 + m.id);
        under.circle(cx, cy, r).stroke({ width: 1.5, color: 0xffffff, alpha: 0.18 + 0.17 * breathe });
      }
    }
  }

  // --- Shelves, towers and bolts ---

  private updateBuildings(g: Game, clock: number) {
    // Shelf fungus: a few half-moon brackets on the side of the tree that touches the network,
    // warm and breathing while it feeds, grey while cut off.
    const sh = this.shelfLayer.clear();
    for (const s of g.shelves) {
      const [fx, fy] = shelfFacing(g, s.x, s.y);
      const live = shelfConnected(g, s);
      const cx = (s.x + 0.5 + fx * 0.32) * TS;
      const cy = (s.y + 0.5 + fy * 0.32) * TS;
      const along = fx !== 0 ? [0, 1] : [1, 0]; // the brackets line up along the tree's edge
      const turn = Math.atan2(fy, fx);
      const breathe = live ? 0.85 + 0.15 * Math.sin(clock * 2.4 + s.id) : 0.55;
      for (let k = -1; k <= 1; k++) {
        const r = (k === 0 ? 6 : 4.5) * (live ? 1 : 0.9);
        const bx = cx + along[0] * k * 6;
        const by = cy + along[1] * k * 6;
        const color = live ? (k === 0 ? 0xffb84f : 0xffd27a) : 0x8a8274;
        sh.moveTo(bx, by).arc(bx, by, r, turn - Math.PI / 2, turn + Math.PI / 2).closePath()
          .fill({ color, alpha: breathe });
        sh.moveTo(bx, by).arc(bx, by, r * 0.55, turn - Math.PI / 2, turn + Math.PI / 2)
          .stroke({ width: 1, color: live ? 0x7a4a10 : 0x5a554c, alpha: 0.6 });
        if (live) sh.circle(bx + fx * r * 0.7, by + fy * r * 0.7, 1.2).fill({ color: 0xfff3b0, alpha: breathe });
      }
    }

    // Towers: a tall stalk with a glowing spore sac on top that swells when it shoots.
    const alive = new Set<number>();
    for (const t of g.towers) {
      alive.add(t.id);
      let v = this.towerShapes.get(t.id);
      if (!v) {
        v = { shape: towerShape(t), born: this.fresh ? -Infinity : clock, shot: -Infinity };
        this.towerShapes.set(t.id, v);
        this.mushroomLayer.addChild(v.shape);
      }
      const sprout = sproutScale(clock - v.born);
      const kick = towerKick(clock - v.shot);
      v.shape.scale.set(sprout.sx * (2 - kick) ** 0.5, sprout.sy * kick);
      v.shape.position.set((t.x + 0.5) * TS, (t.y + 0.5) * TS + 6);
      v.shape.zIndex = t.y;
    }
    for (const [id, v] of this.towerShapes) {
      if (alive.has(id)) continue;
      v.shape.destroy();
      this.towerShapes.delete(id);
    }

    // Bolts: a bright head with a fading tail, then a little flash at the beetle.
    const b = this.bolts.clear();
    this.flyingBolts = this.flyingBolts.filter((f) => boltAt(clock - f.start) !== null);
    for (const f of this.flyingBolts) {
      const at = boltAt(clock - f.start)!;
      const hx = f.x + (f.tx - f.x) * at.along;
      const hy = f.y + (f.ty - f.y) * at.along;
      const back = Math.max(0, at.along - 0.35);
      b.moveTo(f.x + (f.tx - f.x) * back, f.y + (f.ty - f.y) * back).lineTo(hx, hy)
        .stroke({ width: 2.5, color: f.color, alpha: 0.7 * at.alpha });
      b.circle(hx, hy, at.along >= 1 ? 5 * at.alpha + 2 : 2.5).fill({ color: 0xffffff, alpha: at.alpha });
      b.circle(hx, hy, 5).fill({ color: f.color, alpha: 0.35 * at.alpha });
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
      arrowIn(d, x, y, nx, ny, 12, 0xff4a3d, 0.85 * fade * blink);
    }
    // A swarm about to come in: a glow on the edge where it will, growing brighter as it nears,
    // with arrows pointing in.
    const inc = incomingSwarm(g);
    if (inc) {
      const x = Math.min(W - 12, Math.max(12, inc.x * TS));
      const y = Math.min(H - 12, Math.max(12, inc.y * TS));
      const [nx, ny] = [[1, 0], [-1, 0], [0, 1], [0, -1]][inc.side];
      const near = 1 - inc.in / SWARM_WARNING;
      const beat = 0.6 + 0.4 * Math.sin(clock * (6 + 8 * near));
      d.circle(x, y, 26 + 10 * near).fill({ color: 0xff6a2a, alpha: (0.12 + 0.18 * near) * beat });
      d.circle(x, y, 14).fill({ color: 0xff8a3d, alpha: (0.18 + 0.2 * near) * beat });
      for (let k = 0; k < 3; k++) {
        const step = ((clock * 1.6 + k / 3) % 1) * 18;
        arrowIn(d, x + nx * step, y + ny * step, nx, ny, 8, 0xffc070, 0.9 * beat * (1 - step / 22));
      }
    }
    for (const { progress, ...m } of underAttack(g)) {
      const cx = (m.x + 0.5) * TS;
      const cy = (m.y + 0.5) * TS;
      const r = m.mother ? 22 : m.tower ? 17 : 15;
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
        const parts = beetleParts(b.kind);
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
      bug.root.scale.set((b.kind === 'bark' ? 0.85 : 1) * (1 + 0.07 * ((b.maxHp ?? BEETLE_HP) - BEETLE_HP)));
      // A hit knocks it back a touch.
      const knock = flash * 1.5;
      bug.root.position.set(x - Math.cos(bug.angle) * knock, y - Math.sin(bug.angle) * knock);
      bug.root.rotation = bug.angle;
    }

    for (const e of g.events) {
      if (e.kind === 'hit') {
        const bug = this.bugs.get(e.beetle);
        if (bug) bug.flash = clock;
      } else if (e.kind === 'shot') {
        const t = this.towerShapes.get(e.tower);
        if (t) t.shot = clock;
        this.flyingBolts.push({ x: e.x * TS, y: e.y * TS - 14, tx: e.tx * TS, ty: e.ty * TS, start: clock, color: GLOW[(e.tower % 4) + 1] });
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
// A spore tower: roots in the ground, a tall pale stalk and a round spore sac on top, dotted with
// glowing pores. Drawn round its foot so it can swell upwards when it shoots.
function towerShape(t: Tower) {
  const s = new Graphics();
  const sac = GLOW[(t.id % 4) + 1];
  s.ellipse(2, 0, 9, 3.2).fill({ color: 0x000000, alpha: 0.32 });
  for (const a of [-0.5, 0.4, 1.3, 2.4, 3.2]) {
    s.moveTo(0, -1).lineTo(Math.cos(a) * 7, Math.sin(a) * 2.5).stroke({ width: 1.5, color: 0xe9dcbc, alpha: 0.8 });
  }
  s.roundRect(-2.6, -16, 5.2, 16, 2.4).fill(0xf3e6c8);
  s.rect(0.4, -16, 2.2, 16).fill({ color: 0x000000, alpha: 0.12 });
  for (const y of [-5, -10]) s.ellipse(0, y, 3.4, 1).fill({ color: 0xd8c8a0, alpha: 0.9 }); // rings on the stalk
  s.circle(0, -20, 6.5).fill(shade(sac, 0.55));
  s.circle(-0.6, -20.6, 5.6).fill(sac);
  for (const [px, py] of [[-2.5, -22], [2, -21.5], [0, -17.8], [-3, -18.5], [3, -18.4], [0.4, -24]]) {
    s.circle(px, py, 0.9).fill({ color: 0xffffff, alpha: 0.85 });
  }
  s.circle(-2.2, -22.6, 1.6).fill({ color: 0xffffff, alpha: 0.35 }); // a shine
  return s;
}

function mushroomShape(g: Game, m: Mushroom, tier = 0) {
  const s = new Graphics();
  const tile = m.y * g.w + m.x;
  const kind = m.mother ? 0 : Math.floor(hash(g, tile, 200) * 3);
  // The mother grows grander with the player's level: a little bigger at every step.
  const k = m.mother ? 1.55 * (1 + 0.06 * tier) : 0.85 + 0.3 * hash(g, tile, 201);
  const cap = m.mother ? PALETTE.mother : glowAt(g.noise[tile]);
  if (m.mother && tier >= 4) {
    // Two baby mushrooms at her foot.
    for (const [bx, by, bc] of [[-8, 1, 0], [8.5, 2, 1]]) {
      const c = GLOW[bc + 1];
      s.roundRect((bx - 1) * 1.1, (by - 4) * 1.1, 2.2, 4.4, 1).fill(0xf3e6c8);
      s.ellipse(bx * 1.1, (by - 4.2) * 1.1, 3.4, 2.4).fill(c);
      s.circle((bx - 1) * 1.1, (by - 4.8) * 1.1, 0.6).fill({ color: 0xffffff, alpha: 0.85 });
    }
  }
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
    if (m.mother) motherMarkings(s, k, tier);
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
// The mother's markings as the player levels up: more spots (step 1), a golden rim (2), glowing
// stripes (3), and a crown of little lights (5). (Step 4, her babies, is drawn with her stem.)
function motherMarkings(s: Graphics, k: number, tier: number) {
  if (tier >= 1) {
    for (let a = 0; a < 7; a++) {
      const t = 0.15 + (a / 6) * 0.7;
      s.circle((-8 + 16 * t) * k, (-10.6 - Math.sin(t * Math.PI) * 1.2) * k, 0.5 * k).fill({ color: 0xffffff, alpha: 0.8 });
    }
  }
  if (tier >= 2) {
    s.moveTo(-9 * k, -10 * k).bezierCurveTo(-9 * k, -20 * k, 9 * k, -20 * k, 9 * k, -10 * k)
      .stroke({ width: 1.3, color: 0xffd36b, alpha: 0.95 });
  }
  if (tier >= 3) {
    for (const x of [-5, 0, 5]) {
      s.moveTo(x * k, -10.5 * k).quadraticCurveTo((x * 0.7) * k, -15 * k, (x * 0.4) * k, -17.5 * k);
    }
    s.stroke({ width: 0.9, color: 0xfff0f8, alpha: 0.55 });
  }
  if (tier >= 5) {
    for (let a = 0; a < 5; a++) {
      const t = (a / 4 - 0.5) * 1.6;
      const x = Math.sin(t) * 10 * k;
      const y = (-17 - Math.cos(t) * 4) * k;
      s.circle(x, y, 1.6 * k).fill({ color: 0xfff3b0, alpha: 0.3 });
      s.circle(x, y, 0.7 * k).fill({ color: 0xffffff, alpha: 0.95 });
    }
  }
}

interface BeetleParts {
  root: Container;
  limbs: Graphics;
  shell: Graphics;
  belly: Graphics;
  cracks: Graphics;
  flash: Graphics;
  crackLevel: number;
}

function beetleParts(kind: 'beetle' | 'bark' = 'beetle'): BeetleParts {
  const bark = kind === 'bark';
  const root = new Container();
  const limbs = new Graphics();
  const shell = new Graphics();
  const belly = new Graphics();
  const cracks = new Graphics();
  const flash = new Graphics();
  // Seen on any ground (Pack 18): a soft warm glow and a shadow under it, and a light rim.
  const glow = new Graphics();
  glow.circle(-0.5, 0, 12).fill({ color: 0xffb060, alpha: 0.12 });
  glow.circle(-0.5, 0, 8.5).fill({ color: 0xffc070, alpha: 0.16 });
  glow.ellipse(0.5, 1.8, 8, 5.6).fill({ color: 0x000000, alpha: 0.35 });

  shell.ellipse(-1, 0, 7.4, 5.7).stroke({ width: 1.1, color: 0xfff0d8, alpha: 0.55 });
  shell.ellipse(-1, 0, 6.6, 4.9).fill(bark ? 0x6b3a24 : 0x2a3550).stroke({ width: 0.8, color: bark ? 0x3a1c10 : 0x161c2e });
  shell.ellipse(-2, -1.9, 3.4, 1.3).fill({ color: 0xffffff, alpha: 0.22 });
  shell.ellipse(-2.4, 2.1, 2.2, 0.8).fill({ color: 0x7f9fff, alpha: 0.18 });
  shell.moveTo(-7, 0).lineTo(4.6, 0).stroke({ width: 0.8, color: 0x0d1020 });
  shell.ellipse(5, 0, 2.8, 3.4).fill(bark ? 0x4a2818 : 0x232c42);
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

  root.addChild(glow, limbs, shell, belly, cracks, flash);
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

// An arrow at (x, y) pointing along (nx, ny), size s.
function arrowIn(d: Graphics, x: number, y: number, nx: number, ny: number, s: number, color: number, alpha: number) {
  d.moveTo(x + nx * s, y + ny * s).lineTo(x - ny * s * 0.8, y + nx * s * 0.8).lineTo(x + ny * s * 0.8, y - nx * s * 0.8).closePath()
    .fill({ color, alpha });
}
