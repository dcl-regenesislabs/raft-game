# Iteration 1 — generated assets

All ten Meshy T2 smart-topology generations succeeded. Total cost: **150 credits**, with no regenerations or additional paid steps. Each GLB contains one mesh, one material and an embedded **2048 × 2048 base-color texture**. Separate texture downloads are retained here under `source-textures/` for editing; runtime GLBs are self-contained.

[Model preview sheet](models-preview.jpg)

| Model | Triangles | GLB size (MiB) |
|---|---:|---:|
| [workbench](../../../../assets/scene/items/expansion/workbench.glb) | 4,313 | 1.93 |
| [armoryBench](../../../../assets/scene/items/expansion/armoryBench.glb) | 4,210 | 2.67 |
| [engineeringBench](../../../../assets/scene/items/expansion/engineeringBench.glb) | 4,150 | 2.00 |
| [smelter](../../../../assets/scene/items/expansion/smelter.glb) | 4,271 | 2.12 |
| [researchTable](../../../../assets/scene/items/expansion/researchTable.glb) | 4,254 | 2.39 |
| [rainCollector](../../../../assets/scene/items/expansion/rainCollector.glb) | 4,295 | 2.54 |
| [cropBed](../../../../assets/scene/items/expansion/cropBed.glb) | 4,179 | 2.19 |
| [waterTank](../../../../assets/scene/items/expansion/waterTank.glb) | 3,981 | 1.68 |
| [improvedGrill](../../../../assets/scene/items/expansion/improvedGrill.glb) | 4,150 | 2.61 |
| [ammoCrate](../../../../assets/scene/items/expansion/ammoCrate.glb) | 4,398 | 2.11 |

## Review notes

- Rain collector: visible dark/green streaks on the wooden posts; texture cleanup recommended before acceptance.
- Other assets retain recognizable reference silhouettes in the rendered three-quarter previews. Colors reflect generated textures and preview lighting; the grill reads lighter than its charcoal reference.
- Geometry is triangulated in the delivered GLBs. Reported counts are actual triangles, not pre-export quads.
- Integrated into placed constructions and tinted, non-colliding placement ghosts. Logical roots retain item identity and pointer interactions; destruction cleans up model and collider children.
- Native GLB nodes have identity transforms and no animations or built-in colliders. Per-model uniform scales range from 1.2 to 1.8. Bases sit 0.2m above the raft origin. All model footprints fit inside a 3m tile at arbitrary yaw. Full native bounds, chosen scales, offsets and resulting bounds are in [placement-audit.json](placement-audit.json).
- Debug workshop now includes every iteration-one model, along its existing connected walkway (grid X -2 through 8, Z 2). It stays near scene center (400,16,400), well within the 800m × 800m scene.
- Build/type check, 31 expansion tests and gameplay regression tests passed. New tests cover model grounding, footprint at rotation, preview alignment, disabled ghost collisions, identity and cleanup. In-world visual verification remains pending; Explorer was not connected.
- Start a fresh debug game to see all ten workshop models. Existing saved constructions resolve the new visuals by the same item IDs; missing structures in a saved layout still need to be placed.

## Validation

All ten GLBs imported and rendered successfully in Blender. Embedded images were verified at exactly 2048 × 2048. The repository texture checker passed with `--max-size 2048`. Task IDs, parameters and inspection results are recorded in [manifest.json](manifest.json).
