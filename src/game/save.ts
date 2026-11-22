// Saving: a round turned into plain data and back, the profile, and where they are kept.
//
// A saved round keeps the level's seed and remakes the level from it, then puts back everything
// that changed: tiles, the network, logs, mushrooms, beetles, counts, and the random number
// generator's state, so a loaded round carries on exactly as it would have.
import { newProfile, UPGRADES, type Profile, type UpgradeId } from './progress';
import { createLevel1, DEFAULT_MODS, type Beetle, type Game, type Mods, type Mushroom } from './world';

export const SAVE_VERSION = 1;
export const SLOT_COUNT = 3;

export interface SavedRound {
  v: number;
  level: number;
  seed: number;
  rng: number;
  mods: Mods;
  tiles: string; // one digit per tile
  mycelium: string; // one 0/1 per tile
  logs: [number, number][]; // [tile, nutrients left] for each log still rotting
  mushrooms: Mushroom[];
  beetles: Beetle[];
  spores: number;
  nutrients: number;
  time: number;
  nextBeetle: number;
  creep: number;
  kills: number;
  nextId: number;
  history: Game['history'];
  nextSample: number;
  stats: Game['stats'];
}

export function saveRound(g: Game): SavedRound {
  const logs: [number, number][] = [];
  g.logNutrients.forEach((n, i) => {
    if (n > 0) logs.push([i, n]);
  });
  return {
    v: SAVE_VERSION,
    level: 1,
    seed: g.seed,
    rng: g.rng.getState(),
    mods: { ...g.mods },
    tiles: Array.from(g.tiles).join(''),
    mycelium: Array.from(g.mycelium).join(''),
    logs,
    mushrooms: g.mushrooms.map((m) => ({ ...m })),
    beetles: g.beetles.map((b) => ({ ...b })),
    spores: g.spores,
    nutrients: g.nutrients,
    time: g.time,
    nextBeetle: g.nextBeetle,
    creep: g.creep,
    kills: g.kills,
    nextId: g.nextId,
    history: g.history.map((h) => ({ ...h })),
    nextSample: g.nextSample,
    stats: { ...g.stats },
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// A saved round back into a game, or null if the data isn't a round this version can read.
export function loadRound(data: unknown): Game | null {
  const s = data as SavedRound;
  if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION || !isNum(s.seed) || !isNum(s.rng)) return null;
  const mods = { ...DEFAULT_MODS, ...(s.mods ?? {}) };
  if (!Object.values(mods).every(isNum)) return null;
  const g = createLevel1(s.seed, mods);
  const n = g.w * g.h;
  if (typeof s.tiles !== 'string' || s.tiles.length !== n || !/^[0-3]+$/.test(s.tiles)) return null;
  if (typeof s.mycelium !== 'string' || s.mycelium.length !== n || !/^[01]+$/.test(s.mycelium)) return null;
  if (![s.spores, s.nutrients, s.time, s.nextBeetle, s.creep, s.kills, s.nextId, s.nextSample].every(isNum)) return null;
  if (!Array.isArray(s.mushrooms) || !Array.isArray(s.beetles) || !Array.isArray(s.logs) || !Array.isArray(s.history)) return null;

  for (let i = 0; i < n; i++) {
    g.tiles[i] = s.tiles.charCodeAt(i) - 48;
    g.mycelium[i] = s.mycelium.charCodeAt(i) - 48;
  }
  g.logNutrients.fill(0);
  for (const [i, left] of s.logs) if (isNum(i) && isNum(left) && i >= 0 && i < n) g.logNutrients[i] = left;
  g.covered = g.mycelium.reduce((sum, v) => sum + v, 0);
  g.mushrooms = s.mushrooms.filter((m) => isNum(m.x) && isNum(m.y)).map((m) => ({ ...m }));
  g.beetles = s.beetles.filter((b) => isNum(b.x) && isNum(b.y) && isNum(b.hp)).map((b) => ({ ...b }));
  if (!g.mushrooms.some((m) => m.mother)) return null;
  Object.assign(g, {
    spores: s.spores, nutrients: s.nutrients, time: s.time, nextBeetle: s.nextBeetle, creep: s.creep,
    kills: s.kills, nextId: s.nextId, nextSample: s.nextSample,
    history: s.history.filter((h) => isNum(h.t) && isNum(h.held)).map((h) => ({ ...h })),
    stats: { ...g.stats, ...s.stats },
  });
  g.rng.setState(s.rng);
  g.version++;
  return g;
}

// A profile read back from storage: anything missing or broken falls back to a fresh value.
export function loadProfile(data: unknown): Profile {
  const p = data as Partial<Profile>;
  const fresh = newProfile();
  if (!p || typeof p !== 'object') return fresh;
  const whole = (v: unknown, min: number) => (isNum(v) && v >= min ? Math.floor(v) : null);
  const upgrades: Profile['upgrades'] = {};
  for (const u of UPGRADES) {
    const r = whole(p.upgrades?.[u.id as UpgradeId], 0);
    if (r) upgrades[u.id] = Math.min(r, u.max);
  }
  return {
    level: whole(p.level, 1) ?? fresh.level,
    xp: whole(p.xp, 0) ?? fresh.xp,
    points: whole(p.points, 0) ?? fresh.points,
    upgrades,
    rounds: whole(p.rounds, 0) ?? 0,
    wins: whole(p.wins, 0) ?? 0,
    bestTime: isNum(p.bestTime) && p.bestTime > 0 ? p.bestTime : null,
  };
}

// --- Where saves are kept ---

// The browser's storage can be missing or full (private windows, blocked sites): every use is
// guarded, and the game carries on without saving if it can't.
export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

export const browserStore: Store = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // nothing to do
    }
  },
};

export const KEYS = {
  profile: 'mycelium.profile',
  autosave: 'mycelium.autosave',
  slot: (n: number) => `mycelium.slot.${n}`,
};

// A save in a slot: the round, and what the slot shows about it.
export interface SlotSave {
  name: string;
  savedAt: number; // ms since 1970
  held: number;
  time: number;
  picture: string; // a small image of the forest, as a data URL ('' if none)
  round: SavedRound;
}

const readJson = (store: Store, key: string): unknown => {
  const text = store.get(key);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const readProfile = (store: Store) => loadProfile(readJson(store, KEYS.profile));
export const writeProfile = (store: Store, p: Profile) => store.set(KEYS.profile, JSON.stringify(p));

export const readAutosave = (store: Store) => {
  const data = readJson(store, KEYS.autosave) as SavedRound | null;
  return data && loadRound(data) ? data : null;
};
export const writeAutosave = (store: Store, g: Game) => store.set(KEYS.autosave, JSON.stringify(saveRound(g)));
export const clearAutosave = (store: Store) => store.remove(KEYS.autosave);

export function readSlot(store: Store, n: number): SlotSave | null {
  const s = readJson(store, KEYS.slot(n)) as SlotSave | null;
  if (!s || typeof s !== 'object' || typeof s.name !== 'string' || !loadRound(s.round)) return null;
  return s;
}
export const writeSlot = (store: Store, n: number, save: SlotSave) => store.set(KEYS.slot(n), JSON.stringify(save));
export const clearSlot = (store: Store, n: number) => store.remove(KEYS.slot(n));

// --- Backups: everything in one file ---

export interface Backup {
  kind: 'mycelium-backup';
  v: number;
  savedAt: number;
  profile: Profile;
  autosave: SavedRound | null;
  slots: (SlotSave | null)[];
}

export function makeBackup(store: Store): Backup {
  return {
    kind: 'mycelium-backup',
    v: SAVE_VERSION,
    savedAt: Date.now(),
    profile: readProfile(store),
    autosave: readAutosave(store),
    slots: Array.from({ length: SLOT_COUNT }, (_, k) => readSlot(store, k + 1)),
  };
}

// Put a backup in place of what's stored now. Returns a reason if the file isn't a backup.
export function restoreBackup(store: Store, text: string): string | null {
  let data: Backup;
  try {
    data = JSON.parse(text);
  } catch {
    return 'That file is not a Mycelium backup';
  }
  if (!data || data.kind !== 'mycelium-backup') return 'That file is not a Mycelium backup';
  if (data.v !== SAVE_VERSION) return 'That backup is from a different version of the game';
  writeProfile(store, loadProfile(data.profile));
  if (data.autosave && loadRound(data.autosave)) store.set(KEYS.autosave, JSON.stringify(data.autosave));
  else clearAutosave(store);
  for (let k = 0; k < SLOT_COUNT; k++) {
    const s = data.slots?.[k];
    if (s && typeof s.name === 'string' && loadRound(s.round)) writeSlot(store, k + 1, s);
    else clearSlot(store, k + 1);
  }
  return null;
}
