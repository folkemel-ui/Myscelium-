# Wisdom

Things learned while building Mycelium that are worth knowing before the next change. IDEAS.md says
*what* has been built; this file says *how the project works* and *what tripped us up*.

## How we work

- Work comes in **packs** from IDEAS.md. Build all of a pack, then tick it off: the heading gets ✓
  and each item `[x]` plus a short italic note with real numbers.
- One commit per pack, with a message listing what changed.
- Check every feature two ways: `npm test` (Vitest) and by playing it in the browser preview
  (`npm run dev`, port 5173; the preview config is `.claude/launch.json`).
- `npm run typecheck` must be clean; `npm run build` type-checks and builds.
- Explain changes in plain words: what changed for the player, with numbers.

## How the code is laid out

- `src/game/` is the rules: plain TypeScript, no React or Pixi, so it can be tested on its own.
  `world.ts` makes the level and holds the types, `sim.ts` has `step(game, dt)` and the player's
  actions (each returns `null` when it worked, or a reason it didn't), `constants.ts` every number.
- `src/render/GameView.ts` draws with PixiJS and turns clicks into actions. The ground and network
  are redrawn only when `game.version` changes; mushrooms, puffs and beetles every frame.
- `src/ui/App.tsx` is the React panel. It copies a snapshot of the game about 10 times a second;
  React never re-renders every frame.
- In development the game is on `window.game`, for poking at from the console in tests.
- `src/game/playthrough.test.ts` plays level 1 with a script on five maps and prints how long it
  took: the balance check. Rerun it after changing any number in `constants.ts`.

## Lessons

- Pixi's `ColorMatrixFilter.saturate` is grey at −1 and flips colours to their opposites below
  that (green trees turned purple at −1.1). Keep it at −0.85 or above.
- In Pixi 8, `arc()` on a fresh path joins from the last point (or 0,0): `moveTo` the arc's start
  first, or a stray line appears.
- Pointer moves can jump several tiles at once: drag tools must fill in the tiles on the line
  between two moves.
- Enemies need a way to leave. Before beetles got full and walked off, they piled up to 195 on
  one map.
