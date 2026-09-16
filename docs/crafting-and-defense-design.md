# Single-player crafting, stations, and raft defense

Multiplayer is the final development phase. The current implementation is local single-player. Save/auth-server synchronization is outside this change.

## Crafting workplaces

Recipes belong to exactly one workplace. Owning a station does **not** unlock its recipes in the HUD menu. Approach that station and use its contextual action to open its own crafting panel. Moving beyond five meters or losing the station closes the panel and prevents crafting.

| Workplace | Recipes / purpose |
| --- | --- |
| Basic crafting (HUD saw icon) | Rope, wooden hook, hammer, wooden spear, fishing rod, cup, purifier, grill, storage, repair kit, bandage, workbench |
| Workbench | Building parts, upgraded survival equipment, metal hook, salvage axe, nails/gears/wire, ammo storage, and specialized worktables |
| Armory | Bow, arrows, shield, armor, barricades, spikes, all four defense towers, their ammunition, alarm bell |
| Engineering bench | Anchor, lookout, sail, steering, engine, generator, battery bank, power relay |
| Research table | Circuit boards, antenna, rescue radio, replacement transmitter core. Supply three plates and two wire once per table before use. |
| Smelter | Load two scrap metal and add wood through separate contextual controls. Produces one plate in twenty fueled seconds. No instant plate recipe elsewhere. |
| Grill / improved grill | Existing grill recipes remain in the cooking panel. Improved grill batches three potatoes into three portions. |

The shared panel remains **category rail → recipe list → item details**. Categories are computed from the current workplace's recipes. No unrelated, locked, or empty categories are shown. Changing workplace resets selection and pagination. The basic menu has no Building, Defenses, Navigation, or Power & Radio category.

No Can Craft filter. Unaffordable recipes remain visible within the current workplace with material shortages. Craft stays in the fixed bottom-right details footer. Full inventory prevents material spending unless the recipe frees a usable slot.

## Playable catalog

The original ten recipes are joined by 51 expansion items, including two new specialist worktables. Metal plates are manufactured in the smelter rather than through the recipe panel.

- Survival: rain collector, crop bed, water tank, improved grill, repair kit, bandage.
- Tools and gear: metal hook, salvage axe, bow, arrows, boarding shield, scrap armor.
- Building: wall, gate, stairs, upper floor, railing, armored foundation, tower platform.
- Stations: workbench, armory, engineering bench, smelter, research table, ammo crate.
- Defense: rope barricade, spike strip, net launcher, ballista, harpoon tower, deck cannon, alarm bell.
- Components and ammunition: nails, metal plate, gears, wire, circuit board, nets, bolts, harpoons, cannonballs.
- Navigation: lookout post, sail, steering wheel, engine.
- Rescue: generator, battery bank, power relay, antenna mast, rescue radio, transmitter core.

Expansion prototypes use transparent hand-painted image sprites, with matching inventory icons. Full-resolution references live in `images/concepts/expansion` for a future Meshy model pass. Run `python3 scripts/build-expansion-sprites.py` to derive optimized world textures and icons, then `node scripts/build-main-action-icons.cjs`. Invisible primitive colliders preserve gameplay; original pre-existing models remain unchanged. No expansion models are generated.

## Implemented single-player rules

- A crop consumes a potato seed and one fresh-water cup, returns the empty cup, and grows three potatoes in sixty seconds.
- The rain collector produces during the last sixty seconds of each three-minute weather cycle and stores four drinks. This is a logical weather cycle; a rain visual effect is not yet implemented.
- Water tanks hold eight cups. Empty cups can be refilled; fresh cups can be deposited with the secondary action.
- Smelter and improved grill keep uncollected output when the backpack is full. Fuel use stops at completion; fuel exhaustion pauses processing.
- The metal hook has eighty casts. The axe salvages close debris with bonus metal. Bow shots consume arrows. Shield guarding blocks frontal raid damage. Scrap armor absorbs half of raid damage until depleted. Bandages heal over ten seconds and are interrupted by damage.
- Repair kits restore up to fifty structure health and are spent only on a damaged nearby structure.
- Gates open/close. Boarders prefer open connected deck routes, attack unavoidable barriers, and cannot path across missing raft cells.
- Tower platforms support reinforced elevated towers; armored foundations can support a construction. Towers have finite ammo, cooldowns, ranges, and forward firing arcs. Nearby storage resupplies them within six meters.
- Ballista and cannon target raiders/boats; nets slow boarders; harpoons target sea beasts and the existing attacking sharks.
- Ringing an alarm bell explicitly starts the next raid. Waves rotate zombie boats, pirate skiffs, and sea beasts, with at most ten enemies. Pirates fire before boarding. The third cleared raid grants a transmitter core; a costly replacement is craftable at the research table.
- The sail and engine increase incoming salvage, and steering selects wood/metal/plastic. This is a salvage-route implementation: the raft remains stationary. Physical raft travel is not implemented.
- Power autoconnects through generators, batteries, and relays within seven meters. There are no manual connections or rendered cables. Wire is only a crafting ingredient. Other machines do not bridge networks. Batteries charge through relays and cover generator interruptions without draining disconnected batteries.
- Install a core in the radio, place an antenna within twelve meters, and supply power. Start a defensive raid and complete 120 powered seconds to win. Losing power or antenna coverage pauses progress. Chef events remain optional and no longer trigger victory.

## Debug and validation

DEBUG_MODE supplies the original survival ring plus a connected workshop containing all five specialist stations, ammunition storage, and alarm bell. Component stock in storage can fund recipes, while interaction inputs such as smelter scrap/fuel must be in the backpack. The system menu has Start Raid and Advance Machines / Raid 30s controls.

Validation scripts:

- `node scripts/test-gameplay.cjs`
- `node scripts/test-mobile-controls.cjs`
- `node scripts/test-ui-review.cjs`
- `node scripts/test-expansion.cjs`
- `node scripts/test-scene-config.cjs`
- `npm run build`

Runtime unit tests use an in-memory ECS and mocked input/rendering. They exercise the actual gameplay modules but do not replace device testing. The first pass still needs extended balancing and performance playtests; enemy pathfinding is on the main deck, not a general multi-level navigation mesh.

## Later: multiplayer

Only after single-player progression and combat are validated: authoritative inventory transactions, shared placement/health/ammo, enemy simulation, research, victory, persistence, and reconnect handling. No new networking or multiplayer dependency is introduced here.
