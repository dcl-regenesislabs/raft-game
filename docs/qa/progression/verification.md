# Campaign implementation and verification — 2026-09-16

## Implemented

Six chapters authorize crafting and recipe discovery through the same resolver. Events survive tutorial dismissal, item consumption and structure loss. The initial workbench offers four choices; metalworking introduces the armory, metal tools and components, followed by engineering and research. Basic recipes remain outside specialized worktables.

Campaign configuration lives in `src/progression/config.ts`. New runs preserve their mode: the configured DEBUG_MODE still defaults to sandbox; **System → Debug tools → New clean progression test** starts the seeded normal progression rules with a hook, two potatoes and one raft tile. Chapter fixtures are explicit debug scenarios and mark their telemetry as fixtures.

The balanced salvage sequence supplies all starter materials, sends every third drop down the raft center for hand recovery, shifts toward metal after survival, and increases ordinary salvage bundles after the first raid. Ammo crafts in batches (arrows/bolts 4; harpoons/cannonballs/nets 2). Craft capacity checks cover the entire output before spending. Smelter/improved-grill queues hold five paid batches and retain unclaimed output.

Story raids have authored enemy counts, health and one-time rewards. Supplies remain claimable at the bell when the backpack is full. After three victories, lost cores can be reclaimed only when none is in a backpack, chest, pending reward or installed radio. Ambient sharks defer during introduction, raids, recovery and the finale. Repeat raids retain a recovery window.

The radio requires 120 powered seconds **and** all three finite reinforcement groups defeated. A power interruption retains elapsed transmission. Chapter checkpoints replace raft, production, inventory, equipment, vitals and progression snapshots; a pre-finale checkpoint retains the prepared radio. Retry clears pending tool actions and enemies. New Run is a local restart and does not depend on the excluded auth-server wipe operation.

Metrics include active/menu/production/combat time, milestone times, collected/crafted amounts, tower ammo, damage and retry/death counts. DEBUG stage fixtures and machine time advancement are not valid pacing evidence.

## Automated verification

`npx tsc --noEmit` and `npm run build` pass.

108 checks pass:

| Suite | Checks |
| --- | ---: |
| `node scripts/test-gameplay.cjs` | 30 |
| `node scripts/test-expansion.cjs` | 29 |
| `node scripts/test-progression.cjs` | 9 |
| `node scripts/test-mobile-controls.cjs` | 21 |
| `node scripts/test-ui-review.cjs` | 18 |
| `node scripts/test-scene-config.cjs` | 1 |

These include real expansion-runtime combat advancement through all story raids and final reinforcement groups (mocked ECS/input), no victory from broadcast alone, full-pack reward escrow, core loss/reclaim/installed-core exclusion, capacity-safe ammo batches, queue limits/fuel accounting, immutable checkpoint restore, and existing desktop/mobile input regressions.

`node scripts/report-campaign.cjs` validates all 61 recipe/production dependencies for cycles and later-chapter prerequisites. It generates `economy.json` and `dependencies.dot` (dashed edges are owner stations). Raw totals are representative purchase bills before rewards, exclude extra raft tiles, and include fractional smelting fuel. Coal is an external cooking byproduct; the report does not price the food burned to obtain it. These are economy diagnostics, not measured collection times.

## Motorola verification

Connected Motorola Edge 60 Pro, serial `0089321234`; installed Explorer `1.14.0.1974-7368e6e-staging`; 2712×1220 landscape. Used ADB against the installed app and the local scene preview. Explorer source and APK were not changed.

Touch-tested clean-mode selection, objective expand/collapse, backpack, crafting, and Retry Chapter. Used a temporary scene-local HTTP verification bridge to select stage fixtures, inspect actual running ECS state, invoke proximity-validated machine actions and advance the debug simulation. The bridge, its import/system registration, HTTP process and ADB port 8001 reverse were removed afterward. This distinguishes direct touch checks from instrumented gameplay scenarios.

Verified:

- Clean mode removes sandbox structures/items and retains hook + two potatoes. Backpack fits the safe area; the objective expands without firing the hook.
- First workbench exposes exactly storage, smelter, rain collector and crop bed. Producing a plate changes the chapter and exposes the armory. Specialized recipes remain absent from basic craft.
- Actual CRAFT touch spends the correct materials and creates storage.
- Five smelter loads consume exactly ten metal; a sixth load consumes nothing. Actual component state reports `queued: 5`; output later advances the chapter.
- After crafting extra storage, Retry Chapter restores the checkpoint: wood 20, metal 18, rope 20, no extra storage item, and one plate in the smelter. The consumed/crafted later state was replaced rather than merged.
- Starting the radio consumes its core and begins the final warning/assault. Death + Retry Chapter restores an installed, inactive radio at 0%, with the pre-finale inventory and no `finaleStarted` event.
- In a supplied defense fixture, the radio reached 100% while two attackers remained and **did not win**. Full final-assault completion is covered by automated runtime combat tests; the phone session did not manually complete a whole rescue run.
- Moved the objective to the clear top-center area; notifications now have readable light text, sit below the objective, and avoid the right-side native HUD. Retested this layout on the device.

Screenshots and selected state captures accompany this report. Some checkpoint/unlock screenshots precede the final objective positioning adjustment; `phone-clean-hud.png` and `phone-finale-start.png` show the final HUD placement.

## Remaining balance validation

The 45–60 minute first-run duration is a tuning target, **not yet validated**. No five-new-player pilot or uninterrupted fresh desktop/mobile rescue run was performed in this pass. Fixture scenarios and automated combat establish functionality, not learning time, resource capture efficiency, or two independently viable player-built defense layouts. Use the clean progression test and telemetry for those playtests before calling the balance final.

Auth/cloud synchronization, multiplayer, new 3D models and physical raft travel remain outside this work.
