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
export const BEETLE_INTERVAL_START = 8;
export const BEETLE_INTERVAL_MIN = 2.5;
export const BEETLE_SPEED = 1.1; // tiles per second
export const BEETLE_HP = 4;
export const BEETLE_EAT_TIME = 1.5; // seconds to eat one tile of mycelium
export const BEETLE_NUTRIENTS = 3; // dropped when a beetle is defeated
export const BEETLE_APPETITE = 4; // tiles a beetle eats before it is full and leaves
export const MAX_BEETLES = 24; // on the map at once

// Beetles get to be a real threat: they come in small swarms, some go for mushrooms or the mother,
// and they grow tougher as the round goes on.
export const SWARM_MAX = 4; // beetles arriving together, at most
export const AIM_MUSHROOM = 0.3; // share of beetles that go for a mushroom...
export const AIM_MOTHER = 0.12; // ...and that head straight for the mother
export const AIM_MOTHER_FROM = 60; // seconds into a round before any beetle goes for the mother
export const MUSHROOM_EAT_FACTOR = 3; // a mushroom's tile takes this many times as long to eat...
export const MOTHER_EAT_FACTOR = 5; // ...and the mother's, giving the player time to answer
export const TOUGHER_EVERY = 60; // seconds; each one adds to a new beetle's health and speed
export const TOUGHER_HP = 1;
export const TOUGHER_SPEED = 0.08;
export const TOUGHER_MAX = 3; // steps at most (+3 health, +24% speed)
export const HUNGRIER_EVERY = 90; // seconds; each one adds a tile to what a new beetle eats
export const HUNGRIER_MAX = 3;
export const BARK_SPEED = 1.3; // bark beetles are this much faster...
export const BARK_HP = -1; // ...and have this much less health (2 at least)

// Mushrooms puff spores at beetles that come close.
export const PUFF_RANGE = 2.2; // tiles
export const PUFF_DAMAGE = 1;
export const PUFF_INTERVAL = 3;

// Clicking a mushroom bursts it: a big spore cloud with a cooldown.
export const BURST_RANGE = 3.5;
export const BURST_DAMAGE = 3;
export const BURST_COOLDOWN = 6;

// Pine Hollow (level 2): a bigger forest split by a stream, with fewer but richer logs.
export const PINE_W = 56;
export const PINE_H = 36;
export const PINE_LOGS = 8;
export const PINE_LOG_NUTRIENTS = 60;
export const PINE_BRIDGES = 3;

// Hold this share of the forest floor to win.
export const WIN_COVERAGE = 0.5;

// How often the share of the forest held is noted down, for the chart at the end of a round.
export const HISTORY_EVERY = 2; // seconds
export const HISTORY_MAX = 600; // samples; past this, every other one is dropped
