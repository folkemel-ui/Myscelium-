// Progress between rounds: XP for each round, levels, and upgrade points spent on permanent
// upgrades that change the numbers a round starts with (its Mods).
import * as C from './constants';
import type { Mods } from './world';

// --- Levels of the game (the forests to play) ---

export interface LevelInfo {
  id: number;
  name: string;
  about: string;
  playable: boolean; // made yet
  opens?: string; // what it takes to open it, if it starts locked
  needs?: number; // the forest that must be won first
}

export const LEVELS: LevelInfo[] = [
  { id: 1, name: 'The Little Wood', about: 'A small, quiet forest. Beetles come to feed.', playable: true },
  { id: 2, name: 'Pine Hollow', about: 'A stream splits the forest. Hold the bridges.', playable: true, needs: 1, opens: 'Win The Little Wood to open' },
  { id: 3, name: 'The Swamp', about: '', playable: false },
  { id: 4, name: 'City Park', about: '', playable: false },
];

// --- XP ---

export interface RoundResult {
  forest?: number; // which forest (1 if missing)
  won: boolean;
  held: number; // share of the forest floor held at the end, 0..1
  kills: number;
  time: number; // seconds
}

export const XP_PER_PERCENT = 2; // per percent of the forest held
export const XP_PER_BEETLE = 5;
export const XP_FOR_WIN = 100;
export const SPEED_BONUS_FROM = 300; // a win faster than this many seconds earns a speed bonus...
export const SPEED_BONUS_PER = 3; // ...of 1 XP for every this many seconds faster

export interface XpLine {
  label: string;
  xp: number;
}

// What a round earns, line by line. Lost rounds still earn for what was held and beaten.
export function roundXp(r: RoundResult): XpLine[] {
  const lines: XpLine[] = [
    { label: `Forest held: ${Math.round(r.held * 100)}%`, xp: Math.round(r.held * 100) * XP_PER_PERCENT },
    { label: `Beetles beaten: ${r.kills}`, xp: r.kills * XP_PER_BEETLE },
  ];
  if (r.won) {
    lines.push({ label: 'The forest is yours', xp: XP_FOR_WIN });
    const bonus = Math.floor(Math.max(0, SPEED_BONUS_FROM - r.time) / SPEED_BONUS_PER);
    if (bonus > 0) lines.push({ label: 'Speed bonus', xp: bonus });
  }
  return lines;
}

export const totalXp = (lines: XpLine[]) => lines.reduce((s, l) => s + l.xp, 0);

// XP needed to go from this level to the next: 150, 250, 350...
export const xpToNext = (level: number) => 150 + 100 * (level - 1);

// --- Upgrades ---

export type UpgradeId = 'cheapGrow' | 'richSpores' | 'strongBurst' | 'fastCreep' | 'toughMycelium' | 'headStart';

export interface UpgradeInfo {
  id: UpgradeId;
  name: string;
  about: (rank: number) => string; // what the next rank does
  max: number;
}

const spores = (n: number) => (n === 1 ? '1 spore' : `${n} spores`);

export const UPGRADES: UpgradeInfo[] = [
  { id: 'cheapGrow', name: 'Thrifty threads', max: 2, about: (r) => `Growing a tile costs ${spores(C.GROW_COST - r - 1)} instead of ${C.GROW_COST - r}` },
  { id: 'richSpores', name: 'Rich caps', max: 3, about: () => 'Mushrooms make 20% more spores' },
  { id: 'strongBurst', name: 'Mighty bursts', max: 3, about: () => 'Bursts hit 1 harder and reach a little further' },
  { id: 'fastCreep', name: 'Eager growth', max: 3, about: () => 'The network creeps out 25% faster on its own' },
  { id: 'toughMycelium', name: 'Tough threads', max: 3, about: () => 'Beetles take 25% longer to eat a tile' },
  { id: 'headStart', name: 'Head start', max: 3, about: () => 'Start each round with 15 more spores' },
];

export interface Profile {
  level: number;
  xp: number; // towards the next level
  points: number; // upgrade points not spent yet
  upgrades: Partial<Record<UpgradeId, number>>;
  rounds: number;
  wins: number;
  bestTime: number | null; // the fastest win in The Little Wood, in seconds (kept for old saves)
  forestsWon: number[]; // forests won at least once
  bestTimes: Partial<Record<number, number>>; // the fastest win in each forest, in seconds
}

export const newProfile = (): Profile => ({
  level: 1, xp: 0, points: 0, upgrades: {}, rounds: 0, wins: 0, bestTime: null, forestsWon: [], bestTimes: {},
});

// A forest can be played once it is made and the forest before it has been won.
export const forestOpen = (p: Profile, l: LevelInfo) => l.playable && (l.needs === undefined || p.forestsWon.includes(l.needs));

export const rank = (p: Profile, id: UpgradeId) => p.upgrades[id] ?? 0;

// A finished round: its XP, any levels gained (one upgrade point each), and the tallies.
export function finishRound(p: Profile, r: RoundResult): { profile: Profile; lines: XpLine[]; levelsGained: number } {
  const lines = roundXp(r);
  let xp = p.xp + totalXp(lines);
  let level = p.level;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
  }
  const levelsGained = level - p.level;
  const forest = r.forest ?? 1;
  const bestTimes = { ...p.bestTimes };
  if (r.won) bestTimes[forest] = Math.min(bestTimes[forest] ?? Infinity, r.time);
  const forestsWon = r.won && !p.forestsWon.includes(forest) ? [...p.forestsWon, forest].sort() : p.forestsWon;
  return {
    profile: {
      ...p, xp, level, points: p.points + levelsGained, rounds: p.rounds + 1, wins: p.wins + (r.won ? 1 : 0),
      bestTime: bestTimes[1] ?? null, forestsWon, bestTimes,
    },
    lines,
    levelsGained,
  };
}

// Spend a point on the next rank of an upgrade; null if it can't be bought.
export function buyUpgrade(p: Profile, id: UpgradeId): Profile | null {
  const info = UPGRADES.find((u) => u.id === id)!;
  if (p.points < 1 || rank(p, id) >= info.max) return null;
  return { ...p, points: p.points - 1, upgrades: { ...p.upgrades, [id]: rank(p, id) + 1 } };
}

// The numbers a round starts with, given the upgrades bought.
export function modsFor(p: Profile): Mods {
  return {
    growCost: C.GROW_COST - rank(p, 'cheapGrow'),
    sporeBoost: 1 + 0.2 * rank(p, 'richSpores'),
    burstDamage: C.BURST_DAMAGE + rank(p, 'strongBurst'),
    burstRange: C.BURST_RANGE + 0.3 * rank(p, 'strongBurst'),
    creep: C.CREEP_PER_SECOND * (1 + 0.25 * rank(p, 'fastCreep')),
    eatTime: C.BEETLE_EAT_TIME * (1 + 0.25 * rank(p, 'toughMycelium')),
    startSpores: C.START_SPORES + 15 * rank(p, 'headStart'),
  };
}
