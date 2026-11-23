// Progress between rounds: XP for each round, levels, an upgrade tree bought with points from
// levelling up, personal records, a round history, lifetime totals, achievements, and the
// player's name and colours.
import * as C from './constants';
import type { Mods } from './world';

// --- Forests ---

export interface LevelInfo {
  id: number;
  name: string;
  about: string;
  playable: boolean; // made yet
  opens?: string; // what it takes to open it, if it starts locked
  needs?: number; // the forest that must be won first
}

// Things to build during a round, opened by the player's level.
export type UnlockId = 'digest' | 'shelf' | 'tower';
export const UNLOCKS: { id: UnlockId; level: number; name: string; about: string }[] = [
  { id: 'digest', level: 2, name: 'Digest', about: 'Swap spores for nutrients, or nutrients for spores' },
  { id: 'shelf', level: 3, name: 'Shelf fungus', about: 'Grows on a tree by your network and makes nutrients' },
  { id: 'tower', level: 5, name: 'Spore tower', about: 'Built on your mycelium, it shoots the nearest beetle' },
];
export const unlocked = (p: Profile, id: UnlockId) => p.level >= UNLOCKS.find((u) => u.id === id)!.level;
// The next thing a level-up will open, if any is left.
export const nextUnlock = (p: Profile) => UNLOCKS.find((u) => p.level < u.level) ?? null;

export const LEVELS: LevelInfo[] = [
  { id: 1, name: 'The Little Wood', about: 'A small, quiet forest. Beetles come to feed.', playable: true },
  { id: 2, name: 'Pine Hollow', about: 'A stream splits the forest. Hold the bridges.', playable: true, needs: 1, opens: 'Win The Little Wood to open' },
  { id: 3, name: 'The Swamp', about: '', playable: false },
  { id: 4, name: 'City Park', about: '', playable: false },
];

// --- A finished round ---

export interface RoundStatsLite {
  grown: number; // tiles grown by hand
  mushrooms: number; // mushrooms grown
  bursts: number;
  peakSpores: number;
  mushroomsLost: number;
  motherBitten: boolean; // a beetle chewed on the mother at some point
  threeQuartersAt: number | null; // when the share held first reached 3/4 of the goal
}

export interface RoundResult {
  forest?: number; // which forest (1 if missing)
  won: boolean;
  held: number; // share of the forest floor held at the end, 0..1
  kills: number;
  time: number; // seconds
  stats?: RoundStatsLite;
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

// --- The upgrade tree ---

export type Branch = 'growth' | 'defence' | 'decay';
export const BRANCHES: { id: Branch; name: string; about: string }[] = [
  { id: 'growth', name: 'Growth', about: 'Spreading further and faster' },
  { id: 'defence', name: 'Defence', about: 'Fighting off the beetles' },
  { id: 'decay', name: 'Decay', about: 'Spores and nutrients' },
];

export type UpgradeId =
  | 'cheapGrow' | 'fastCreep' | 'headStart' | 'deepRoots'
  | 'strongBurst' | 'toughMycelium' | 'quickRecovery' | 'mothersWrath'
  | 'richSpores' | 'rotFast' | 'feast' | 'cheapCaps';

export interface UpgradeInfo {
  id: UpgradeId;
  name: string;
  branch: Branch;
  tier: 1 | 2 | 3; // its row in the tree: the start, the middle, the big one at the end
  max: number;
  about: (rank: number) => string; // what the next rank does
  needs?: { upgrade: UpgradeId } | { branchPoints: number };
}

export const CAPSTONE_POINTS = 4; // points spent in a branch before its last upgrade opens

const spores = (n: number) => (n === 1 ? '1 spore' : `${n} spores`);

export const UPGRADES: UpgradeInfo[] = [
  { id: 'cheapGrow', name: 'Thrifty threads', branch: 'growth', tier: 1, max: 2, about: (r) => `Growing a tile costs ${spores(C.GROW_COST - r - 1)} instead of ${C.GROW_COST - r}` },
  { id: 'fastCreep', name: 'Eager growth', branch: 'growth', tier: 2, max: 3, about: () => 'The network creeps out 25% faster on its own', needs: { upgrade: 'cheapGrow' } },
  { id: 'headStart', name: 'Head start', branch: 'growth', tier: 2, max: 3, about: () => 'Start each round with 15 more spores', needs: { upgrade: 'cheapGrow' } },
  { id: 'deepRoots', name: 'Deep roots', branch: 'growth', tier: 3, max: 1, about: () => 'Start each round with a big patch of mycelium (13 tiles, not 5)', needs: { branchPoints: CAPSTONE_POINTS } },
  { id: 'strongBurst', name: 'Mighty bursts', branch: 'defence', tier: 1, max: 3, about: () => 'Bursts hit 1 harder and reach a little further' },
  { id: 'toughMycelium', name: 'Tough threads', branch: 'defence', tier: 2, max: 3, about: () => 'Beetles take 25% longer to eat a tile', needs: { upgrade: 'strongBurst' } },
  { id: 'quickRecovery', name: 'Quick recovery', branch: 'defence', tier: 2, max: 2, about: () => 'Mushrooms can burst again 1 second sooner', needs: { upgrade: 'strongBurst' } },
  { id: 'mothersWrath', name: "Mother's wrath", branch: 'defence', tier: 3, max: 1, about: () => 'The mother puffs at beetles twice as often, and further', needs: { branchPoints: CAPSTONE_POINTS } },
  { id: 'richSpores', name: 'Rich caps', branch: 'decay', tier: 1, max: 3, about: () => 'Mushrooms make 20% more spores' },
  { id: 'rotFast', name: 'Fast rot', branch: 'decay', tier: 2, max: 2, about: () => 'Logs rot 50% faster into nutrients', needs: { upgrade: 'richSpores' } },
  { id: 'feast', name: 'Feast', branch: 'decay', tier: 2, max: 2, about: () => 'Beaten beetles give 2 more nutrients', needs: { upgrade: 'richSpores' } },
  { id: 'cheapCaps', name: 'Cheap caps', branch: 'decay', tier: 3, max: 1, about: () => `Mushrooms cost 10 nutrients instead of ${C.MUSHROOM_COST}`, needs: { branchPoints: CAPSTONE_POINTS } },
];

export const upgradeInfo = (id: UpgradeId) => UPGRADES.find((u) => u.id === id)!;

// --- Colours ---

export type SchemeId = 'rose' | 'ocean' | 'ember' | 'venom' | 'aurora';
export interface Scheme {
  id: SchemeId;
  name: string;
  level: number; // the player level it opens at
  mother: number;
  glow: number[]; // five colours for the threads, caps and spores
}

export const SCHEMES: Scheme[] = [
  { id: 'rose', name: 'Rose', level: 1, mother: 0xff3d7f, glow: [0xff4fd8, 0x4ff3ff, 0xb6ff4f, 0xffb84f, 0x9d6bff] },
  { id: 'ocean', name: 'Ocean', level: 3, mother: 0x3dd8ff, glow: [0x4ff3ff, 0x3d9bff, 0x7af0c8, 0x9d6bff, 0x4fffb0] },
  { id: 'ember', name: 'Ember', level: 5, mother: 0xff6a2a, glow: [0xff7a3d, 0xffb84f, 0xff4f6a, 0xffe066, 0xff4fd8] },
  { id: 'venom', name: 'Venom', level: 7, mother: 0x8aff3d, glow: [0xb6ff4f, 0x6aff8a, 0xe8ff4f, 0x4fffb0, 0x9dff3d] },
  { id: 'aurora', name: 'Aurora', level: 9, mother: 0xb06bff, glow: [0x9d6bff, 0xff4fd8, 0x4ff3ff, 0x6aff8a, 0xc8a0ff] },
];

export const NAME_MAX = 24;
export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

// How grand the mother looks: a step every 2 player levels, up to 5.
export const motherTier = (level: number) => Math.min(5, Math.floor((level - 1) / 2));

// --- The profile ---

export interface Records {
  mostKills: number; // beetles beaten in one round
  mostSpores: number; // spores a second, at most, in one round
  mostMushrooms: number; // mushrooms grown in one round
  fewestHandWin: number | null; // fewest tiles grown by hand in a won round
}

export interface RoundRecord {
  forest: number;
  won: boolean;
  time: number;
  held: number;
  kills: number;
  xp: number;
  at: number; // when, ms since 1970
}

export interface Totals {
  kills: number;
  grown: number;
  mushrooms: number;
  bursts: number;
  time: number; // seconds played
}

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
  name: string;
  scheme: SchemeId;
  records: Records;
  history: RoundRecord[]; // the last HISTORY_KEEP rounds, oldest first
  totals: Totals;
  achievements: string[]; // ids earned
}

export const HISTORY_KEEP = 50;

export const newProfile = (): Profile => ({
  level: 1, xp: 0, points: 0, upgrades: {}, rounds: 0, wins: 0, bestTime: null, forestsWon: [], bestTimes: {},
  name: '', scheme: 'rose',
  records: { mostKills: 0, mostSpores: 0, mostMushrooms: 0, fewestHandWin: null },
  history: [],
  totals: { kills: 0, grown: 0, mushrooms: 0, bursts: 0, time: 0 },
  achievements: [],
});

// A forest can be played once it is made and the forest before it has been won.
export const forestOpen = (p: Profile, l: LevelInfo) => l.playable && (l.needs === undefined || p.forestsWon.includes(l.needs));

export const rank = (p: Profile, id: UpgradeId) => p.upgrades[id] ?? 0;
export const branchPoints = (p: Profile, b: Branch) => UPGRADES.filter((u) => u.branch === b).reduce((s, u) => s + rank(p, u.id), 0);

// Whether an upgrade's next rank can be bought, and if not, why.
export function canBuy(p: Profile, id: UpgradeId): { ok: boolean; why?: string } {
  const u = upgradeInfo(id);
  if (rank(p, id) >= u.max) return { ok: false, why: 'Fully grown' };
  if (u.needs && 'upgrade' in u.needs && rank(p, u.needs.upgrade) < 1) return { ok: false, why: `Needs ${upgradeInfo(u.needs.upgrade).name}` };
  if (u.needs && 'branchPoints' in u.needs && branchPoints(p, u.branch) < u.needs.branchPoints) {
    const name = BRANCHES.find((b) => b.id === u.branch)!.name;
    return { ok: false, why: `Needs ${u.needs.branchPoints} points in ${name}` };
  }
  if (p.points < 1) return { ok: false, why: 'No points to spend' };
  return { ok: true };
}

// Add XP, levelling up as often as it reaches; a point for each level.
export function grantXp(p: Profile, xp: number): { profile: Profile; levelsGained: number } {
  let left = p.xp + xp;
  let level = p.level;
  while (left >= xpToNext(level)) {
    left -= xpToNext(level);
    level++;
  }
  const levelsGained = level - p.level;
  return { profile: { ...p, xp: left, level, points: p.points + levelsGained }, levelsGained };
}

// --- Achievements ---

export interface Achievement {
  id: string;
  name: string;
  about: string;
  xp: number;
  hidden?: boolean; // shown as "???" until earned
  check: (p: Profile, r?: RoundResult) => boolean; // r: the round just finished, if any
}

const won = (r?: RoundResult) => r?.won === true;
const st = (r?: RoundResult) => r?.stats;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'firstRound', name: 'First spores', about: 'Finish a round', xp: 10, check: (p) => p.rounds >= 1 },
  { id: 'firstWin', name: 'The forest is yours', about: 'Win a round', xp: 25, check: (p) => p.wins >= 1 },
  { id: 'winPine', name: 'Across the stream', about: 'Win Pine Hollow', xp: 40, check: (p) => p.forestsWon.includes(2) },
  { id: 'quickBloom', name: 'Quick bloom', about: 'Win in under 3 minutes', xp: 30, check: (_, r) => won(r) && r!.time < 180 },
  { id: 'wildfire', name: 'Wildfire growth', about: 'Win in under 2½ minutes', xp: 50, hidden: true, check: (_, r) => won(r) && r!.time < 150 },
  { id: 'squasher', name: 'Bug squasher', about: 'Beat 10 beetles in one round', xp: 15, check: (_, r) => (r?.kills ?? 0) >= 10 },
  { id: 'swarmBreaker', name: 'Swarm breaker', about: 'Beat 40 beetles in one round', xp: 40, check: (_, r) => (r?.kills ?? 0) >= 40 },
  { id: 'bane', name: 'Beetle bane', about: 'Beat 100 beetles in all', xp: 25, check: (p) => p.totals.kills >= 100 },
  { id: 'exterminator', name: 'Exterminator', about: 'Beat 1,000 beetles in all', xp: 60, check: (p) => p.totals.kills >= 1000 },
  { id: 'untouched', name: 'Untouched', about: 'Win without losing a mushroom', xp: 30, check: (_, r) => won(r) && st(r)?.mushroomsLost === 0 && (st(r)?.mushrooms ?? 0) > 0 },
  { id: 'garden', name: 'Mushroom garden', about: 'Grow 10 mushrooms in one round', xp: 15, check: (_, r) => (st(r)?.mushrooms ?? 0) >= 10 },
  { id: 'fairyRing', name: 'Fairy ring', about: 'Grow 25 mushrooms in one round', xp: 35, check: (_, r) => (st(r)?.mushrooms ?? 0) >= 25 },
  { id: 'pureThreads', name: 'Pure threads', about: 'Win without growing a single mushroom', xp: 60, hidden: true, check: (_, r) => won(r) && st(r)?.mushrooms === 0 },
  { id: 'letItCreep', name: 'Let it creep', about: 'Win growing fewer than 60 tiles by hand', xp: 50, hidden: true, check: (_, r) => won(r) && (st(r)?.grown ?? 999) < 60 },
  { id: 'sporeEngine', name: 'Spore engine', about: 'Reach 10 spores a second', xp: 15, check: (_, r) => (st(r)?.peakSpores ?? 0) >= 10 },
  { id: 'sporeStorm', name: 'Spore storm', about: 'Reach 25 spores a second', xp: 35, check: (_, r) => (st(r)?.peakSpores ?? 0) >= 25 },
  { id: 'breathes', name: 'Everything breathes', about: 'Reach the third stage in under 2 minutes', xp: 40, hidden: true, check: (_, r) => (st(r)?.threeQuartersAt ?? Infinity) < 120 },
  { id: 'brink', name: 'Back from the brink', about: 'Win after a beetle chewed on the mother', xp: 30, hidden: true, check: (_, r) => won(r) && st(r)?.motherBitten === true },
  { id: 'burstHappy', name: 'Burst happy', about: 'Burst mushrooms 20 times in one round', xp: 15, check: (_, r) => (st(r)?.bursts ?? 0) >= 20 },
  { id: 'patience', name: 'Patience', about: 'Win without bursting once', xp: 40, hidden: true, check: (_, r) => won(r) && st(r)?.bursts === 0 },
  { id: 'growingUp', name: 'Growing up', about: 'Reach level 5', xp: 25, check: (p) => p.level >= 5 },
  { id: 'oldGrowth', name: 'Old growth', about: 'Reach level 10', xp: 50, check: (p) => p.level >= 10 },
  { id: 'mutation', name: 'Mutation', about: 'Buy an upgrade', xp: 10, check: (p) => Object.values(p.upgrades).some((r) => (r ?? 0) > 0) },
  { id: 'fullBloom', name: 'Full bloom', about: 'Buy the last upgrade of a branch', xp: 40, check: (p) => UPGRADES.some((u) => u.tier === 3 && rank(p, u.id) > 0) },
  { id: 'specialist', name: 'Specialist', about: 'Fill a whole branch of the tree', xp: 60, check: (p) => BRANCHES.some((b) => UPGRADES.filter((u) => u.branch === b.id).every((u) => rank(p, u.id) >= u.max)) },
  { id: 'regular', name: 'Regular', about: 'Play 10 rounds', xp: 20, check: (p) => p.rounds >= 10 },
  { id: 'devoted', name: 'Devoted', about: 'Play 50 rounds', xp: 50, check: (p) => p.rounds >= 50 },
  { id: 'conqueror', name: 'Conqueror', about: 'Win 10 rounds', xp: 40, check: (p) => p.wins >= 10 },
  { id: 'named', name: 'A name of my own', about: 'Give your fungus a name', xp: 10, check: (p) => p.name.length > 0 },
  { id: 'newColours', name: 'New colours', about: 'Choose another colour scheme', xp: 10, check: (p) => p.scheme !== 'rose' },
];

// Achievements newly earned: checked again after their XP, in case it brought a level that earns
// another (Growing up).
export function award(p: Profile, r?: RoundResult): { profile: Profile; earned: Achievement[]; levelsGained: number } {
  let profile = p;
  const earned: Achievement[] = [];
  let levelsGained = 0;
  for (let pass = 0; pass < 3; pass++) {
    const fresh = ACHIEVEMENTS.filter((a) => !profile.achievements.includes(a.id) && a.check(profile, r));
    if (fresh.length === 0) break;
    profile = { ...profile, achievements: [...profile.achievements, ...fresh.map((a) => a.id)] };
    const gained = grantXp(profile, fresh.reduce((s, a) => s + a.xp, 0));
    profile = gained.profile;
    levelsGained += gained.levelsGained;
    earned.push(...fresh);
  }
  return { profile, earned, levelsGained };
}

// --- Finishing a round ---

export interface RoundOutcome {
  profile: Profile;
  lines: XpLine[]; // XP for the round itself
  levelsGained: number; // from the round and its achievements
  newRecords: string[]; // records beaten (not counting a first round, when there was none)
  earned: Achievement[];
}

export function finishRound(p: Profile, r: RoundResult): RoundOutcome {
  const lines = roundXp(r);
  const xp = totalXp(lines);
  const forest = r.forest ?? 1;
  const s = r.stats;

  // Best times and forests won.
  const bestTimes = { ...p.bestTimes };
  const newRecords: string[] = [];
  if (r.won) {
    if (bestTimes[forest] !== undefined && r.time < bestTimes[forest]!) newRecords.push(`Fastest win in ${LEVELS.find((l) => l.id === forest)?.name}`);
    bestTimes[forest] = Math.min(bestTimes[forest] ?? Infinity, r.time);
  }
  const forestsWon = r.won && !p.forestsWon.includes(forest) ? [...p.forestsWon, forest].sort() : p.forestsWon;

  // Records: only called "new" when there was one to beat.
  const rec = { ...p.records };
  const beat = (name: string, value: number, before: number, better: boolean) => {
    if (better && before > 0) newRecords.push(`${name}: ${value}`);
  };
  beat('Most beetles in a round', r.kills, rec.mostKills, r.kills > rec.mostKills);
  rec.mostKills = Math.max(rec.mostKills, r.kills);
  if (s) {
    const spores = Math.round(s.peakSpores * 10) / 10;
    beat('Most spores a second', spores, rec.mostSpores, spores > rec.mostSpores);
    rec.mostSpores = Math.max(rec.mostSpores, spores);
    beat('Most mushrooms in a round', s.mushrooms, rec.mostMushrooms, s.mushrooms > rec.mostMushrooms);
    rec.mostMushrooms = Math.max(rec.mostMushrooms, s.mushrooms);
    if (r.won) {
      if (rec.fewestHandWin !== null && s.grown < rec.fewestHandWin) newRecords.push(`Fewest tiles grown by hand in a win: ${s.grown}`);
      rec.fewestHandWin = Math.min(rec.fewestHandWin ?? Infinity, s.grown);
    }
  }

  const history = [...p.history, { forest, won: r.won, time: r.time, held: r.held, kills: r.kills, xp, at: Date.now() }].slice(-HISTORY_KEEP);
  const totals = {
    kills: p.totals.kills + r.kills,
    grown: p.totals.grown + (s?.grown ?? 0),
    mushrooms: p.totals.mushrooms + (s?.mushrooms ?? 0),
    bursts: p.totals.bursts + (s?.bursts ?? 0),
    time: p.totals.time + r.time,
  };

  const tallied: Profile = {
    ...p, rounds: p.rounds + 1, wins: p.wins + (r.won ? 1 : 0),
    bestTime: bestTimes[1] ?? null, forestsWon, bestTimes, records: rec, history, totals,
  };
  const levelled = grantXp(tallied, xp);
  const awarded = award(levelled.profile, r);
  return {
    profile: awarded.profile,
    lines,
    levelsGained: levelled.levelsGained + awarded.levelsGained,
    newRecords,
    earned: awarded.earned,
  };
}

// Spend a point on the next rank of an upgrade; null if it can't be bought.
export function buyUpgrade(p: Profile, id: UpgradeId): Profile | null {
  if (!canBuy(p, id).ok) return null;
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
    burstCooldown: C.BURST_COOLDOWN - rank(p, 'quickRecovery'),
    motherPuffInterval: C.PUFF_INTERVAL / (rank(p, 'mothersWrath') ? 2 : 1),
    motherPuffRange: C.PUFF_RANGE + (rank(p, 'mothersWrath') ? 1 : 0),
    rotSpeed: C.ROT_PER_SECOND * (1 + 0.5 * rank(p, 'rotFast')),
    beetleNutrients: C.BEETLE_NUTRIENTS + 2 * rank(p, 'feast'),
    mushroomCost: rank(p, 'cheapCaps') ? 10 : C.MUSHROOM_COST,
    startPatch: rank(p, 'deepRoots') ? 2 : 1,
  };
}
