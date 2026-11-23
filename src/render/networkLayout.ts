// The mycelium drawn as a living network: every tile of it is a node, joined to the neighbour it
// grew from (its parent) by a curving thread. Threads that carry more of the network are thicker,
// so the network is thickest near the mother and fine at its tips. Plain numbers, no drawing.
import { idx, inside, type Game } from '../game/world';
import { GLOW, hash, TS } from './forestLayout';

export interface NetNode {
  tile: number;
  x: number; // pixels, nudged off the tile centre so the network doesn't look like a grid
  y: number;
  parent: number; // tile of the node it grew from, -1 for the mother (or a cut-off piece's root)
  children: number[];
  depth: number; // steps from its root
  size: number; // how many nodes hang from it, itself included
  width: number; // thickness of the thread from its parent
  cx: number; // the thread's bend: a control point between parent and node
  cy: number;
  hairs: { angle: number; length: number; bend: number }[]; // fine strands reaching into open ground
  color: number; // its thread's colour: by its distance from the mother, a little paler at the finest tips
}

export interface NetworkLayout {
  nodes: Map<number, NetNode>;
  roots: number[];
  leaves: number[]; // nodes with nothing growing from them: the tips
}

export const MAX_THREAD = 4.5;
export const threadWidth = (size: number) => Math.min(MAX_THREAD, 0.9 + 0.55 * Math.log2(size));

const SIDES = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

export const STRAIGHT_COST = 3;
export function networkLayout(g: Game): NetworkLayout {
  const nodes = new Map<number, NetNode>();
  const roots: number[] = [];
  const order: number[] = []; // breadth first, so parents come before their children

  const node = (tile: number, parent: number, depth: number): NetNode => {
    const x = tile % g.w;
    const y = (tile - x) / g.w;
    const root = parent < 0;
    return {
      tile, parent, depth, children: [], size: 1, width: 0, cx: 0, cy: 0, hairs: [], color: GLOW[0],
      x: (x + 0.5 + (root ? 0 : (hash(g, tile, 101) - 0.5) * 0.5)) * TS,
      y: (y + 0.5 + (root ? 0 : (hash(g, tile, 102) - 0.5) * 0.5)) * TS,
    };
  };
  // Each tile costs a different amount to grow through, and every tile joins the network by its
  // cheapest way from the root. Spreading evenly instead gave straight, comb-like rows of threads;
  // this way branches wander and fork like real mycelium.
  const cost = (t: number) => 1 + 2.5 * hash(g, t, 105);
  const spread = (start: number) => {
    roots.push(start);
    nodes.set(start, node(start, -1, 0));
    const best = new Map<number, number>([[start, 0]]);
    const via = new Map<number, number>();
    const heap = new MinHeap();
    heap.push(0, start);
    while (heap.size > 0) {
      const [d, tile] = heap.pop();
      if (d > best.get(tile)!) continue; // a cheaper way was already found
      if (tile !== start) {
        const parent = nodes.get(via.get(tile)!)!;
        nodes.set(tile, node(tile, parent.tile, parent.depth + 1));
        parent.children.push(tile);
      }
      order.push(tile);
      const x = tile % g.w;
      const y = (tile - x) / g.w;
      for (const [dx, dy] of SIDES) {
        if (!inside(g, x + dx, y + dy)) continue;
        const t = idx(g, x + dx, y + dy);
        if (!g.mycelium[t] || nodes.has(t)) continue;
        // Carrying straight on costs a little more, so threads turn now and then and spread out
        // diagonally instead of running in long straight rows side by side (Pack 20).
        const from = via.get(tile);
        const straight = from !== undefined && t - tile === tile - from;
        const nd = d + cost(t) + (straight ? STRAIGHT_COST : 0);
        if (nd < (best.get(t) ?? Infinity)) {
          best.set(t, nd);
          via.set(t, tile);
          heap.push(nd, t);
        }
      }
    }
  };

  const mother = g.mushrooms.find((m) => m.mother);
  if (mother && g.mycelium[idx(g, mother.x, mother.y)]) spread(idx(g, mother.x, mother.y));
  // Pieces cut off from the mother still grow; each gets its own root.
  for (let t = 0; t < g.mycelium.length; t++) if (g.mycelium[t] && !nodes.has(t)) spread(t);

  // Sizes from the tips inwards, then the threads' widths and bends.
  for (let k = order.length - 1; k >= 0; k--) {
    const n = nodes.get(order[k])!;
    if (n.parent >= 0) nodes.get(n.parent)!.size += n.size;
  }
  for (const n of nodes.values()) {
    n.width = threadWidth(n.size);
    if (n.parent >= 0) {
      const p = nodes.get(n.parent)!;
      const bend = (hash(g, n.tile, 104) - 0.5) * 0.9 * TS;
      const len = Math.hypot(n.x - p.x, n.y - p.y) || 1;
      n.cx = (p.x + n.x) / 2 - ((n.y - p.y) / len) * bend;
      n.cy = (p.y + n.y) / 2 + ((n.x - p.x) / len) * bend;
    }
    // Fine hairs reach into the open ground around the tips and edges.
    const x = n.tile % g.w;
    const y = (n.tile - x) / g.w;
    SIDES.forEach(([dx, dy], k) => {
      if (n.hairs.length >= 2 || !inside(g, x + dx, y + dy) || g.mycelium[idx(g, x + dx, y + dy)]) return;
      if (hash(g, n.tile, 110 + k) > 0.6) return;
      n.hairs.push({
        angle: Math.atan2(dy, dx) + (hash(g, n.tile, 120 + k) - 0.5) * 1.2,
        length: TS * (0.25 + 0.3 * hash(g, n.tile, 130 + k)),
        bend: (hash(g, n.tile, 140 + k) - 0.5) * 0.8,
      });
    });
  }
  colourByDistance(nodes);
  const leaves = [...nodes.values()].filter((n) => n.children.length === 0 && n.parent >= 0).map((n) => n.tile);
  return { nodes, roots, leaves };
}

// Colour by distance from the mother (Pack 20): the network shifts smoothly through three of the
// scheme's colours as it spreads out, so it reads as one living thing growing outwards rather than
// five branches of different colours. In COLOUR_STEPS steps (threads of one colour and width are
// drawn together, so a few steps keep the drawing cheap). The finest tips are a little paler.
export const COLOUR_RAMP = 30; // tiles along the network from the first colour to the last
export const COLOUR_STEPS = 10;
export const rampColours = () => [GLOW[0], GLOW[4], GLOW[1]];
export function colourAt(depth: number) {
  const stops = rampColours();
  const step = Math.min(COLOUR_STEPS, Math.round((depth / COLOUR_RAMP) * COLOUR_STEPS)) / COLOUR_STEPS;
  const f = step * (stops.length - 1);
  const k = Math.min(stops.length - 2, Math.floor(f));
  return mixColour(stops[k], stops[k + 1], f - k);
}
function colourByDistance(nodes: Map<number, NetNode>) {
  for (const n of nodes.values()) {
    const base = colourAt(n.depth);
    n.color = n.size <= 2 ? mixColour(base, 0xffffff, 0.25) : base;
  }
}

export function mixColour(a: number, b: number, t: number) {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// A point part of the way (s, 0..1) along the thread from a node's parent to the node.
export function pointOnThread(layout: NetworkLayout, n: NetNode, s: number) {
  const p = layout.nodes.get(n.parent);
  if (!p) return { x: n.x, y: n.y };
  const u = 1 - s;
  return {
    x: u * u * p.x + 2 * u * s * n.cx + s * s * n.x,
    y: u * u * p.y + 2 * u * s * n.cy + s * s * n.y,
  };
}

// The nodes from a root out to this one, in order.
export function pathFromRoot(layout: NetworkLayout, tile: number): number[] {
  const path: number[] = [];
  for (let t = tile; t >= 0; t = layout.nodes.get(t)?.parent ?? -1) path.push(t);
  return path.reverse();
}

// A small binary min-heap of (key, value) pairs.
class MinHeap {
  private keys: number[] = [];
  private values: number[] = [];

  get size() {
    return this.keys.length;
  }

  push(key: number, value: number) {
    const { keys, values } = this;
    let i = keys.length;
    keys.push(key);
    values.push(value);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (keys[up] <= key) break;
      keys[i] = keys[up];
      values[i] = values[up];
      i = up;
    }
    keys[i] = key;
    values[i] = value;
  }

  pop(): [number, number] {
    const { keys, values } = this;
    const top: [number, number] = [keys[0], values[0]];
    const key = keys.pop()!;
    const value = values.pop()!;
    if (keys.length === 0) return top;
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= keys.length) break;
      if (c + 1 < keys.length && keys[c + 1] < keys[c]) c++;
      if (keys[c] >= key) break;
      keys[i] = keys[c];
      values[i] = values[c];
      i = c;
    }
    keys[i] = key;
    values[i] = value;
    return top;
  }
}

// --- Chunks: the settled network is drawn in squares of CHUNK×CHUNK tiles, so that a change
// only redraws the squares where something looks different. ---

export const CHUNK = 8;

export const chunkOf = (tile: number, w: number) =>
  Math.floor((tile % w) / CHUNK) + Math.floor(Math.floor(tile / w) / CHUNK) * Math.ceil(w / CHUNK);

// Everything about a node that decides how it is drawn (its position follows from its tile and
// its parent).
export const nodeSignature = (n: NetNode) =>
  `${n.parent}|${Math.round(n.width * 2)}|${n.color}|${n.parent < 0 ? 'r' : n.children.length >= 2 ? 'k' : ''}|${n.hairs.length}`;

// The chunks where a node appeared, went, or looks different.
export function changedChunks(before: Map<number, string>, after: Map<number, string>, w: number) {
  const dirty = new Set<number>();
  for (const [tile, sig] of after) if (before.get(tile) !== sig) dirty.add(chunkOf(tile, w));
  for (const tile of before.keys()) if (!after.has(tile)) dirty.add(chunkOf(tile, w));
  return dirty;
}
