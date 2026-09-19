# Sprite-to-3D migration: four iterations

Status: iteration 1 generation completed with user approval (150 credits). See [generated assets and review](meshy/iteration-1/README.md). Iteration 1 is integrated into placed models, placement previews and the debug workshop; build and unit checks pass, with a [mobile smoke test and remaining findings](../qa/iteration-1-mobile/verification.md) recorded. Iteration 2 generation is complete (150 credits); see [assets and review findings](meshy/iteration-2/README.md). Iteration 2 is integrated into placed objects, ghosts and the debug sandbox; [QA records mobile stairs and gate checks](../qa/iteration-2/verification.md), with broader verification limits noted. Iterations 3–4 generation is complete (300 credits combined); [iteration 3](meshy/iteration-3/README.md) and [iteration 4](meshy/iteration-4/README.md) include previews and measured outputs. Their game integration remains pending.

## Audit and scope

The planned scope is **40 new base models**: **33 expansion structures, 1 shared boarding enemy, and 6 held expansion tools**. Food, ingredients, fishing catches, coal and all cup states are excluded at the user's request.

Use Meshy T2 smart topology, target approximately 4,000 polygons per complete asset, generate 2K textures, and download GLB, following [generate-3d-models](../../.agents/skills/local/generate-3d-models/SKILL.md). This is a target, not an exact geometry guarantee. Inspect final triangle counts and texture dimensions.

Expansion input images already exist at `images/concepts/expansion/<id>.png`: all 40 planned sources were checked and are 1254 × 1254 RGBA. Use these original images, not the 512px world sprites or 128px HUD derivatives. Preserve the simple chunky forms documented in [prototype-sprites.md](prototype-sprites.md); the workbench is the structure style reference. Inspect each source visually before a future paid submission; file existence does not establish reconstruction quality. Keep all current HUD icons.

## Four iterations

| Iteration | Models | Scope |
|---|---:|---|
| 1 | 10 | Crafting stations and survival |
| 2 | 10 | Construction and lookout |
| 3 | 10 | Combat and held tools |
| 4 | 10 | Navigation, power and raids |
| **Total** | **40** | Expansion models |

### Iteration 1 — Crafting stations and survival

Establish the style with workbench first, then complete stations, survival equipment and ammunition storage.

| Asset ID | Asset | Source image |
|---|---|---|
| `workbench` | Workbench | [PNG](../../images/concepts/expansion/workbench.png) |
| `armoryBench` | Armory | [PNG](../../images/concepts/expansion/armoryBench.png) |
| `engineeringBench` | Engineering bench | [PNG](../../images/concepts/expansion/engineeringBench.png) |
| `smelter` | Smelter | [PNG](../../images/concepts/expansion/smelter.png) |
| `researchTable` | Research table | [PNG](../../images/concepts/expansion/researchTable.png) |
| `rainCollector` | Rain collector | [PNG](../../images/concepts/expansion/rainCollector.png) |
| `cropBed` | Crop bed | [PNG](../../images/concepts/expansion/cropBed.png) |
| `waterTank` | Water tank | [PNG](../../images/concepts/expansion/waterTank.png) |
| `improvedGrill` | Improved grill | [PNG](../../images/concepts/expansion/improvedGrill.png) |
| `ammoCrate` | Ammo crate | [PNG](../../images/concepts/expansion/ammoCrate.png) |

### Iteration 2 — Construction and lookout

Fit the structures to the raft grid. Verify gate rotation, stair walkability, raised decks and tower supports.

| Asset ID | Asset | Source image |
|---|---|---|
| `wall` | Wall | [PNG](../../images/concepts/expansion/wall.png) |
| `gate` | Gate | [PNG](../../images/concepts/expansion/gate.png) |
| `stairs` | Stairs | [PNG](../../images/concepts/expansion/stairs.png) |
| `upperFloor` | Upper floor | [PNG](../../images/concepts/expansion/upperFloor.png) |
| `railing` | Railing | [PNG](../../images/concepts/expansion/railing.png) |
| `armoredFoundation` | Armored foundation | [PNG](../../images/concepts/expansion/armoredFoundation.png) |
| `towerPlatform` | Tower platform | [PNG](../../images/concepts/expansion/towerPlatform.png) |
| `ropeBarricade` | Rope barricade | [PNG](../../images/concepts/expansion/ropeBarricade.png) |
| `spikeStrip` | Spike strip | [PNG](../../images/concepts/expansion/spikeStrip.png) |
| `lookoutPost` | Lookout post | [PNG](../../images/concepts/expansion/lookoutPost.png) |

### Iteration 3 — Combat and held tools

Replace defense weapons and six held expansion tools. Verify weapon direction, held poses, switching and shield blocking.

| Asset ID | Asset | Source image |
|---|---|---|
| `netLauncher` | Net launcher | [PNG](../../images/concepts/expansion/netLauncher.png) |
| `ballista` | Ballista tower | [PNG](../../images/concepts/expansion/ballista.png) |
| `harpoonTower` | Harpoon tower | [PNG](../../images/concepts/expansion/harpoonTower.png) |
| `deckCannon` | Deck cannon | [PNG](../../images/concepts/expansion/deckCannon.png) |
| `repairKit` | Repair kit | [PNG](../../images/concepts/expansion/repairKit.png) |
| `bandage` | Bandage | [PNG](../../images/concepts/expansion/bandage.png) |
| `salvageAxe` | Salvage axe | [PNG](../../images/concepts/expansion/salvageAxe.png) |
| `bow` | Bow | [PNG](../../images/concepts/expansion/bow.png) |
| `boardingShield` | Boarding shield | [PNG](../../images/concepts/expansion/boardingShield.png) |
| `scrapArmor` | Scrap armor | [PNG](../../images/concepts/expansion/scrapArmor.png) |

### Iteration 4 — Navigation, power and raids

Complete navigation and rescue equipment, the raid bell and the shared boarding enemy. Verify power connectivity, rescue interactions and enemy facing/hit targets.

| Asset ID | Asset | Source image |
|---|---|---|
| `sail` | Sail | [PNG](../../images/concepts/expansion/sail.png) |
| `steeringWheel` | Steering wheel | [PNG](../../images/concepts/expansion/steeringWheel.png) |
| `engine` | Engine | [PNG](../../images/concepts/expansion/engine.png) |
| `generator` | Generator | [PNG](../../images/concepts/expansion/generator.png) |
| `batteryBank` | Battery bank | [PNG](../../images/concepts/expansion/batteryBank.png) |
| `powerRelay` | Power relay | [PNG](../../images/concepts/expansion/powerRelay.png) |
| `antennaMast` | Antenna mast | [PNG](../../images/concepts/expansion/antennaMast.png) |
| `rescueRadio` | Rescue radio | [PNG](../../images/concepts/expansion/rescueRadio.png) |
| `alarmBell` | Alarm bell | [PNG](../../images/concepts/expansion/alarmBell.png) |
| `zombie` | Boarding enemy (shared zombie/pirate placeholder) | [PNG](../../images/concepts/expansion/zombie.png) |

## Integration and acceptance per iteration

1. Generate only after the user authorizes the relevant paid batch. Begin iteration 1 with workbench to validate source fidelity, scale and export before generating the rest. Record source, task ID, output path, geometry counts, texture dimensions and acceptance status for each asset.
2. Introduce a shared asset registry keyed by existing item IDs, with GLB path, world dimensions, pivot/orientation and held pose where needed. Store new expansion outputs under `assets/scene/items/expansion/<id>.glb`. These are proposed output locations, not files created by this plan.
3. Replace visual planes incrementally, retaining the sprite fallback for assets not yet accepted. Keep logical roots, item IDs, pointer actions and state intact. Update placement ghosts to use the corresponding model and validity feedback.
4. Preserve save/load and support identification: `src/ui/raftSnapshot.ts` currently calls `getSpriteKind` to recover support types. Move this responsibility to model-independent metadata rather than parsing GLB names. Preserve cleanup when objects or raft tiles are destroyed.
5. Fit colliders to gameplay footprints. Check gate open/closed behavior, stairs and raised decks, tower supports and armored foundations. Current art specifies six stair steps while the prototype collider has eight: reconcile visual steps and walkable collision deliberately. Gate rotation currently moves the whole root, so inspect panel/post pivots before choosing whether a separate moving panel is needed.
6. For iteration 3, check handheld poses, tool switching and shield blocking. For iteration 4, check enemy facing/health/hit targets. The current zombie image also represents boarding pirates; reuse one model initially. A distinct pirate and animated character rig are additional scope.
7. Build and verify each completed iteration in-world on desktop and mobile: placement/rotation, interaction, save/reload, removal, silhouettes from all sides, and repeated-object performance. Measure scene triangle/material/texture costs at representative object counts; 4K polygons and 2K textures per asset do not guarantee scene-wide performance. Retain approval checkpoints before proceeding to another paid batch.

## Existing assets and deliberate exclusions

- Food, ingredients, fishing catches, coal and cup states are outside this plan. No generation or rendering changes are planned for those items.

- Preserve existing raft, boat, shark, chef, hook, hammer, spear, fishing rod, anchor, grill, purifier, storage, floating resource and barrel GLBs.
- Preserve the two existing hero dish GLBs: `spaghetti_shark_pomodoro` and `fettuccine_sea_food`.
- `metalHook` currently reuses the existing hook GLB. A distinct upgraded hook is optional, not a missing sprite replacement.
- Expansion resources currently have no held model requirement: `nails`, `metalPlate`, `gears`, `wire`, `circuitBoard`, `arrows`, `nets`, `bolts`, `harpoons`, `cannonballs`, `transmitterCore`. Do not generate models merely because these have icons. Add separate projectile models only if that becomes requested scope.
- Keep flame effects, fishing warnings, speech bubbles and UI indicators as sprites/UI. These communicate effects or status rather than missing physical-object models.

## Source evidence

- `src/expansion/catalog.ts`: structure/tool/resource classification.
- `src/expansion/sprites.ts`: world planes and physical proxies.
- `src/factories/construction.ts` and `src/factories/spectralConstruction.ts`: placed objects, supports and placement ghosts.
- `src/expansion/runtime.ts`: shared zombie/pirate boarding sprite and gate state.
- `src/ui/items.ts` and `src/ui/inventoryState.ts`: six held expansion sprite tools and model routing.
- `src/factories/heldItem.ts`: held sprite and GLB rendering.

No models or reference artwork were generated during this audit.
