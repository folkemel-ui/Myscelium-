// Draws the mycelium as a living network: curving threads that are thick near the mother and fine
// at the tips, a soft glow that lights the ground, new threads creeping into place, eaten ones
// withering away, and pulses of light travelling out from the mother.
//
// Settled threads are drawn once and redrawn only when the network changes. Threads that are
// growing or withering, and the pulses, are drawn every frame on a separate "live" layer.
import { Container, Graphics } from 'pixi.js';
import type { Game } from '../game/world';
import { TS } from './forestLayout';
import { networkLayout, pathFromRoot, pointOnThread, type NetNode, type NetworkLayout } from './networkLayout';

export const GROW_TIME = 0.5; // seconds for a new thread to creep into place
export const WITHER_TIME = 0.9; // seconds for an eaten thread to wither away
const PULSE_SPEED = 4.5; // threads a second
const PULSE_EVERY = 0.35; // seconds between pulses at the start...
const PULSE_EVERY_ALIVE = 0.12; // ...and at the goal
const MAX_PULSES = 40;
const SETTLE_EVERY = 0.6; // at most this often, redraw the settled threads while others grow
const WITHERED = 0x5a4a35;
const GLOW_FROM = 1.5; // threads thinner than this (px) get no glow

interface Withering {
  from: { x: number; y: number } | null;
  cx: number;
  cy: number;
  x: number;
  y: number;
  width: number;
  color: number;
  start: number;
}

interface Pulse {
  path: number[]; // tiles from the mother out to a tip
  k: number; // the node it is heading for, an index into path
  s: number; // how far along the thread to it, 0..1
}

function mix(a: number, b: number, t: number) {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export class NetworkView {
  // Glow goes under the threads and adds light to what's below.
  readonly glowLayer = new Container();
  readonly threadLayer = new Container();
  private settledGlow = new Graphics();
  private settledThreads = new Graphics();
  private liveGlow = new Graphics();
  private liveThreads = new Graphics();
  private layout: NetworkLayout | null = null;
  private seen: Uint8Array | null = null; // the mycelium as last drawn
  private version = -1;
  private born = new Map<number, number>(); // tile -> when its thread started growing
  private withering: Withering[] = [];
  private pulses: Pulse[] = [];
  private pulseTimer = 0;
  private settledDirty = true;
  private lastSettled = -Infinity;

  constructor() {
    this.settledGlow.blendMode = 'add';
    this.liveGlow.blendMode = 'add';
    this.glowLayer.addChild(this.settledGlow, this.liveGlow);
    this.threadLayer.addChild(this.settledThreads, this.liveThreads);
  }

  reset() {
    this.layout = null;
    this.seen = null;
    this.version = -1;
    this.born.clear();
    this.withering = [];
    this.pulses = [];
  }

  get pulseCount() {
    return this.pulses.length;
  }

  update(g: Game, clock: number, dt: number, share: number) {
    if (g.version !== this.version) this.relayout(g, clock);
    // Threads that have finished growing stay on the live layer until the settled threads are
    // redrawn with them in (or they'd blink out in between). That redraw costs several ms, so
    // while growing goes on it happens at most every SETTLE_EVERY seconds.
    let finished = 0;
    for (const start of this.born.values()) if (clock - start >= GROW_TIME) finished++;
    const growing = this.born.size - finished;
    if ((this.settledDirty || finished > 0) && (growing === 0 || clock - this.lastSettled > SETTLE_EVERY)) {
      for (const [tile, start] of this.born) if (clock - start >= GROW_TIME) this.born.delete(tile);
      this.drawSettled();
      this.settledDirty = false;
      this.lastSettled = clock;
    }
    this.withering = this.withering.filter((w) => clock - w.start < WITHER_TIME);
    this.movePulses(dt, share);
    this.drawLive(clock);
    // The glow breathes, and grows stronger as the forest comes alive.
    const s = Math.min(1, share);
    this.glowLayer.alpha = (0.35 + 0.65 * s) * (0.85 + 0.15 * Math.sin(clock * (1.5 + s * 2)));
  }

  // The network changed: lay it out again, start new threads growing and eaten ones withering.
  private relayout(g: Game, clock: number) {
    const old = this.layout;
    this.layout = networkLayout(g);
    this.version = g.version;
    this.settledDirty = true;
    const seen = this.seen;
    this.seen = g.mycelium.slice();
    if (!seen || !old) return; // a new forest: nothing grows in, it's simply there
    for (let i = 0; i < seen.length; i++) {
      if (!seen[i] && g.mycelium[i]) this.born.set(i, clock);
      if (seen[i] && !g.mycelium[i]) {
        this.born.delete(i);
        const n = old.nodes.get(i);
        if (!n) continue;
        const p = old.nodes.get(n.parent);
        this.withering.push({
          from: p ? { x: p.x, y: p.y } : null,
          cx: n.cx, cy: n.cy, x: n.x, y: n.y, width: n.width, color: n.color, start: clock,
        });
      }
    }
  }

  private drawSettled() {
    const layout = this.layout;
    const glow = this.settledGlow.clear();
    const threads = this.settledThreads.clear();
    if (!layout) return;
    // Threads of the same colour and (rounded) thickness are drawn as one path with one stroke:
    // stroking each of ~600 threads 3-4 times on its own took 17 ms on a half-covered map.
    const groups = new Map<string, { color: number; width: number; nodes: NetNode[] }>();
    const hairs = new Map<number, NetNode[]>();
    for (const n of layout.nodes.values()) {
      if (this.born.has(n.tile)) continue; // still growing: drawn on the live layer
      const color = n.color;
      if (n.parent >= 0) {
        const width = Math.round(n.width * 2) / 2;
        const key = `${color}:${width}`;
        if (!groups.has(key)) groups.set(key, { color, width, nodes: [] });
        groups.get(key)!.nodes.push(n);
      }
      if (n.hairs.length) {
        if (!hairs.has(color)) hairs.set(color, []);
        hairs.get(color)!.push(n);
      }
    }
    for (const { color, width, nodes } of groups.values()) {
      const path = (gr: Graphics) => {
        for (const n of nodes) {
          const p = layout.nodes.get(n.parent)!;
          gr.moveTo(p.x, p.y).quadraticCurveTo(n.cx, n.cy, n.x, n.y);
        }
        return gr;
      };
      // Only threads that carry a good part of the network glow; the fine tips stay fine.
      if (width >= GLOW_FROM) {
        path(glow).stroke({ width: width + 7, color, alpha: 0.07, cap: 'round' });
        path(glow).stroke({ width: width + 2.5, color, alpha: 0.14, cap: 'round' });
      }
      path(threads).stroke({ width, color, alpha: 0.92, cap: 'round' });
      if (width > 2) path(threads).stroke({ width: width * 0.35, color: 0xffffff, alpha: 0.3, cap: 'round' });
    }
    for (const [color, nodes] of hairs) {
      for (const n of nodes) this.hairPaths(threads, n, 1);
      threads.stroke({ width: 0.7, color: mix(color, 0xffffff, 0.5), alpha: 0.45 });
    }
    for (const n of layout.nodes.values()) {
      if (!this.born.has(n.tile)) this.drawKnot(threads, glow, n, n.color);
    }
  }

  // Fine hairs reaching into open ground, added to the current path (the caller strokes them).
  private hairPaths(gr: Graphics, n: NetNode, grown: number) {
    for (const h of n.hairs) {
      const len = h.length * grown;
      const ex = n.x + Math.cos(h.angle) * len;
      const ey = n.y + Math.sin(h.angle) * len;
      const mx = (n.x + ex) / 2 - Math.sin(h.angle) * len * h.bend;
      const my = (n.y + ey) / 2 + Math.cos(h.angle) * len * h.bend;
      gr.moveTo(n.x, n.y).quadraticCurveTo(mx, my, ex, ey);
    }
  }

  // A knot where threads branch, and a bright heart at the mother.
  private drawKnot(threads: Graphics, glow: Graphics, n: NetNode, color: number) {
    if (n.parent < 0) {
      glow.circle(n.x, n.y, TS * 1.1).fill({ color, alpha: 0.12 });
      threads.circle(n.x, n.y, 4).fill(color);
    } else if (n.children.length >= 2) {
      threads.circle(n.x, n.y, n.width * 0.75).fill(color);
    }
  }

  private drawLive(clock: number) {
    const glow = this.liveGlow.clear();
    const threads = this.liveThreads.clear();
    const layout = this.layout;
    if (!layout) return;

    // Growing threads creep out from their parent; hairs sprout as they arrive.
    for (const [tile, start] of this.born) {
      const n = layout.nodes.get(tile);
      if (!n) continue;
      const grown = Math.min(1, (clock - start) / GROW_TIME);
      const ease = 1 - (1 - grown) ** 2;
      const color = n.color;
      if (n.parent >= 0) {
        const pts: { x: number; y: number }[] = [];
        for (let k = 0; k <= 8; k++) pts.push(pointOnThread(layout, n, (ease * k) / 8));
        const path = (gr: Graphics) => {
          gr.moveTo(pts[0].x, pts[0].y);
          for (const p of pts.slice(1)) gr.lineTo(p.x, p.y);
          return gr;
        };
        path(glow).stroke({ width: n.width + 7, color, alpha: 0.07, cap: 'round' });
        path(glow).stroke({ width: n.width + 2.5, color, alpha: 0.14, cap: 'round' });
        path(threads).stroke({ width: n.width, color, alpha: 0.92, cap: 'round' });
        const tip = pts[pts.length - 1];
        threads.circle(tip.x, tip.y, 1.6).fill({ color: 0xffffff, alpha: 0.8 * (1 - grown) + 0.2 });
      }
      if (grown > 0.6) {
        if (n.hairs.length) {
          this.hairPaths(threads, n, (grown - 0.6) / 0.4);
          threads.stroke({ width: 0.7, color: mix(color, 0xffffff, 0.5), alpha: 0.45 });
        }
        this.drawKnot(threads, glow, n, color);
      }
    }

    // Eaten threads shrivel, wobble, fade and turn the colour of dead leaves.
    for (const w of this.withering) {
      const t = (clock - w.start) / WITHER_TIME;
      const color = mix(w.color, WITHERED, Math.min(1, t * 1.5));
      const wob = Math.sin(t * 14) * 2.5 * t;
      if (w.from) {
        threads.moveTo(w.from.x, w.from.y).quadraticCurveTo(w.cx + wob, w.cy - wob, w.x, w.y + t * 2)
          .stroke({ width: Math.max(0.4, w.width * (1 - 0.6 * t)), color, alpha: 0.9 * (1 - t), cap: 'round' });
      }
      threads.circle(w.x, w.y + t * 2, 2.5 * (1 - t)).fill({ color, alpha: 0.8 * (1 - t) });
    }

    // Pulses: a bright dot with a halo of light.
    for (const p of this.pulses) {
      const n = layout.nodes.get(p.path[p.k])!;
      const at = pointOnThread(layout, n, p.s);
      const color = n.color;
      glow.circle(at.x, at.y, 6).fill({ color, alpha: 0.35 });
      glow.circle(at.x, at.y, 3).fill({ color: 0xffffff, alpha: 0.35 });
      threads.circle(at.x, at.y, 1.7).fill({ color: 0xffffff, alpha: 0.95 });
    }
  }

  // A heartbeat: several pulses leave the mother at once, for different tips.
  heartbeat(count: number) {
    const layout = this.layout;
    if (!layout || layout.leaves.length === 0) return;
    for (let k = 0, tries = 0; k < count && tries < count * 4 && this.pulses.length < MAX_PULSES + 12; tries++) {
      const path = pathFromRoot(layout, layout.leaves[Math.floor(Math.random() * layout.leaves.length)]);
      if (path.length < 4) continue;
      this.pulses.push({ path, k: 1, s: 0 });
      k++;
    }
  }

  // Pulses set off from the mother towards a tip, more often as the forest comes alive.
  private movePulses(dt: number, share: number) {
    const layout = this.layout;
    if (!layout) return;
    this.pulses = this.pulses.filter((p) => {
      p.s += PULSE_SPEED * dt;
      while (p.s >= 1) {
        p.s -= 1;
        p.k++;
      }
      return p.k < p.path.length && p.path.every((t) => layout.nodes.has(t));
    });
    this.pulseTimer -= dt;
    if (this.pulseTimer > 0) return;
    this.pulseTimer = PULSE_EVERY - (PULSE_EVERY - PULSE_EVERY_ALIVE) * Math.min(1, share);
    if (this.pulses.length >= MAX_PULSES || layout.leaves.length === 0) return;
    for (let tries = 0; tries < 4; tries++) {
      const tip = layout.leaves[Math.floor(Math.random() * layout.leaves.length)];
      const path = pathFromRoot(layout, tip);
      if (path.length < 4) continue; // too close to the mother to be worth the trip
      this.pulses.push({ path, k: 1, s: 0 });
      return;
    }
  }
}
