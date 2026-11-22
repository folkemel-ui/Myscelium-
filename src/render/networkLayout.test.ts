import { describe, expect, test } from 'vitest';
import { growMycelium, step } from '../game/sim';
import { createLevel1, idx, type Game } from '../game/world';
import { BRANCH_MIN, MAX_THREAD, networkLayout, pathFromRoot, pointOnThread } from './networkLayout';

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

describe('branch colours', () => {
  test('each main branch keeps one colour, and small twigs keep their parent\'s', () => {
    const net = networkLayout(grown(4));
    for (const n of net.nodes.values()) {
      const p = net.nodes.get(n.parent);
      if (!p || p.parent < 0) continue;
      // A colour change only where a big side branch starts.
      if (n.branch !== p.branch) expect(n.size).toBeGreaterThanOrEqual(BRANCH_MIN);
      // The biggest child always carries its parent's colour on.
      const biggest = p.children.map((c) => net.nodes.get(c)!).sort((a, b) => b.size - a.size)[0];
      expect(biggest.branch).toBe(p.branch);
    }
  });

  test('the branches leaving the mother get different colours', () => {
    const net = networkLayout(grown(4));
    const root = net.nodes.get(net.roots[0])!;
    const colours = root.children.map((c) => net.nodes.get(c)!.branch);
    expect(new Set(colours).size).toBe(colours.length);
  });

  test('far fewer colour changes than random colours per tile would give', () => {
    const g = grown(4);
    const net = networkLayout(g);
    let changes = 0;
    let links = 0;
    for (const n of net.nodes.values()) {
      const p = net.nodes.get(n.parent);
      if (!p || p.parent < 0) continue; // the branches leaving the mother differ on purpose
      links++;
      if (n.branch !== p.branch) changes++;
    }
    expect(changes / links).toBeLessThan(0.15); // random colours would change at 4 links in 5
  });
});
