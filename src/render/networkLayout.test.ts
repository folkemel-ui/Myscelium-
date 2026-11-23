import { describe, expect, test } from 'vitest';
import { canGrowAt, growMycelium, step } from '../game/sim';
import { createLevel1, idx, TILE, type Game } from '../game/world';
import { GLOW } from './forestLayout';
import {
  changedChunks, CHUNK, chunkOf, COLOUR_RAMP, COLOUR_STEPS, colourAt, MAX_THREAD, mixColour, networkLayout, nodeSignature, pathFromRoot,
  pointOnThread,
} from './networkLayout';

// A level with a good spread of mycelium.
function grown(seed = 2): Game {
  const g = createLevel1(seed);
  g.spores = 1e6;
  for (let k = 0; k < 300; k++) step(g, 0.1); // creep, no beetles yet
  const m = g.mushrooms[0];
  for (let x = m.x + 1; x < m.x + 10; x++) growMycelium(g, x, m.y);
  return g;
}

describe('the living network', () => {
  test('every tile of mycelium is a node, joined to a neighbour it grew from', () => {
    const g = grown();
    const net = networkLayout(g);
    expect(net.nodes.size).toBe(g.covered);
    const m = g.mushrooms[0];
    expect(net.roots[0]).toBe(idx(g, m.x, m.y));
    for (const n of net.nodes.values()) {
      if (n.parent < 0) continue;
      const d = Math.abs((n.tile % g.w) - (n.parent % g.w)) + Math.abs(Math.floor(n.tile / g.w) - Math.floor(n.parent / g.w));
      expect(d).toBe(1);
      expect(net.nodes.get(n.parent)!.children).toContain(n.tile);
      expect(n.depth).toBe(net.nodes.get(n.parent)!.depth + 1);
    }
  });

  test('threads are thickest near the mother and fine at the tips', () => {
    const g = grown();
    const net = networkLayout(g);
    for (const n of net.nodes.values()) {
      if (n.parent >= 0 && net.nodes.get(n.parent)!.parent >= 0) {
        expect(net.nodes.get(n.parent)!.width).toBeGreaterThanOrEqual(n.width);
      }
    }
    const root = net.nodes.get(net.roots[0])!;
    expect(root.size).toBe(net.nodes.size);
    for (const n of net.nodes.values()) expect(root.width).toBeGreaterThanOrEqual(n.width);
    expect(root.width).toBeLessThanOrEqual(MAX_THREAD);
    for (const t of net.leaves) expect(net.nodes.get(t)!.width).toBeCloseTo(0.9);
  });

  test('a piece cut off from the mother gets its own root', () => {
    const g = grown();
    const m = g.mushrooms[0];
    // Cut the line grown out east of the mother.
    g.mycelium[idx(g, m.x + 3, m.y)] = 0;
    for (const [dx, dy] of [[3, -1], [3, 1]]) g.mycelium[idx(g, m.x + dx, m.y + dy)] = 0;
    const net = networkLayout(g);
    const far = net.nodes.get(idx(g, m.x + 9, m.y));
    expect(far).toBeDefined();
    const root = pathFromRoot(net, far!.tile)[0];
    if (root !== net.roots[0]) expect(net.roots).toContain(root);
  });

  test('the same network is laid out the same way', () => {
    const a = networkLayout(grown());
    const b = networkLayout(grown());
    expect([...a.nodes.values()].map((n) => [n.tile, n.parent, n.x, n.cx])).toEqual(
      [...b.nodes.values()].map((n) => [n.tile, n.parent, n.x, n.cx]),
    );
  });

  test('points along a thread run from the parent to the node', () => {
    const net = networkLayout(grown());
    const n = [...net.nodes.values()].find((v) => v.parent >= 0)!;
    const p = net.nodes.get(n.parent)!;
    expect(pointOnThread(net, n, 0)).toEqual({ x: p.x, y: p.y });
    const end = pointOnThread(net, n, 1);
    expect(end.x).toBeCloseTo(n.x);
    expect(end.y).toBeCloseTo(n.y);
  });

  test('a path from the mother reaches every tip', () => {
    const net = networkLayout(grown());
    expect(net.leaves.length).toBeGreaterThan(5);
    for (const tip of net.leaves) {
      const path = pathFromRoot(net, tip);
      expect(path[path.length - 1]).toBe(tip);
      for (let k = 1; k < path.length; k++) expect(net.nodes.get(path[k])!.parent).toBe(path[k - 1]);
    }
  });

  test('hairs reach only into open ground', () => {
    const g = grown();
    const net = networkLayout(g);
    let hairs = 0;
    for (const n of net.nodes.values()) {
      expect(n.hairs.length).toBeLessThanOrEqual(2);
      hairs += n.hairs.length;
    }
    expect(hairs).toBeGreaterThan(0);
  });
});

test('branches wander instead of running in straight rows', () => {
  // On an open patch, count how many threads keep going straight through their parent.
  const g = grown(4);
  const net = networkLayout(g);
  let straight = 0;
  let turns = 0;
  for (const n of net.nodes.values()) {
    const p = net.nodes.get(n.parent);
    const gp = p && net.nodes.get(p.parent);
    if (!gp) continue;
    const same = n.tile - p.tile === p.tile - gp.tile;
    if (same) straight++;
    else turns++;
  }
  expect(turns / (straight + turns)).toBeGreaterThan(0.3);
});

describe('colour by distance from the mother', () => {
  test('the colour follows how far along the network a thread is', () => {
    const net = networkLayout(grown());
    for (const n of net.nodes.values()) {
      const base = colourAt(n.depth);
      expect([base, mixColour(base, 0xffffff, 0.25)]).toContain(n.color);
    }
  });

  test('it starts at the scheme\'s first colour and ends at the last, in a few steps', () => {
    expect(colourAt(0)).toBe(GLOW[0]);
    expect(colourAt(COLOUR_RAMP)).toBe(GLOW[1]);
    expect(colourAt(COLOUR_RAMP * 3)).toBe(GLOW[1]);
    const seen = new Set(Array.from({ length: 200 }, (_, d) => colourAt(d)));
    expect(seen.size).toBe(COLOUR_STEPS + 1);
  });

  test('neighbouring threads change colour only a little', () => {
    const net = networkLayout(grown());
    for (const n of net.nodes.values()) {
      const p = net.nodes.get(n.parent);
      if (!p) continue;
      expect(Math.abs(n.depth - p.depth)).toBe(1);
    }
  });
});

test('few long straight runs side by side (a full disc of network)', () => {
  const g = createLevel1(3);
  const m = g.mushrooms[0];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const i = idx(g, x, y);
    if (Math.hypot(x - m.x, y - m.y) < 14 && g.tiles[i] !== TILE.TREE && g.tiles[i] !== TILE.ROCK) g.mycelium[i] = 1;
  }
  const net = networkLayout(g);
  // Tiles that sit in a straight run of 4 or more steps the same way.
  const inRun = new Set<number>();
  for (const n of net.nodes.values()) {
    const dir = n.tile - n.parent;
    let k = n;
    let len = 0;
    while (net.nodes.get(k.parent) && k.tile - k.parent === dir) {
      len++;
      k = net.nodes.get(k.parent)!;
    }
    if (len < 4) continue;
    let j = n;
    for (let s = 0; s <= len; s++) {
      inRun.add(j.tile);
      j = net.nodes.get(j.parent)!;
    }
  }
  // Without the cost of going straight on it was 55%.
  expect(inRun.size / net.nodes.size).toBeLessThan(0.48);
});

describe('drawing in chunks', () => {
  const signatures = (net: ReturnType<typeof networkLayout>) => new Map([...net.nodes.values()].map((n) => [n.tile, nodeSignature(n)]));

  test('nothing changed: nothing to redraw', () => {
    const g = grown(4);
    const a = signatures(networkLayout(g));
    expect(changedChunks(a, signatures(networkLayout(g)), g.w).size).toBe(0);
  });

  test('one new tile at the edge redraws only a few of the chunks', () => {
    const g = grown(4);
    const before = signatures(networkLayout(g));
    // Grow one tile at the network's edge, far from the mother.
    const m = g.mushrooms[0];
    let far = -1;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (canGrowAt(g, x, y) && (far < 0 || Math.hypot(x - m.x, y - m.y) > Math.hypot((far % g.w) - m.x, Math.floor(far / g.w) - m.y))) far = idx(g, x, y);
    }
    g.mycelium[far] = 1;
    const dirty = changedChunks(before, signatures(networkLayout(g)), g.w);
    const all = Math.ceil(g.w / CHUNK) * Math.ceil(g.h / CHUNK);
    expect(dirty.has(chunkOf(far, g.w))).toBe(true);
    expect(dirty.size).toBeLessThanOrEqual(all / 3);
  });

  test('an eaten tile redraws the chunk it was in', () => {
    const g = grown(4);
    const before = signatures(networkLayout(g));
    const m = g.mushrooms[0];
    const eaten = idx(g, m.x + 3, m.y);
    g.mycelium[eaten] = 0;
    expect(changedChunks(before, signatures(networkLayout(g)), g.w).has(chunkOf(eaten, g.w))).toBe(true);
  });
});
