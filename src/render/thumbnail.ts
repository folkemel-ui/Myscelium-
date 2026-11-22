// A small picture of a round for its save slot: the forest floor, trees and rocks, the network in
// its glow colours and the mushrooms, a couple of pixels per tile.
import { TILE, type Game } from '../game/world';
import { glowAt } from './forestLayout';

const PX = 2; // pixels per tile

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function thumbnail(g: Game): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = g.w * PX;
    canvas.height = g.h * PX;
    const ctx = canvas.getContext('2d')!;
    for (let i = 0; i < g.tiles.length; i++) {
      const x = (i % g.w) * PX;
      const y = Math.floor(i / g.w) * PX;
      const t = g.tiles[i];
      ctx.fillStyle = g.mycelium[i]
        ? hex(glowAt(g.noise[i]))
        : t === TILE.TREE ? (g.biome === 'pine' ? '#25483a' : '#2f5f34') : t === TILE.ROCK ? '#8a8a86' : t === TILE.LOG ? '#7a4a26'
        : t === TILE.WATER ? '#2f6fa8' : t === TILE.BRIDGE ? '#8a5a32' : g.biome === 'pine' ? '#4c4236' : '#5e4c36';
      ctx.fillRect(x, y, PX, PX);
    }
    for (const m of g.mushrooms) {
      ctx.fillStyle = m.mother ? '#ff3d7f' : '#ffffff';
      const r = m.mother ? 2 : 1;
      ctx.fillRect(m.x * PX + 1 - r, m.y * PX + 1 - r, r * 2, r * 2);
    }
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}
