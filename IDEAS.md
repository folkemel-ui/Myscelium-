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

### Pack 9 – A better trip ✓

Under the trip the game looked bad: a rainbow-maze network, bubble-wrap trees, a sickly yellow drift,
oversaturation, a carnival border, rings that look like interface marks and a muddy haze. With the
trip's extra layers switched off the forest looked clean again. Start with a quick side-by-side test
of the new direction (points 1 and 2) before changing everything.

- [x] **"Black light" look** – As the trip deepens the forest darkens towards deep indigo and violet instead of getting brighter, and saturation tops out lower (about +0.45 instead of +1.0), so the colour comes from what glows: threads, mushrooms, specks. *(Floor, logs and trees are tinted towards deep indigo (#2e2466), from 10% of the way to the goal up to 70% of the way at the goal; saturation tops out at +0.45. Approved after a side-by-side test.)*
- [x] **Branch colours** – Each main branch from the mother gets one colour and its side branches keep it with a slight drift: coloured veins spreading out like a living map, instead of confetti (today every tile picks one of five colours at random). Glow only on the thicker threads, so the tips stay fine. *(The branches leaving the mother get different colours in order round her; further out the biggest child keeps its parent's colour and a side branch of 8+ tiles starts the next one. Colours change at under 15% of joins (random colours changed at 4 in 5). The finest tips are 25% paler, and threads under 1.5 px don't glow. Threads also bend more and sit further off the grid, for softer corners.)*
- [x] **Dreamlike trees** – No neon rings round the crowns. Instead the canopy slowly shifts towards teal and violet, with a few glowing spots like bioluminescent fungi. *(The crowns turn up to 75° round the colour wheel, green to teal to violet; a third of them get 2–4 glowing spots in cyan, lilac or pale green that breathe.)*
- [x] **No whole-screen colour drift** – Keep the drift for the glowing things only, so the forest stays grounded while the network shimmers. *(The drift of up to 28° now turns only the threads.)*
- [x] **Soft edges instead of the kaleidoscope border** – Gentle colour drifting in from the corners and edges like a vignette, in place of the hard diamond frame. *(From stage 3, a soft glow reaching 14 tiles in from each corner, slowly changing through the glow colours, at up to 22%.)*
- [x] **Waves of soft light** – A stage wave is a soft glow sweeping over the ground that lights up the threads as it passes, not a thin ring; ripples become a slow pulse along the network (or go). *(A stage wave is a soft glow in the stage's colour spreading out from the mother with only a faint edge, plus a brief brightening. The rings are gone: from stage 2, every 2.4 s a heartbeat sends 5 pulses of light at once from the mother out along the network (8 at stage 4).)*
- [x] **Rich dark territory** – The ground under the network becomes deep, fertile soil with tiny glowing specks, so the network glows against it, instead of a pinkish fog. *(Three deep violet-black soil colours, one pixel per tile and smoothed, laid over the territory at 10% at the start up to 60% at the goal; the twinkles and floating specks glow on it.)*
- [x] **Mushrooms that stand out** – A soft glow in each mushroom's own colour, so they can always be found at a glance. *(A breathing glow 2.8 tiles across (4.4 for the mother), from 20% strength at the start to 65% at the goal; it grows in with a new mushroom.)* All of the trip now costs about 0.8 ms more a frame than before (median 13 ms at 46% held).

### Pack 10 – A real threat, and smoother ✓

- [x] **Stronger beetles** – Beetles are barely a threat now: they eat only 29–50 tiles a round out of about 620, and with nobody playing the mother survived 15 minutes on 4 of 5 maps, the forest stuck at about 10%. Make them come in small swarms, go for mushrooms and the mother more often, and get tougher as the round goes on, so bursting and placing mushrooms matter. *(Beetles come in swarms of 1–4 (bigger with the spread and the time), every 8 s down to 2.5 s (was 12 to 3.5), up to 24 at once (was 15), from 25 s in. 30% go for a mushroom and 12% for the mother (none in the first minute); a mushroom takes 3× as long to eat as a thread, the mother 5×. Each minute new beetles get +1 health and +8% speed (up to +3 / +24%), every 90 s +1 tile of appetite (up to +3); base health 4 (was 3), appetite 4 (was 3). A beaten beetle gives 3 nutrients (was 5), and mushrooms puff every 3 s (was 2). Scripted players on five maps: a sharp one wins in 2:41–3:15 losing 40–133 tiles and 0–2 mushrooms; a casual one (acts every 3 s, one burst at a time) wins in 3:04–3:42 losing 100–188 tiles and 0–5 mushrooms; nobody playing loses in 1:33–1:59 (before: the mother survived 15 minutes on 4 of 5 maps).)*
- [x] **Seeing the danger** – Arrows at the screen edge where beetles are coming in, and a red pulse on the mother (and other mushrooms) while one is being eaten. *(Red arrows just inside the edge where beetles came in, blinking for 2.5 s. A mushroom being eaten gets a pulsing red glow and a red ring filling up as the beetle eats; for the mother the panel also says "The mother is being eaten! Burst her (click or B)". Tougher beetles are drawn a little bigger, and their cracks show against their own health.)*
- [x] **A less murky start** – The opening is so grey that logs, mushrooms and beetles blend in. Make the dullest look a little less dull, keeping the journey to colour. *(The dullest saturation is now −0.6 instead of −0.85.)*
- [x] **No more stutters from specks** – Single slow frames of 60–160 ms showed up in stress tests, likely from spores and floating specks being made and thrown away constantly. Reuse them instead (pooling). *(Twinkles and floating specks now reuse their sprites. In a 900-frame busy test (a tile grown every 4 frames, bursts, 15 beetles) only 2 frames went over 40 ms, the worst 48 ms (was 117); median 10.7 ms.)*
- [x] **A cheaper network redraw** – Redrawing the settled network takes about 7.5 ms on a half-covered map, every 0.6 s while growing: a small regular stutter on slower computers. Make it cheaper or spread it out. *(Measured properly, a full redraw cost about 41 ms, most of it the graphics card rebuilding the shapes (the 7.5 ms above was only the drawing). The settled network is now drawn in 8×8-tile chunks and only chunks where something looks different are redrawn: about 6 ms for a new tile on a half-covered map.)*

### Pack 11 – Level 2: Pine Hollow ✓

Each forest brings one new idea to learn plus a step up in difficulty – not just faster bugs. Needs the
stronger beetles from Pack 10.

- [x] **A stream through the middle** – Mycelium can't grow over water; a few fallen logs lie across it as bridges. Reach and hold the bridges to spread to the other side – and beetles can cut you off there. *(A stream two tiles wide winds from top to bottom a third of the way across, never shifting more than a tile a row so there's no gap; three fallen-log bridges cross it, top, middle and bottom. The mother's bank holds well under half the ground, so the bridges must be crossed to win (tested on five maps, with and without bridges). Drawn as a flowing blue stream with muddy banks and ripples, bridges as one log each, reaching onto both banks.)*
- [x] **A pine forest** – Long rows and clumps of pines instead of round clusters, on a darker, cooler floor of needles, so it looks different at once. (Pines suit the shelf fungus from Pack 14.) *(11 rows of pines and 7 clumps, drawn from above as layered, spiky stars in five dark greens; the floor is darker and cooler, covered in needle clusters and pine cones.)*
- [x] **Fewer, bigger logs** – Acidic needles mean fewer rotting logs, but each holds more nutrients: reaching them is a race. *(8 logs of 60 nutrients, two near the start, against about 17 of 30 in the Little Wood.)*
- [x] **Harder beetles** – They arrive after 15 s instead of 25 s, every 9 s down to 3 s instead of 12 down to 3.5, in pairs; and a new kind, the bark beetle, goes for mushrooms rather than threads. *(Adjusted to Pack 10's stronger beetles: from 15 s (Little Wood 25 s), every 6 s down to 2 s (8 to 2.5), swarms of 2 at least. A quarter are bark beetles: red-brown and smaller, they go for mushrooms, 30% faster with 1 less health.)*
- [x] **A front to hold** – The mother starts near one edge, and beetles come mostly from the far side. *(The mother starts 6 tiles from the left edge; swarms come from the right 60% of the time, top and bottom 18% each, left 4%.)*
- [x] **A bigger map** – 56×36 instead of 48×32, goal 50% as before. *(Scripted players on five maps: sharp wins in 3:09–3:50 beating 46–67 beetles; casual wins in 3:17–3:57 losing 1–7 mushrooms; nobody playing loses in 1:14–1:32.)*
- [x] **Unlocking** – Win The Little Wood once; the menu then shows Pine Hollow open with a line on what's new ("A stream splits the forest. Hold the bridges."). *(The profile keeps which forests are won and a best time per forest, shown on each forest's row; profiles from before count a win as The Little Wood won. The end screen says "New forest open: Pine Hollow!" the first time. Saves remember their forest.)*

### Pack 12 – On the phone ✓

The game is published (https://folkemel-ui.github.io/Myscelium-/) and should play well on an iPhone.

- [x] **Touch that works** – Dragging grows mycelium and tapping bursts a mushroom, without the page scrolling, zooming, selecting text or popping up menus. *(A finger that lifts without moving more than 8 px is a tap (burst, plant); one that moves is a grow drag from where it went down. A second finger cancels what the first was about to do, so a pinch never bursts or grows. The page never scrolls, bounces, double-tap-zooms, selects or shows long-press menus, and Safari's own pinch-zoom of the page is stopped. Tested with touch events: a tap bursts the mother on lifting, a drag grew 8 tiles, a pinch zoomed 2× and grew nothing.)*
- [x] **Zoom and pan** – Pinch to zoom in on the fight and drag with two fingers to look around; on a computer, the mouse wheel zooms and a right-drag moves. (Moved up from the camera pack.) *(From the whole map (1×) to 4×, zooming around the fingers or the pointer; the view never shows past the map's edges. Also + / − / 0 on a keyboard. On a small screen a round starts zoomed in on the mother so tiles are at least 14 px (1.2× on a phone held sideways, 1.8× upright); on a computer it starts with the whole map, as before.)*
- [x] **A compact panel** – On small screens the panel shrinks to fit in a corner, so the forest gets the room. *(Below 900 px wide or 520 high the panel is smaller and fits one row on a phone held sideways (844×390): smaller numbers, no prices or key numbers on the tools, no hint line. Messages and the mother's alarm move to the bottom. Under 520 px wide the time and spores a second hide too. It goes by the game's own area (a container query, iOS 16 and later).)*
- [x] **Touch hints** – On a touch screen, the hint and the help speak of taps and pinches instead of keys, and a phone held upright is told the forest is bigger sideways. *(On a touch screen: "Drag to grow · tap a mushroom to burst it · pinch to zoom", and a help panel of taps, pinches and buttons. Held upright, a small "Turn your phone sideways for a bigger forest" button shows until tapped. The fullscreen button hides where the browser can't do it (iPhone Safari).)*
- [x] **A Home Screen app** – An icon and app settings, so "Add to Home Screen" opens it full screen like an app, clear of the notch. *(An icon – the pink mother mushroom on glowing threads, on deep violet – in 180, 192 and 512 px, drawn by scripts/make-icons.mjs; app settings for iPhone and Android open it full screen with a dark status bar, and the panel and messages keep clear of the notch and the home bar. Not yet tried on a real iPhone.)*

### Pack 13 – A deeper profile

- [ ] **A name and a look** – Name your fungus (for example "The Violet Bloom") and choose a colour scheme for the mother mushroom and your threads; more schemes unlock as you level up.
- [ ] **A mother that grows with you** – Every few levels her cap gets bigger and gains new markings, so your progress shows in every round.
- [ ] **An upgrade tree** – Replace the six separate upgrades with a branching tree in three directions – Growth (spreading), Defence (beetles) and Decay (nutrients and logs). Deeper upgrades need earlier ones and offer bigger choices (for example "Bursts infect instead of kill"), so builds can differ.
- [ ] **Personal records** – Best time, most beetles in one round, fewest tiles grown by hand in a win, highest spores a second and more; a new record is called out on the end screen.
- [ ] **Progress charts** – Charts in the profile of your best time over the rounds and XP per round, to see yourself getting better.
- [ ] **Achievements** – About 30 badges in a grid, some hidden until earned (for example "Win without a single mushroom", "Reach stage 4 in under 3 minutes"), each giving a little XP.

### Pack 14 – New things to build

Each is unlocked by reaching a player level, and the menu shows what the next level brings. They sit in a
small build menu next to the two tools (keys 3 and up), with the price in red when it can't be afforded.

- [ ] **Digest (level 2)** – Turn spores into nutrients, or nutrients into spores, at a poor rate, for when you have plenty of one and need the other.
- [ ] **Shelf fungus (level 3)** – Grows on the side of a tree next to your network and slowly makes nutrients, so trees become useful instead of only walls. Costs nutrients.
- [ ] **Spore tower (level 5)** – A tall mushroom that shoots spores at beetles from far away, every second. Costs nutrients and spores.

### Pack 15 – A styled panel

- [ ] **Styled panel** – A glowing, organic top panel with icons for spores, nutrients and beetles instead of plain text.

## Later (not in a pack yet)

- Infected beetles and squirrels that join your side and attack.
- Big mushrooms that work as towers; spore clouds that drift on the wind.
- Birds, hedgehogs, badgers, foresters with fire and fungicide, dry weather, a rival fungus.
- Spells with cooldowns: call rain, bloom, a mind spore that turns a forester.
- Fruiting: release spores to a new, harder forest and keep **mutations** (a permanent upgrade tree).
- Different forests: pine woods, swamp, jungle, and a city park at the end.
- Stronger psychedelic effects as you progress: pulsing, rainbow shimmer, ripples, kaleidoscope colour.
