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

## Later (not in a pack yet)

- Infected beetles and squirrels that join your side and attack.
- Big mushrooms that work as towers; spore clouds that drift on the wind.
- Birds, hedgehogs, badgers, foresters with fire and fungicide, dry weather, a rival fungus.
- Spells with cooldowns: call rain, bloom, a mind spore that turns a forester.
- Fruiting: release spores to a new, harder forest and keep **mutations** (a permanent upgrade tree).
- Different forests: pine woods, swamp, jungle, and a city park at the end.
- Stronger psychedelic effects as you progress: pulsing, rainbow shimmer, ripples, kaleidoscope colour.
