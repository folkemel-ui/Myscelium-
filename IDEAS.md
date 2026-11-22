# Mycelium – Ideas

A mushroom spreading through a forest. 2D, top-down: you watch the battle and take part in it.
The forest starts dull and grey and gets brighter and more colourful the more of it is yours.

Built with React (menus and panels), PixiJS (the forest and the battle), TypeScript and Vite.
Ideas are grouped into **packs** that are built and checked together; a finished pack gets ✓ and each
item gets `[x]` plus a short note in italics saying what was actually done.

## Packs

### Pack 1 – A bare playable level 1 ✓

- [x] **Spores** – The main currency. Mushrooms make them; spend them to spread. *(The mother mushroom makes 1 a second, each other mushroom 0.6 and each tile of mycelium 0.02. Growing a tile of mycelium by hand costs 3. You start with 12.)*
- [x] **Nutrients** – From rotting logs your mycelium covers, and from creatures you defeat. Spend them to grow mushrooms. *(Each log holds 30 and gives 1.5 a second once covered, then rots away into soil; 3 logs lie near the start and about 14 more around the map. A beaten beetle gives 5. A mushroom costs 15.)*
- [x] **Mycelium** – The network under the forest floor. You can only grow where it reaches. *(Drag to grow it tile by tile next to the network, on soil and logs but not trees or rocks; it also creeps out on its own at 0.4 tiles a second. Drawn as glowing threads in five colours that breathe faster as you spread.)*
- [x] **Level 1** – One small forest with beetles that eat your mycelium; take enough of the floor to win, lose the mother mushroom and you lose. *(A 48×32 forest, new each game. Beetles come in from the edges after 25 seconds, every 12 seconds at first and every 3.5 at the goal, at most 15 at once; each eats 3 tiles (1.5 s each) and then leaves. Mushrooms puff at beetles within 2.2 tiles every 2 s (1 damage, beetles have 3); click a mushroom to burst it (3 damage within 3.5 tiles, 6 s cooldown). Hold 50% of the floor to win. A scripted player wins in 163–198 seconds on five maps.)*
- [x] **Dull to bright** – The colour of the whole forest rises with how much of it you hold. *(One colour filter over the forest goes from nearly grey (saturation −0.85) to vivid (+1.0) as you go from nothing to the 50% goal. The panels stay as they are.)*

### Pack 2 – The forest floor ✓

- [x] **Smooth forest floor** – Soft, blended soil instead of a checkerboard of squares, with scattered leaves, twigs, pebbles and grass tufts. *(Painted once per forest onto a canvas at twice the map's size, so it stays sharp up close and costs nothing per frame (27 ms to build a forest). About 256 soft patches of six soil colours, a fine grain, and per tile on average 0.9 leaves, 0.14 tufts, 0.1 pebbles and 0.08 twigs: about 1,700 things on the 48×32 map.)*
- [x] **Trees as a canopy** – Overlapping crowns of different sizes with soft shadows and a slight sway, instead of flat circles on a grid. *(One crown per tree tile, 0.58–0.9 tiles across and nudged off the grid, in five greens, lit from the top left: a ragged rim of 11 small clumps, 4–6 big clumps and 9 leaf glints. Lower crowns overlap the ones behind. Each sways by under a pixel and turns by up to 2°, out of step with its neighbours. Shade under them is painted on the floor.)*
- [x] **Varied rocks and logs** – Several rock shapes with moss; logs that visibly shrink and crumble as they rot. *(Rocks are irregular outlines of 6–9 sides, shaded light to dark, with a crack, and moss on 70% of them. Logs lie either way and change in 8 steps as they rot: down to 45% of their length, darker bark and cut end, up to 4 moss patches and 7 crumbs around them. A rotted log leaves a dark patch of crumbs.)*
- [x] **Light through the leaves** – Soft patches of sunlight drifting slowly across the floor. *(9 warm patches, 2.5–5.5 tiles across, drift at a few pixels a second, wrap round the map and slowly brighten and fade, added on top at up to 12% strength.)*

### Pack 3 – A living network ✓

- [x] **Organic threads** – Curving, branching threads that wander between tiles and thicken near the mother, instead of a grid of straight lines. *(Every tile of mycelium joins the network by its cheapest way from the mother, with each tile costing a random 1–3.5 to cross, so branches wander and fork instead of running in rows. Threads bend, sit up to 0.2 tiles off the grid, and are 0.9 px at the tips up to 4.5 px near the mother, by how much of the network hangs from them; thick ones have a pale shine. Knots where threads branch, and up to 2 fine hairs per tile reaching into open ground. A piece cut off from the mother gets its own root.)*
- [x] **Growth animation** – New tiles grow in, threads creeping outward over half a second instead of popping in. *(Each new thread creeps out from its parent over 0.5 s, easing in, with a bright tip; hairs sprout as it arrives. A new forest's first patch is simply there.)*
- [x] **Glow and light** – Real additive glow, so the network lights the ground around it, stronger as the forest turns colourful. *(Two wide, faint strokes under every thread are added onto the ground below, plus a halo round the mother. The glow is at 35% strength at the start and 100% at the goal, and breathes faster as you spread.)*
- [x] **Pulses along the network** – Little light pulses travelling out from the mother along the threads, like a heartbeat. *(A bright dot with a coloured halo sets off from the mother to a random tip every 0.35 s at the start and every 0.12 s at the goal, at 4.5 threads a second, up to 40 at once.)*
- [x] **Damage you can see** – Eaten tiles wither and fade instead of vanishing. *(An eaten thread shrivels, wobbles, sags, fades and turns the colour of dead leaves over 0.9 s.)*

### Pack 4 – Mushrooms and beetles ✓

- [x] **Better mushrooms** – Proper caps with gills and highlights, different shapes and sizes, and a grander mother. *(Three cap shapes – a spotted dome, a wide flat cap with a dimple and a ring of dots, a tall striped cone – at sizes 0.85–1.15, seen a little from the side: a shaded stem, gills as a band under the rim, a darker rim and a shine. The mother is a 1.55× spotted dome with a frilly ring on her stem and a pulsing pink aura. They sway gently.)*
- [x] **Sprouting** – A new mushroom pushes up from the ground and wobbles into place. *(Over 0.8 s it rises from nothing to 111% of its height, then wobbles back to 100%, widening as it rises.)*
- [x] **Bursts with character** – The cap squashes and springs back as the cloud shoots out; spores swirl out as many small particles instead of one circle. *(A burst squashes the cap to 62% height, bulging sideways, and springs back over 0.6 s. It throws 70 spores in the five glow colours, a mushroom's own puff 18 pale green ones; they fly out to about the edge of the cloud's reach, swirl, slow and fade within a second, up to 900 at once. A fading ring shows the reach.)*
- [x] **Animated beetles** – Moving legs, chomping jaws while eating, a flash when hit. *(Six legs walk in two alternating tripods as far as the beetle moves, antennae sway, jaws open and close fast while eating. A hit flashes it white for 0.18 s and knocks it back a little; once hurt, cracks show on its shell.)*
- [x] **Defeat effect** – A beaten beetle flips over and fades, leaving nutrient sparkles that fly to the counter. *(It hops and flips onto its back in 0.35 s, legs kicking, then fades over 1.1 s. One gold sparkle per nutrient (5) arcs from it to the Nutrients counter in 0.75 s, outside the colour filter so it is bright even in the grey forest, and the number jumps as each lands.)*

### Pack 5 – Pause, shortcuts and stats ✓

- [x] **Pause** – Space or P pauses and resumes: the forest freezes under a dim "Paused" overlay. It also pauses by itself when you switch to another tab. *(Also a pause/play button in the panel; click the overlay or press Esc to resume. While paused nothing moves – not the game, the trees, the light or the pulses – and clicks on the map do nothing. The help panel pauses too.)*
- [x] **More shortcuts** – R to restart, Esc to close pop-ups, B to burst the nearest ready mushroom to the mouse, and a help panel listing every key (H or ?). *(R restarts straight away once a round is over; during a round it asks you to press R again within 2 seconds. B says so when no mushroom is ready. The help panel (H, ? or the ? button) explains the goal and lists all 10 controls. Keys with Ctrl, Alt or Cmd held are left alone.)*
- [x] **Round timer and stats** – Time played and spores per second in the panel, and a small chart of how you spread over time on the end screen. *(The panel shows the time as m:ss. The end screen shows time, forest held, beetles beaten, mushrooms grown, tiles grown by hand and the most spores a second, and a chart of the share held, noted every 2 seconds (at most 600 points), with the goal as a dashed line; hover to read the time and share. The panel now wraps onto two lines in windows under about 1,000 px, and the forest starts below it.)*
- [x] **Fullscreen button** – One click to fill the screen. *(A button in the panel, or F. If the browser refuses, a message says so. Not checked in the preview pane, which refuses fullscreen.)*

### Pack 6 – Progress between rounds ✓

- [x] **XP for each round** – When a round ends, won or lost, the player gets XP based on how they did (for example forest held, beetles beaten, time taken, and a bonus for winning). *(2 XP per percent of the forest held, 5 per beetle beaten, 100 for a win, and for a win a speed bonus of 1 XP per 3 seconds under 5 minutes. A typical 3-minute win with 6 beetles earns 270 XP; a lost round still earns for what was held and beaten. A round given up with R earns nothing.)*
- [x] **Round summary** – A message pops up at the end showing the XP gained and the round's stats, with two buttons at the bottom: "Play again" and "Main Menu". *(XP line by line with a total, the level bar after it, and a "Level up!" banner when a level was gained, above the stats and spread chart from Pack 5.)*
- [x] **Main menu** – Shows a level picker and the player's profile (level, XP towards the next level, upgrade points). *(The game opens on it, with the forest still behind. Profile: level badge, XP bar, rounds, wins and best time. Forests: The Little Wood to play, and Pine Hollow, The Swamp and City Park shown locked. Enter plays.)*
- [x] **Levels and upgrade points** – Each level-up gives one point to spend on permanent upgrades that last across the whole game. *(Levels need 150, 250, 350… XP, so about one a round at first. Six upgrades, 1 point a rank: Thrifty threads (growing costs 1 spore less, 2 ranks), Rich caps (+20% spores from mushrooms), Mighty bursts (+1 damage and +0.3 tiles reach), Eager growth (creep +25%), Tough threads (beetles eat 25% slower), Head start (+15 spores at the start), 3 ranks each. Not saved yet: a reload starts a new profile until Pack 7.)*

### Pack 7 – Saving ✓

- [x] **Saving the profile** – Level, XP, upgrade points and upgrades are saved in the browser for good, separately from rounds. *(Saved whenever it changes. Anything missing or broken in storage falls back to a fresh value, and upgrade ranks are kept within their limits. If the browser won't store anything (a private window), the game still plays.)*
- [x] **Autosave** – The round in progress is saved every few seconds and when the tab closes, and comes back exactly as it was left. *(Every 5 seconds, when the page is closed, and when you go to the menu with the new menu button mid-round. The menu then offers "Continue your round" with its time and share held; it starts paused. A saved round keeps the level's seed and the random numbers' state, so it carries on exactly as it would have (tested over 30 seconds with beetles). A finished round's autosave is cleared. About 10 KB.)*
- [x] **Save slots** – Three named slots to save to and load from, each with a small picture of the forest, how much was held and the time played. *(S or the save button opens the save dialog: a name (up to 40 letters, suggested from the forest and share held) and the three slots; writing over a slot asks first. The menu lists the slots with a 96×64 picture (2 pixels a tile, the network in its glow colours), share held, time and when saved, with Load and Delete (which asks first).)*
- [x] **Export / import** – Download a save as a file and load it back, as a backup or to move to another computer. *("Back up to a file" in the menu downloads everything – profile, the unfinished round and the three slots – as one file (about 12 KB). "Load a backup" asks before replacing anything, and refuses a file that isn't a Mycelium backup or is from another version.)*

### Pack 8 – The trip ✓

- [x] **More than saturation** – Slow hue shifts, a gentle colour wave across the forest and glowing outlines as you spread. *(Every colour drifts round the colour wheel by up to 28° each way at the goal (none at the start, growing with the square of the spread). A band of colour 7 tiles wide sweeps diagonally across the forest every 9 seconds, a new glow colour each time. Tree crowns get neon outlines in the five glow colours from 15% of the way to the goal, at up to 40% strength.)*
- [x] **Stages of trippiness** – New effects switch on at 25%, 50% and so on (shimmer, ripples, kaleidoscope edges), each starting with a short visual "wave". *(At 25%, 50%, 75% and 100% of the goal: "The forest stirs" (up to 40 twinkles on the territory), "Colours awaken" (rings of colour leave the mother every 2.4 s), "Everything breathes" (kaleidoscope borders drifting round the map edges) and "The forest dreams" (all at full strength). Each fades in over its stage, and arrives with a ring of light rolling out from the mother over 1.6 s, a brief brightening, and a banner naming the stage. A loaded round already past a stage just has it on, without the wave.)*
- [x] **Colourful takeover** – Tiles under the mycelium change colour themselves (glowing moss, neon ground), so your territory looks different from the wild forest. *(The territory is painted one pixel per tile in neon moss tinted by each tile's glow colour, and drawn big with smoothing, so the glow blends softly from tile to tile; it is added onto the ground at 5% strength at the start and 25% at the goal. Repainted only when the network changes.)*
- [x] **Floating spores** – Drifting glowing specks over your territory, denser as you spread. *(From 12 at the start to 180 at the goal, rising slowly off the territory and swaying for 4–7 seconds each, in the glow colours.)* All of the trip together costs about 1.3 ms a frame (median 12.2 ms against 10.9 ms without it at 41% held).

### Pack 9 – Camera and panel

- [ ] **Zoom and pan** – Scroll to zoom in on the fight and drag to move around, with sharper art up close.
- [ ] **Styled panel** – A glowing, organic top panel with icons for spores, nutrients and beetles instead of plain text.

## Later (not in a pack yet)

- Infected beetles and squirrels that join your side and attack.
- Big mushrooms that work as towers; spore clouds that drift on the wind.
- Birds, hedgehogs, badgers, foresters with fire and fungicide, dry weather, a rival fungus.
- Spells with cooldowns: call rain, bloom, a mind spore that turns a forester.
- Fruiting: release spores to a new, harder forest and keep **mutations** (a permanent upgrade tree).
- Different forests: pine woods, swamp, jungle, and a city park at the end.
- Stronger psychedelic effects as you progress: pulsing, rainbow shimmer, ripples, kaleidoscope colour.
