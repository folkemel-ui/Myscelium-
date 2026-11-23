// What is on a tile, in words: for holding a finger on the map (phones have no hover). A title and
// a few short lines, worked out fresh each time so cooldowns and health stay current.
import * as C from './constants';
import { canGrowAt, isEaten, mushroomAt, shelfAt, shelfConnected, towerAt } from './sim';
import { idx, inside, TILE, type Beetle, type Game } from './world';

export interface TileInfo {
  title: string;
  lines: string[];
  warning?: string; // something is being eaten: shown last, in red
}

const secs = (t: number) => `${Math.ceil(t)} s`;

// The beetle nearest the middle of the tile, if one is close enough to have been meant.
function beetleNear(g: Game, x: number, y: number): Beetle | undefined {
  let best: Beetle | undefined;
  let bestD = 0.9;
  for (const b of g.beetles) {
    if (b.hp <= 0) continue;
    const d = Math.hypot(b.x - (x + 0.5), b.y - (y + 0.5));
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export function describeTile(g: Game, x: number, y: number): TileInfo | null {
  if (!inside(g, x, y)) return null;
  const i = idx(g, x, y);

  const b = beetleNear(g, x, y);
  if (b) {
    const full = b.ate >= (b.appetite ?? C.BEETLE_APPETITE);
    const aim = b.aim === 'mother' ? 'the mother' : b.aim === 'mushroom' ? 'mushrooms and towers' : 'your threads';
    return {
      title: b.kind === 'bark' ? 'Bark beetle' : 'Beetle',
      lines: [
        `Health ${Math.max(0, Math.ceil(b.hp))} of ${b.maxHp ?? C.BEETLE_HP}`,
        full ? 'Full: leaving the forest' : `Goes for ${aim}`,
        `Eats ${b.appetite ?? C.BEETLE_APPETITE} tiles before it leaves (${b.ate} so far)`,
      ],
      warning: b.eatTimer > 0 && !full ? 'Eating your mycelium!' : undefined,
    };
  }

  const m = mushroomAt(g, x, y);
  if (m) {
    const spores = (m.mother ? C.MOTHER_SPORES : C.MUSHROOM_SPORES) * g.mods.sporeBoost;
    const eaten = isEaten(g, i);
    return {
      title: m.mother ? 'The mother' : 'Mushroom',
      lines: [
        `Makes ${spores.toFixed(1)} spores a second`,
        m.cooldown > 0 ? `Burst ready in ${secs(m.cooldown)}` : 'Burst ready: tap to burst',
        ...(m.mother ? ['Lose her and the round is lost'] : []),
      ],
      warning: eaten ? `Being eaten! (${Math.round(eaten * 100)}%)` : undefined,
    };
  }

  const t = towerAt(g, x, y);
  if (t) {
    const eaten = isEaten(g, i);
    return {
      title: 'Spore tower',
      lines: [
        `Shoots the nearest beetle within ${C.TOWER_RANGE} tiles`,
        `${C.TOWER_DAMAGE} damage every ${C.TOWER_INTERVAL} s`,
      ],
      warning: eaten ? `Being eaten! (${Math.round(eaten * 100)}%)` : undefined,
    };
  }

  const s = shelfAt(g, x, y);
  if (s) {
    return {
      title: 'Shelf fungus',
      lines: shelfConnected(g, s)
        ? [`Makes ${C.SHELF_NUTRIENTS} nutrients a second`]
        : ['Cut off from your network', 'Grow back to its tree to feed it again'],
    };
  }

  const tile = g.tiles[i];
  const mine = g.mycelium[i] === 1;
  if (tile === TILE.LOG) {
    const left = Math.ceil(g.logNutrients[i]);
    return {
      title: 'Rotting log',
      lines: mine
        ? [`${left} nutrients left`, `Giving you ${g.mods.rotSpeed.toFixed(1)} a second`]
        : [`${left} nutrients inside`, canGrowAt(g, x, y) ? 'Grow mycelium onto it to rot it' : 'Reach it with your mycelium to rot it'],
    };
  }
  if (tile === TILE.TREE) return { title: g.biome === 'pine' ? 'Pine' : 'Tree', lines: ['Mycelium can\'t grow here', 'A shelf fungus can grow on it'] };
  if (tile === TILE.ROCK) return { title: 'Rock', lines: ['Mycelium can\'t grow here'] };
  if (tile === TILE.WATER) return { title: 'Stream', lines: ['Mycelium can\'t cross water', 'Cross on a fallen log'] };
  if (mine) {
    const eaten = isEaten(g, i);
    return {
      title: tile === TILE.BRIDGE ? 'Your bridge' : 'Your mycelium',
      lines: [
        `${C.MYCELIUM_SPORES} spores a second`,
        ...(eaten ? [] : ['Tap with the mushroom tool to grow a mushroom']),
      ],
      warning: eaten ? `Being eaten! (${Math.round(eaten * 100)}%)` : undefined,
    };
  }
  return {
    title: tile === TILE.BRIDGE ? 'Fallen log bridge' : 'Forest floor',
    lines: [canGrowAt(g, x, y) ? `Grow here for ${g.mods.growCost} spores` : 'Mycelium can grow here once your network is next to it'],
  };
}
