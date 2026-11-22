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

### Pack 5 – The trip

- [ ] **More than saturation** – Slow hue shifts, a gentle colour wave across the forest and glowing outlines as you spread.
- [ ] **Stages of trippiness** – New effects switch on at 25%, 50% and so on (shimmer, ripples, kaleidoscope edges), each starting with a short visual "wave".
- [ ] **Colourful takeover** – Tiles under the mycelium change colour themselves (glowing moss, neon ground), so your territory looks different from the wild forest.
- [ ] **Floating spores** – Drifting glowing specks over your territory, denser as you spread.

### Pack 6 – Camera and panel

- [ ] **Zoom and pan** – Scroll to zoom in on the fight and drag to move around, with sharper art up close.
- [ ] **Styled panel** – A glowing, organic top panel with icons for spores, nutrients and beetles instead of plain text.

### Pack 7 – Progress between rounds

- [ ] **XP for each round** – When a round ends, won or lost, the player gets XP based on how they did (for example forest held, beetles beaten, time taken, and a bonus for winning).
- [ ] **Round summary** – A message pops up at the end showing the XP gained and the round's stats, with two buttons at the bottom: "Play again" and "Main Menu".
- [ ] **Main menu** – Shows a level picker and the player's profile (level, XP towards the next level, upgrade points).
- [ ] **Levels and upgrade points** – Each level-up gives one point to spend on permanent upgrades that last across the whole game. Saved between visits.

## Later (not in a pack yet)

- Infected beetles and squirrels that join your side and attack.
- Big mushrooms that work as towers; spore clouds that drift on the wind.
- Birds, hedgehogs, badgers, foresters with fire and fungicide, dry weather, a rival fungus.
- Spells with cooldowns: call rain, bloom, a mind spore that turns a forester.
- Fruiting: release spores to a new, harder forest and keep **mutations** (a permanent upgrade tree).
- Different forests: pine woods, swamp, jungle, and a city park at the end.
- Stronger psychedelic effects as you progress: pulsing, rainbow shimmer, ripples, kaleidoscope colour.
