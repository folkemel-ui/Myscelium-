// Numbers for drawing the things the player builds: which way a shelf fungus faces, how a spore
// bolt flies, and how a tower kicks when it shoots. Pure, so they can be tested.
import { idx, inside, type Game } from '../game/world';

const SIDES = [[0, 1], [1, 0], [-1, 0], [0, -1]] as const; // below first: it reads best from above

// The side of a shelf's tree that touches the network (the shelf grows out that way), or below.
export function shelfFacing(g: Game, x: number, y: number): readonly [number, number] {
  for (const s of SIDES) if (inside(g, x + s[0], y + s[1]) && g.mycelium[idx(g, x + s[0], y + s[1])]) return s;
  return SIDES[0];
}

export const BOLT_TIME = 0.22; // seconds a spore bolt takes to fly

// Where a bolt is (0 at the tower, 1 at the beetle) after `age` seconds, and how bright it is.
// It speeds up as it goes, then flashes and fades at the beetle.
export function boltAt(age: number): { along: number; alpha: number } | null {
  if (age < 0 || age > BOLT_TIME * 1.6) return null;
  const t = Math.min(1, age / BOLT_TIME);
  const along = t * t * (3 - 2 * t);
  const alpha = age <= BOLT_TIME ? 1 : 1 - (age - BOLT_TIME) / (BOLT_TIME * 0.6);
  return { along, alpha: Math.max(0, alpha) };
}

// A tower's tip swells when it shoots and settles back over 0.3 s.
export function towerKick(age: number): number {
  if (age < 0 || age > 0.3) return 1;
  return 1 + 0.25 * (1 - age / 0.3);
}
