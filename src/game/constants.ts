// All the numbers that tune level 1, in one place.

export const MAP_W = 48;
export const MAP_H = 32;

export const START_SPORES = 12;

// Spores per second.
export const MOTHER_SPORES = 1;
export const MUSHROOM_SPORES = 0.6;
export const MYCELIUM_SPORES = 0.02; // per tile of mycelium

// Costs.
export const GROW_COST = 3; // spores per mycelium tile you grow by hand
export const MUSHROOM_COST = 15; // nutrients

// The mycelium also creeps out on its own, slowly.
export const CREEP_PER_SECOND = 0.4;

// Rotting logs: nutrients held by each, and how fast covered logs give them up.
export const LOG_NUTRIENTS = 30;
export const ROT_PER_SECOND = 1.5;

// Beetles.
export const FIRST_BEETLE_AT = 25; // seconds
export const BEETLE_INTERVAL_START = 12;
export const BEETLE_INTERVAL_MIN = 3.5;
export const BEETLE_SPEED = 1.1; // tiles per second
export const BEETLE_HP = 3;
export const BEETLE_EAT_TIME = 1.5; // seconds to eat one tile of mycelium
export const BEETLE_NUTRIENTS = 5; // dropped when a beetle is defeated
export const BEETLE_APPETITE = 3; // tiles a beetle eats before it is full and leaves
export const MAX_BEETLES = 15; // on the map at once

// Mushrooms puff spores at beetles that come close.
export const PUFF_RANGE = 2.2; // tiles
export const PUFF_DAMAGE = 1;
export const PUFF_INTERVAL = 2;

// Clicking a mushroom bursts it: a big spore cloud with a cooldown.
export const BURST_RANGE = 3.5;
export const BURST_DAMAGE = 3;
export const BURST_COOLDOWN = 6;

// Hold this share of the forest floor to win.
export const WIN_COVERAGE = 0.5;
