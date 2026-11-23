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

### Pack 13 – A deeper profile ✓

- [x] **A name and a look** – Name your fungus (for example "The Violet Bloom") and choose a colour scheme for the mother mushroom and your threads; more schemes unlock as you level up. *(A name of up to 24 letters, edited on the new profile page and shown on the menu. Five colour schemes – Rose, Ocean (level 3), Ember (5), Venom (7), Aurora (9) – each with the mother's colour and five glow colours for the threads, caps, spores and specks; the forest behind the menu redraws in them at once.)*
- [x] **A mother that grows with you** – Every few levels her cap gets bigger and gains new markings, so your progress shows in every round. *(A step every 2 levels, 5 in all, each 6% bigger: a ring of small spots (level 3), a golden rim (5), glowing stripes (7), two babies at her foot (9), a crown of little lights (11). The profile page shows the steps and when the next comes.)*
- [x] **An upgrade tree** – Replace the six separate upgrades with a branching tree in three directions – Growth (spreading), Defence (beetles) and Decay (nutrients and logs). Deeper upgrades need earlier ones and offer bigger choices (for example "Bursts infect instead of kill"), so builds can differ. *(Each branch: a start, two upgrades that need it, and a ★ last one that needs 4 points in the branch. Growth: Thrifty threads, Eager growth, Head start, ★ Deep roots (start with 13 tiles, not 5). Defence: Mighty bursts, Tough threads, Quick recovery (bursts ready 1 s sooner a rank), ★ Mother's wrath (she puffs twice as often, 1 tile further). Decay: Rich caps, Fast rot (+50% a rank), Feast (+2 nutrients a beetle a rank), ★ Cheap caps (mushrooms 10 nutrients). 26 points fill the tree. The six earlier upgrades kept their names and effects, so nothing bought was lost.)*
- [x] **Personal records** – Best time, most beetles in one round, fewest tiles grown by hand in a win, highest spores a second and more; a new record is called out on the end screen. *(Fastest win per forest, most beetles, most spores a second and most mushrooms in a round, fewest tiles by hand in a win; "New record!" on the end screen only when an earlier record was beaten. Lifetime totals too: beetles, tiles, mushrooms, time.)*
- [x] **Progress charts** – Charts in the profile of your best time over the rounds and XP per round, to see yourself getting better. *(The profile keeps the last 50 rounds: a bar chart of XP each round (won rounds bright, lost dim) and a line of the best time so far in each forest; hover for the numbers.)*
- [x] **Achievements** – About 30 badges in a grid, some hidden until earned (for example "Win without a single mushroom", "Reach stage 4 in under 3 minutes"), each giving a little XP. *(30 achievements worth 10–60 XP, 6 hidden as "???" until found; earned at the end of a round (shown with their XP) or straight away for an upgrade, a name or new colours. An achievement's XP can bring a level that earns another.)*

### Pack 14 – New things to build ✓

Each is unlocked by reaching a player level, and the menu shows what the next level brings. They sit in a
small build menu next to the two tools (keys 3 and up), with the price in red when it can't be afforded.

- [x] **Digest (level 2)** – Turn spores into nutrients, or nutrients into spores, at a poor rate, for when you have plenty of one and need the other. *(Two buttons, keys 5 and 6: 10 spores → 3 nutrients, 5 nutrients → 8 spores. Swapping there and back always loses spores. The menu shows what the next level opens; locked tools sit dimmed in the bar with their level, and are hidden on small screens.)*
- [x] **Shelf fungus (level 3)** – Grows on the side of a tree next to your network and slowly makes nutrients, so trees become useful instead of only walls. Costs nutrients. *(Key 3, 20 nutrients, on a tree touching your mycelium: 0.3 nutrients a second (pays for itself in about a minute). It only feeds while the network still touches its tree; if beetles cut it off, it turns grey and waits until you grow back. Drawn as three amber brackets on the side of the tree that faces the network, breathing while it feeds.)*
- [x] **Spore tower (level 5)** – A tall mushroom that shoots spores at beetles from far away, every second. Costs nutrients and spores. *(Key 4, 30 nutrients and 40 spores, on your mycelium: 1 damage a second to the nearest beetle within 6 tiles. A tall pale stalk with a glowing spore sac that swells as it fires a bolt. Beetles take as long to eat it as a mushroom, and those that hunt mushrooms hunt towers too; eaten, it is gone. Saves keep shelves and towers.)*

### Pack 15 – A styled panel ✓

- [x] **Styled panel** – A glowing, organic top panel with icons for spores, nutrients and beetles instead of plain text. *(A dark violet pod with uneven, grown-looking corners, faint wandering threads as its texture, and a border that slowly breathes between the scheme's two glow colours. Each counter has its own icon in a small round pod: a clock, a cluster of glowing spores (gently pulsing), a gold nutrient drop (the number in gold too), the mother's pink cap for the forest held, and a beetle. The goal bar is a glowing thread with a bright, pulsing tip, and the held share is shown big ("Forest held **31%** of 50%"). While a beetle is eating a mushroom or tower, the beetle pod glows red and blinks. Tools and round buttons got softer, uneven corners. Everything follows the chosen colour scheme (Ocean turns it cyan). On small screens the icons replace the labels, so the panel still fits one row on a phone held sideways (844×390).)*

### Pack 16 – Full screen on the phone ✓

In Safari the address bar and tabs always show, and Safari won't let a page hide them; started from the
Home Screen the game fills the whole screen. These make that easy and safe.

- [x] **Install prompt** – Opened in Safari on an iPhone, the game shows a small card once: "Add to Home Screen for full screen", with the three steps (Share → Add to Home Screen → Add) and a "Don't show again" button. *(A "Play full screen" card at the top of the menu on an iPhone or iPad that isn't already running from the Home Screen: the three steps, each with a small picture of Safari's button, and for a player with rounds played a "Copy progress code" button to take progress along. "Not now" hides it until the next visit; "Don't show again" for good. Never shown on a computer or in the Home Screen app.)*
- [x] **Bring your progress along** – The Home Screen copy keeps its own storage and starts on an empty profile. Offer "Load a backup" there, or better, a short code to copy in Safari and paste into the app version. *(A progress code: the whole backup – profile, unfinished round, saved rounds, without the slot pictures – compressed into one line starting "MYC1.". About 400 characters for a fresh player and 2,200 after 30 rounds with saves: too long to type, fine to copy and paste. "Copy progress code" puts it on the clipboard in one tap (or shows it to select if copying is refused). The Home Screen app on a fresh profile opens with "Coming from Safari?" and a box to paste it in, or "Start fresh". The menu also has "Move progress with a code" for any two browsers; there it asks before replacing anything. Spaces and line breaks from pasting are ignored; a wrong or cut-off code is refused and nothing changes. Needs iOS 16.4 or later.)*
- [x] **Notch and rounded corners** – In full screen held sideways, keep the panel, buttons and messages clear of the notch and the home bar on both sides. *(The panel's width, the menu, the pause, help and end screens, the hint line and the messages now keep clear of the notch on the left and right as well as the top and bottom. Checked with the notch sizes set by hand (47 px each side, 21 px at the bottom): the panel stays between 57 and 693 px on a 750 px screen. Not yet tried on a real iPhone.)*
- [x] **Works offline** – Keep the game stored on the phone so it loads with no signal and the Home Screen app starts faster. *(The published game keeps all its 16 files on the device (a service worker, written by the build with the list of files) and loads from there first: tested by reloading with the network off and starting a round. A new version is fetched in the background when the game opens or comes back to the front, and used from the next start; the old copy is then thrown away.)*

### Pack 17 – Made for thumbs ✓

- [x] **Bigger buttons on phones** – Tools and icons at least 44 px to touch (Apple's guideline), instead of about 30 px now. *(On any touch screen the round buttons are 44 px; on a phone the tools are 48 px and Burst all 60 px.)*
- [x] **Tool bar within reach** – On a phone the tools move to a strip along the bottom or a side, where thumbs reach; the top keeps only the numbers. *(Held sideways the tools stand in a column at the right edge, filled from the bottom up – Burst all in the corner, then Grow, Mushroom and the rest – wrapping into a second column when there are many; pause, save, menu, help and fullscreen stand in a column at the left. Held upright the tools are a row along the bottom. The forest keeps clear of both columns, and the turn-sideways hint and messages move above the row. Locked tools are left out on a phone.)*
- [x] **Tool icons** – Small pictures for grow, mushroom, shelf, tower and digest, with the price as a tiny number, so the bar fits in one row and reads at a glance. *(Branching threads, a pink cap, amber brackets on a trunk, a tower with a glowing sac, spores into a gold drop and back, and a burst of spores, in the colour scheme's glow. On a phone each shows its price as a small number (3, 15, 20, 30+40, 10→3, 5→8). On a computer the pictures sit beside the names; in a small window the names hide, so the panel stays one row at 860 px wide.)*
- [x] **Long-press for info** – Hold a finger on a tile, mushroom, tower or beetle to see what it is, its health and its cooldown (phones have no hover). *(Hold still for 0.45 s and a bubble says what is there, kept up to date while open. A beetle shows its health, what it goes for and how much more it will eat. A mushroom shows its spores a second and when its burst is ready; a tower its range; a shelf whether it is cut off; a log the nutrients left. Anything being eaten gets a red line with how far along. The press does nothing else: no burst, no growing. Touching the map, tapping the bubble or 6 seconds close it.)*
- [x] **Burst-all button** – One button bursts every ready mushroom near beetles, since tapping small mushrooms mid-fight is hard. *(Bursts each ready mushroom with a living beetle within its burst reach, one after another, so a beetle beaten by the first doesn't use up the next. It glows with a yellow count of how many would burst. Also on the computer: a button and the A key.)*
- [x] **Text size** – The panel's small text (10–11 px now) a bit bigger and bolder on a phone held sideways. *(With the tools gone from the top the numbers are 18 px bold (were 15), the share held 15 px, and spores a second and beetles beaten are back at 11 px bold.)*

### Pack 18 – Clearer, fairer fights ✓

Beetles are the threat, but they are hard to see, can come from where you aren't looking, and a burst's
reach is a guess. Small changes that make every fight fairer.

- [x] **Beetles you can always see** – They are small and dark blue, and on the dark territory they nearly vanish. Give them a light rim, a small shadow or a faint warm glow so they stand out on any ground. *(All three: a pale rim round the shell, a soft shadow under it and a faint warm glow round it, so a beetle reads on the grey floor and on the dark territory alike.)*
- [x] **Warnings for beetles out of view** – The arrows show for only 2.5 s, and zoomed in on a phone you don't see swarms coming at all. Markers at the screen's edge for beetles outside the view, and a short warning a few seconds before a swarm arrives. *(Where each swarm comes in is now chosen 3 s early, and that spot on the map's edge glows orange, faster and brighter as it nears, with arrows rolling inwards. Beetles you can't see – off the screen, behind the thumb bars or under the panel – get a red arrow at the edge of the view pointing at them (bigger where several are together); an orange one for a swarm about to come in out of view. Saves keep the coming swarm. Choosing the side early changed the dice but not the balance: sharp players win in 2:54–3:18 (was 2:41–3:15).)*
- [x] **A burst's reach you can see** – Show the reach ring when hovering over or holding a mushroom, and a subtle mark on mushrooms that are ready to burst. *(Hovering a mushroom with the mouse, or holding a finger on it, shows its reach as a soft circle, with a gold ring on every beetle inside it (dimmer while it is still cooling down). The cooldown ring round a mushroom now stays as a faint, breathing full ring once it is ready.)*
- [x] **No stray ring** – From 33% held a huge faint circle arcs across the whole forest (the stage wave or the vignette); it looks like a mistake. Soften it or take it out. *(It was the outline of a new stage's wave, for about 1.5 s. The outline is gone; the soft glow spreading from the mother stays.)*
- [x] **Towers and shelves balance-tested** – The scripted playthroughs never build them, so nobody knows if they are too strong or too weak. Add them to the playthrough test and tune them. *(A fourth scripted player, the builder, plays like the casual one and also grows 4 shelves and up to 4 towers. They were too weak: the builder won 8 s slower on average, mostly because shelves repaid their price only after 67 s and towers were rarely affordable. Shelves now make 0.45 nutrients a second (was 0.3; pays back in 44 s) and towers cost 25 nutrients and 30 spores (was 30 and 40). The builder now builds 4 towers on most maps and loses fewer mushrooms, but is still about 5 s slower: building defends, and the casual player already copes with the beetles, so defence can't speed up a win. Making building worth it needs stronger threats (Pack 26), not cheaper buildings.)*

### Pack 19 – A forest that fills the screen ✓

The first look at a round: a dull, small scene in a rectangle with black at the sides and a tall panel
on top.

- [x] **A livelier opening** – At the start the forest is flat grey-brown and the mother a small dot in a lot of nothing. Make her stand out more (a soft pulse, and a gentle zoom towards her for the first seconds). *(A new round opens 2.2× closer on the mother, holds for 0.4 s and eases out to the usual view over 2.2 s; touching the map, the wheel or a zoom key stops it at once. For the first 5 seconds soft rings of her colour roll out from her. A loaded round starts as before.)*
- [x] **No black bars** – On a wide screen the map has dead black at both sides. Fill them with more, unplayable forest (dimmer trees and ferns fading into the dark). *(The forest carries on for 16 tiles all round the map: the floor as its own mirror image (so the join can't be seen), and clumps of trees with clearings between them – pines in Pine Hollow – thinning out and fading into the dark over 11 tiles. The trees out there stand still and are drawn once into a texture. Filling the screen costs about a third more drawing time in the test browser, which has no graphics card; on a real one it should be well under a millisecond, still to be checked on a phone.)*
- [x] **A soft edge** – The forest stops at a ruler-straight line. A ragged edge of trees and undergrowth, or a soft vignette, hides it. *(Both: trees right outside the edge lean over it a little, and the fade starts at nothing on the edge itself, so there is no line.)*
- [x] **A slimmer panel on a computer** – It takes about 180 px over three rows, which makes the map smaller. Put the tools and round buttons in one row, or at the side as on the phone. *(The tools stand in a column at the left, in a pod like the panel's; the panel is one row of numbers and round buttons, about 70 px tall. At 1280×800 the map is about 15% bigger. In a small window (900 px wide or less) the tools stay in the panel as pictures.)*
- [x] **The hint line off the map** – "Drag to grow mycelium…" sits on top of the forest's bottom edge. Move it below the map, or fade it out after the first few rounds. *(It shows only in a player's first 3 rounds, and fades out 15 seconds into each.)*

### Pack 20 – A calmer trip

Late in a round the network looks like a busy circuit board. Keep the magic, lose the noise.

- [ ] **Colour by distance from the mother** – At 47% held the network is yellow, pink, cyan, lime and purple branches all glowing at full strength. Let the colour shift with distance from the mother instead, so it reads as one living thing spreading outwards.
- [ ] **Wandering threads** – In places the threads run in long straight parallel lines, and the grid shows through. More wander and fewer parallel runs.
- [ ] **Mushroom glows that don't pile up** – Where mushrooms stand close their coloured halos merge into big blotches. Smaller halos, or a limit on how bright overlapping halos get.
- [ ] **Clean corners** – The corner glow late in a round is a yellow-green haze that makes the edges look dirty. Fainter, and in the scheme's own colours.

### Pack 21 – A menu that feels like the game

The menu looks like a generic web dashboard: a grid of identical boxed cards in a system font, with
pink-to-purple gradient buttons. Make it look grown, like the in-game panel. Start with a side-by-side
test of the new direction (as in Pack 9) before changing everything.

- [ ] **The forest as the background** – No big dark box over everything: the living forest fills the screen, slowly zoomed on the mother with the network pulsing, and the menu's parts float over it.
- [ ] **One focus, not a grid of cards** – Profile, Forests and Saved rounds are three boxes of equal weight. Make playing the clear focus and everything else secondary.
- [ ] **The panel's organic style** – Use the in-game panel's uneven, grown-looking corners, faint thread texture and breathing glow, so the menu and the round match.
- [ ] **Fewer borders** – Almost everything has a 1 px border inside another bordered box (three or four deep in the upgrades). Separate things with space, light and texture instead.
- [ ] **No pink-to-purple gradient** – The Play buttons and level circle use the most "AI app" colour pair there is. Use the scheme's own glow on a dark, textured button, like a glowing spore pod.
- [ ] **A real title** – "Mycelium" as a drawn wordmark (letters that sprout threads, a small cap over the i, or rounded hand-drawn letters) glowing in the scheme's colours, instead of a system font with a lime gradient.
- [ ] **A font with character** – One rounded or slightly organic display font for headings; the system font stays for small text.
- [ ] **One big Play button** – Pick a forest, then one large, glowing button plays it, instead of a Play button on every row (and Continue as yet another).
- [ ] **The mother on the profile** – Show your own mother mushroom with the markings she has earned, in your colour scheme, with your name under her, instead of a gradient circle saying "Level 6". The XP bar as a thread growing towards her next marking.
- [ ] **No empty space in the profile** – Tighten it, or fill it with your last round or a picture of what the next level opens.
- [ ] **Backup and code tucked away** – "Back up to a file", "Load a backup" and "Move progress with a code" move to a small settings screen behind a gear.
- [ ] **Gentle motion** – Spores drifting past, the Play button breathing, the title's glow slowly shifting.
- [ ] **Into the forest** – Pressing Play zooms into the forest as the menu dissolves, instead of the menu just vanishing.

### Pack 22 – Forests, upgrades and the menu on the phone

The second half of the new menu: the parts that need drawing.

- [ ] **Forests as a path** – Each forest as a small painted picture of its map (the stream in Pine Hollow, the pines), joined to the next by a glowing thread; locked forests as dim silhouettes instead of a dashed "Locked" box plus "Coming later".
- [ ] **Upgrades as a drawn tree** – Nodes on a branching mycelium tree, three branches growing from a centre, lit up when bought; tapping a node shows what it does. On its own screen behind an "Upgrades (2 points)" button that glows when there are points to spend.
- [ ] **Ranks as glowing spores** – An upgrade's ranks as small glowing spores along its branch, instead of dots in the corner.
- [ ] **A phone layout** – On a phone, not a squeezed desktop: the mother and Play on the first screen, with forests, upgrades and saves as tabs or pages to swipe.

### Pack 23 – Infected beetles

- [ ] **Infection (an upgrade in the profile's tree)** – Once bought, a beetle beaten by a burst isn't just beaten: the spores take it over and it fights for you for a while (walks to the nearest wild beetle and bites it, never eats mycelium), then collapses and feeds the network. Only a few at once, so bursting stays the main defence. Fits the Defence branch, for example as a deeper upgrade that needs Mighty bursts; more ranks could mean longer-lasting or more allies.
- [ ] **A fungal look** – Infected beetles look taken over: a shell tinted in your glow colours, glowing spots, little stalks sprouting from the back. They get back up from the defeat flip, and when their time is up they sink into the ground and leave a tiny mushroom that fades.
- [ ] **Counting them** – The panel shows your allies, the end screen counts beetles infected, and an achievement for infecting many in one round.
- [ ] **Infected squirrels** – Later: a bigger ally that joins your side and attacks.

### Pack 24 – Spells

- [ ] **Spells with cooldowns** – Call rain (faster creep for a while), bloom (every mushroom makes double spores briefly), and a mind spore that turns an enemy. Opened by player level like the build tools.

### Pack 25 – Level 3: The Swamp

- [ ] **The Swamp** – A third forest with its own new idea, as the stream was for Pine Hollow: water that rises and falls, drowning mycelium in the low ground until it drops, and floating logs as moving bridges. Plus a step up in difficulty.

### Pack 26 – New enemies

- [ ] **More than beetles** – Birds that carry off a mushroom unless a tower is near, hedgehogs and badgers that dig up threads, foresters with fire and fungicide, and dry weather that slows growth. Each brought in by a forest or a stage of a round, so they arrive one at a time.

### Pack 27 – Big mushrooms and drifting spores

- [ ] **Big mushrooms** – Large mushrooms that work as towers.
- [ ] **Spore clouds on the wind** – Spores that drift across the map, so a burst upwind reaches further.

### Pack 28 – A rival fungus

- [ ] **A rival fungus** – Another fungus spreads in another colour from across the map; where the two networks meet, they fight.

### Pack 29 – Fruiting

- [ ] **Fruiting** – Release spores to a new, harder forest and keep **mutations** (a permanent upgrade tree on top of the one there is).

### Pack 30 – More forests

- [ ] **Different forests** – A jungle, and a city park at the end (paths and lawns where nothing grows, gardeners who rake up threads).

### Pack 31 – A deeper trip

- [ ] **Stronger effects as you progress** – Pulsing, rainbow shimmer, ripples, kaleidoscope colour. Check against the calmer direction of Pack 9 and Pack 20 first: these must not bring back the noise.

## Later (not in a pack yet)

New ideas go here until they get a pack.
