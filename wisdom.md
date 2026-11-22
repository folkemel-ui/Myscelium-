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
- `src/render/GameView.ts` draws with PixiJS and turns clicks into actions. The network is drawn by
  `render/NetworkView.ts` (laid out by `render/networkLayout.ts`): settled threads only when
  `game.version` changes, growing and withering threads and pulses every frame on a live layer; the logs only when one reaches its next rot stage; crowns sway,
  light drifts, and mushrooms, puffs and beetles are drawn every frame.
- `render/CreatureView.ts` draws mushrooms, spores, beetles, corpses and sparkles. The game tells it
  what happened through `game.events` (hits, defeats); the view empties the list as it draws, and
  the game keeps only the last 200 if nobody does (tests, the playthrough). The shapes of the
  animations are plain functions in `render/anim.ts`, tested.
- `src/game/progress.ts` holds XP, levels and upgrades. Upgrades reach a round only through its
  `Mods` (`createLevel1(seed, modsFor(profile))`); the rules read `g.mods`, never the upgrade list.
  With no upgrades the Mods equal the constants, so the balance playthrough is unchanged.
- `src/game/save.ts` turns rounds into plain data and back (`saveRound` / `loadRound`), reads and
  writes the profile, autosave, slots and backups through a `Store` (the browser's localStorage,
  every use guarded; tests use a memory store). Keys start with `mycelium.`. A saved round keeps
  the seed and remakes the level, so anything new added to `Game` that changes during a round
  must be added to `SavedRound` too, or it is lost on load: the "carries on exactly" test in
  `save.test.ts` will catch most such slips.
- `render/TripView.ts` draws the trip (black light, dark territory, glowing spots on trees, corner
  glows, waves, specks); GameView applies its tints and colour filters to the forest, crowns and
  threads; its numbers (stages, hue drift, counts, waves) are plain
  functions in `render/trip.ts`, tested. The stages go by the share of the goal, so stage 4 comes
  with the win. Shared small textures (the soft dot, the band, the kaleidoscope tile) are in
  `render/textures.ts`, made once.
- `src/ui/App.tsx` is the React panel. It copies a snapshot of the game about 10 times a second;
  React never re-renders every frame.
- In development the game is on `window.game` and the view on `window.view`. `view.inspect = { x, y, scale }`
  shows tile (x, y) up close (the browser tool's zoom only crops, it doesn't magnify); set it back to
  `null` afterwards.
- The forest floor (soil, leaves, rocks, shade) is painted once per forest in `render/floor.ts` and
  shown as one texture. Where things go comes from `render/forestLayout.ts`, plain numbers that are
  tested; a forest always looks the same for the same level.
- `src/game/playthrough.test.ts` plays level 1 on five maps with three players – sharp (acts every
  second, bursts everything), casual (every 3 s, one burst at a time) and idle (nobody) – and prints
  results, tiles eaten and mushrooms lost: the balance check. Rerun it after changing any number in
  `constants.ts`. Balance for the casual player: the sharp one is close to perfect and hides threats.

## Lessons

- Pixi's `ColorMatrixFilter.saturate` is grey at −1 and flips colours to their opposites below
  that (green trees turned purple at −1.1). Keep it at −0.85 or above.
- In Pixi 8, `arc()` on a fresh path joins from the last point (or 0,0): `moveTo` the arc's start
  first, or a stray line appears.
- Pointer moves can jump several tiles at once: drag tools must fill in the tiles on the line
  between two moves.
- When the browser pane is hidden the page runs as a background tab: frame times read 33 ms and
  React updates lag. Time drawing directly instead: call `view.draw` and `app.renderer.render`, then
  `gl.readPixels` one pixel so the graphics card finishes. Pack 2: 7 ms a frame at 1280×800, about
  3 ms of it the 234 swaying crowns (`cacheAsTexture` saved only 0.4 ms, so it isn't used).
- Pixi Graphics: one `stroke()` per thread is slow. Stroking ~600 threads 3–4 times each took 17 ms;
  grouping threads by colour and width into one path per group (~40 strokes) took 7.5 ms. Draw many
  similar lines as one path.
- Something moving between two layers (growing → settled) must stay on the old one until the new
  one is redrawn with it, or it blinks out in between.
- Spreading the network breadth-first gave straight comb-like rows; a cheapest-path spread with a
  random cost per tile makes it wander and fork.
- Pixi rebuilds a Graphics' geometry on every redraw, and that cost lands in render, not in the
  drawing code: timing `draw()` alone looked cheap while frames took 27 ms. Redrawing ~900 spore
  circles and 15 whole beetles each frame did that. Spores as tinted sprites of one texture, and
  beetles with only their legs redrawn (shell, flash and cracks drawn once and shown or faded)
  brought a heavy fight to a median of 12–14 ms.
- `view.app.ticker.stop()` and then `ticker.update(time)` steps the game and the drawing by hand,
  for testing animations frame by frame while the pane is hidden. Render, wait one animation frame
  and render again before a screenshot, or it may show an older frame.
- The preview pane counts as a hidden tab whenever it isn't shown, so the game pauses itself during
  testing (auto-pause on `visibilitychange`). Resume it first (Space, or a dispatched keydown) before
  measuring anything, and expect it to pause again if the pane is hidden mid-test.
- The preview pane refuses fullscreen ("Permissions check failed"); test fullscreen in a real browser.
- Editing App.tsx hot-reloads it, which can start a new game or leave `window.game` pointing at an
  old one. Reload the page before testing after an edit.
- A general rule like `.card p { color }` beats a single class like `.level-up { color }`; give
  special text inside cards a selector that names the card too (`.card .level-up`).
- Rewriting a file with `cat > file` empties it for a moment; the Vite dev server once read it
  in that moment and kept serving an empty module (blank page, "does not provide an export").
  Re-saving the file fixed it. Write files in one go (the Write tool, or a script).
- Inline `node - <<EOF` scripts with backticks and `$` in them can break the shell's quoting;
  put longer patch scripts in a file in the scratchpad and run that.
- Testing saves in the browser writes to the page's localStorage: note what is there first and
  put it back (or clear the `mycelium.` keys) afterwards, so the player's own progress is kept.
- Additive glow adds up fast: the first territory glow (45% strength in bright moss) washed the
  network out to pastel. Keep big added layers faint (the ground tops out at 25%) and check the
  threads still read on top.
- For a big visual change, show a side-by-side test of the direction first (before/after
  screenshots of the same scene) and build the rest after a yes: Pack 9 did that.
- Test scenes can be shown without starting a round: `view.setGame(createLevel1(seed))`, step it with
  `step()` and `view.draw()`, and hide the menu with a `<style>` rule (`.overlay{display:none!important}`):
  React redraws the menu, so hiding the element itself doesn't stick. Nothing is autosaved that way.
- When clearing test saves, first stop the test round (or set its status to over): reloading a
  page with a round in play autosaves it on the way out. A test round of Pack 8 slipped into the
  saves exactly like that and showed up as "Continue your round" (0:07, 41% held).
- A filter on a layer (the crowns, the threads) costs about 0.4 ms a frame each at 1280×800.
- Graphics geometry is rebuilt at render time, so timing the drawing code alone hides most of the
  cost: the network redraw "7.5 ms" was really about 41 ms with the rebuild. Time draw + render +
  `gl.readPixels` together.
- The browser pane's screenshot can capture only the top-left part of the page (about 1024×640 of
  1280×800 here, likely the 1.25 display scale): things on the right or bottom may be missing from
  a screenshot while drawn fine. Put what you want to see near the middle (`view.inspect`).
- React (in development) starts the app twice; anything handed out from the async view creation
  (like `window.view`) must be the one kept, not the one thrown away.
- Enemies need a way to leave. Before beetles got full and walked off, they piled up to 195 on
  one map.
