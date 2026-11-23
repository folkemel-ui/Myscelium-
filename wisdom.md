# Wisdom

Things learned while building Mycelium that are worth knowing before the next change. IDEAS.md says
*what* has been built; this file says *how the project works* and *what tripped us up*.

## How we work

- Work comes in **packs** from IDEAS.md. Build all of a pack, then tick it off: the heading gets ✓
  and each item `[x]` plus a short italic note with real numbers.
- One commit per pack, with a message listing what changed.
- Check every feature two ways: `npm test` (Vitest) and by playing it in the browser preview
  (`npm run dev`, port 5173; the preview config is `.claude/launch.json`).
- The game is published at https://folkemel-ui.github.io/Myscelium-/ (repository
  github.com/folkemel-ui/Myscelium-). Pushing `main` publishes it: GitHub runs the tests (not the
  playthrough), builds and deploys (`.github/workflows/deploy.yml`). Commits use the private address
  246357112+folkemel-ui@users.noreply.github.com (set in this repo's git config), never the real
  email. Push only when the user asks.
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
- Forests: `createLevel(level, seed, mods)` in world.ts makes one (1 The Little Wood, 2 Pine Hollow).
  Each round carries its `level`, `biome` (how it looks) and `rules` (when and how beetles come);
  the rules read `g.rules`, never the constants, for those. A level's rules only use extra random
  draws when it needs them, so other levels play exactly the same (the Little Wood's balance
  stayed identical through Pack 11).
- "Level" means two things: the player's level (profile) and a forest (map). In code the map is
  `level`/`forest` on the game, `forestsWon`/`bestTimes` on the profile.
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
- Check a map's goal against its shape: Pine Hollow's first stream left 53–56% of the ground on the
  mother's bank, so the bridges (the whole point) were never needed. A test now guards it.
- Small-screen rules are container queries on `.app` (not media queries), so they follow the game's
  own area: squeezing `#root` in a big window tests them. Media queries follow the window and can't
  be tested that way.
- Touch can be tested in the browser pane by dispatching `PointerEvent`s with `pointerType:
  'touch'` on the canvas (Pixi handles them like real fingers).
- In a hidden pane `requestAnimationFrame` may never run: a script that awaits it times out.
- The profile grows with every pack; `loadProfile` in save.ts must fill every new part for older
  profiles (Pack 13 added name, scheme, records, history, totals and achievements) – the save tests
  check an old profile loads.
- Colour schemes change `GLOW` in place and `PALETTE.mother` (forestLayout.ts); everything reads
  them when it draws, so a scheme must be set before a round's drawing is built.
- A CSS rule for a class name can reach SVG shapes with that class: `.bar { height: 8px }` (the
  panel's progress bar) squashed the chart's bars until they got their own class name.
- Things the player builds (shelves, towers) live in their own lists on the game, and anything
  that removes mycelium must remove what stands on it (`removeMycelium` in sim.ts). New lists
  need a default in `loadRound` so older saves still load.
- Player-level unlocks are checked in the UI only (`unlocked` in progress.ts); the rules let
  anything be built, which keeps the rules' tests simple.
- A bash heredoc holding JS with backticks and `${}` broke in this shell (even quoted `<<'EOF'`);
  write patch scripts to the scratchpad with the Write tool and run them with node.
- The shell starts each command in the Tha City folder: `cd` into Mycelium in every command.
- Clicking the map by computed screen coordinates is unreliable: the browser tool's coordinate
  frame (e.g. 800×500) is not the page's pixels (1280×800), and clicks landed 3 tiles off. Hover
  once and read `view.pointerTile` to calibrate, or call the rules directly.
- In the menu, clicking a forest's row only picks it; the Play button starts the round.
- While the pane is hidden the round's clock doesn't move. Step it by hand from the page:
  `const { step } = await import('/src/game/sim.ts')` and `step(view.game, 0.1)` in a loop. Events
  pile up then (the view isn't drawing), so clear `game.events` before counting them.
- A quiet test round: `g.rules = { ...g.rules, firstBeetleAt: 1e9 }` stops beetles coming.
- To test level-locked things, raise `level` in the saved profile, reload, test, then put the
  backed-up profile back exactly.
- The console keeps errors from earlier hot reloads (half-written files); check the file names
  and stack before chasing one. Reload and read it again.
- `gh` isn't installed. Check a publish with GitHub's public API:
  `curl -s "https://api.github.com/repos/folkemel-ui/Myscelium-/actions/runs?per_page=1"`.
- iPhone Safari won't let a page hide its address bar and tabs, and has no fullscreen for pages.
  Started from the Home Screen the game fills the screen (`display: fullscreen` in the manifest),
  but that copy has its own storage: the profile doesn't carry over by itself.
- Enemies need a way to leave. Before beetles got full and walked off, they piled up to 195 on
  one map.
- The CSS colours `--glow` and `--glow-2` are set from the colour scheme (App.tsx), so panels and
  charts follow it. Glows from them use `color-mix(in srgb, var(--glow) 30%, transparent)`, with a
  plain rgba line just before as a fallback for older browsers.
- Panel icons are small inline SVGs at the end of App.tsx, coloured by CSS classes (`.i-spores`,
  `.i-beetle` …), so a state like `.beetles.danger` can recolour them without new drawings.
- Offline: `src/sw-template.js` becomes `dist/sw.js` at build time (the `offline` plugin in
  vite.config.ts fills in every built file and a version hash). It only runs in the built game
  (`npm run build` then `npx vite preview`, port 4173), never in `npm run dev`. Cache lookups need
  `ignoreVary: true`: servers send `Vary: Origin` and the page's module requests carry an Origin,
  so plain matches missed and the game was blank offline.
- Browsers don't reliably look for a new service worker on reload; main.tsx calls `reg.update()`
  at start and when the game comes back to the front.
- Progress codes (`src/game/transfer.ts`) use `CompressionStream`, so codes need iOS 16.4+. Safari
  only lets a page write to the clipboard during a tap, so the code is made ahead and copied
  straight from the click.
- The iPhone checks (install card, Home Screen welcome) can be tested in Chromium with Playwright's
  iPhone devices; pretend to be the Home Screen app with
  `Object.defineProperty(navigator, 'standalone', { value: true })` in an init script. The notch can
  be pretended by setting `--safe-l`, `--safe-r`, `--safe-b`, `--safe-t` on `:root`.
- Text next to an icon in a flex row: wrap the text in one `<span>`, or each word in `<b>` becomes
  its own flex item with the gap around it.
- Phone layout ("thumbs") is decided in App.tsx: a touch screen and a game area of 900×520 or
  smaller. The tools and round buttons are rendered outside the panel then (`.thumb-bar`), and
  App measures the bars and tells GameView (`sideSpace`) so the forest keeps clear of them.
- A long press is a timer started on a touch's pointerdown in GameView and cancelled by moving,
  lifting or a second finger. It can be tested in Chromium with CDP `Input.dispatchTouchEvent`
  (touchStart, wait, touchEnd); screen positions of tiles come from `view.world.toGlobal`.
- `src/game/info.ts` (`describeTile`) is what the long-press bubble shows: plain words from the
  game, tested in thumbs.test.ts.
- Where a swarm comes in is chosen `SWARM_WARNING` seconds early (`g.nextSwarm`), so the view can
  warn; `incomingSwarm(g)` says where and when. It is saved with the round.
- The playthrough test has a builder player (shelves and towers). Rerun it after changing what
  buildings cost or do; compare the builder with the casual player.
- "In view" on the screen means the canvas less the thumb bars and the panel (`panelBox`, set by
  App): the map is drawn under the panel and bars too, so the camera's viewport is not what is seen.
- The forest past the map's edge (`SURROUND` tiles): mirrored copies of the floor (a repeated copy
  showed a line at the join), still trees cached as a texture (`outerTrees`), and a fade picture.
  Keep them out of the canopy: its colour filter runs over the bounds of what is in it, and with
  the surround inside that became the whole screen.
- Timing in the headless test browser has no graphics card: whole frames take ~300 ms, so only
  compare with and without a change on the same page (hide a layer with `.visible = false`).
- A fresh round's opening zoom is `intro` in GameView; anything the player does to the camera
  must clear it, or the camera fights the player.
- Thread colours come from `colourAt(depth)` in networkLayout.ts (distance along the network from
  the mother), in a few steps: threads are drawn grouped by colour and width, so smooth colours
  would mean many more strokes.
- Thread shapes: `STRAIGHT_COST` in networkLayout.ts. To judge a shape change, measure (the share
  of tiles in straight runs, see networkLayout.test.ts) and look at a full disc of network side by
  side; numbers alone picked a zigzag that looked worse.
- Anything clipped to the map (masks, tints, filters) shows as a rectangle now that the forest
  goes on past the edge (Pack 19): clip to the surround instead, and give the outer trees the
  same colour changes as the canopy.
- Before/after pictures: `git stash`, take the same scene, `git stash pop`. Set `g.time` past a
  few seconds before `view.setGame` in test scenes, or the opening zoom is what gets pictured.

