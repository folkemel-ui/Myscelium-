// A small seeded random number generator (mulberry32), so a level and its tests repeat exactly.
// Its state is a single number, which a save keeps so a loaded round carries on exactly as it
// would have.
export interface Rng {
  (): number;
  getState(): number;
  setState(state: number): void;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Object.assign(next, {
    getState: () => a,
    setState: (state: number) => {
      a = state >>> 0;
    },
  });
}
