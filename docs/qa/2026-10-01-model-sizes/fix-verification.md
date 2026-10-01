# Model scale and grounding fix — 2026-10-01

The earlier audit checked grid fit, which did not establish suitable furniture scale. Four benches and four bulky utility props are now smaller. All 20 integrated expansion models use a common base at platform centre +0.10 m (previously +0.20 m). At the normal raft elevation this is Y=16.25, just below the highest plank vertices at Y≈16.269. This removes the shared air gap and seats feet into the uneven wood. Sprite fallbacks, collision proxies, the stairs ramp and placement ghosts use the same deck offset. Raised structures retain their 2.3 m support rise and grid footprint.

No meshes, textures, inventory, save schema or grid occupancy changed. Existing constructions receive the adjustment when the scene loads. Native dimensions were remeasured with full node transforms and matched the catalog to under 0.000001 m. Exact before/after results are in bounds.json and bounds-after.json.

## Final dimensions

| Model | Scale | World width × height × depth (m) |
|---|---|---|
| ammoCrate | 0.9 | 0.900 × 0.424 × 0.684 |
| armoredFoundation | 1.0 | 2.900 × 0.160 × 2.900 |
| armoryBench | 1.5 | 1.500 × 1.107 × 0.993 |
| cropBed | 1.6 | 1.084 × 0.703 × 1.600 |
| engineeringBench | 1.35 | 1.305 × 1.350 × 0.957 |
| gate | 1.0 | 2.700 × 2.000 × 0.300 |
| improvedGrill | 1.4 | 1.400 × 0.708 × 0.965 |
| lookoutPost | 1.0 | 2.700 × 3.650 × 2.700 |
| railing | 1.0 | 2.700 × 1.000 × 0.300 |
| rainCollector | 1.5 | 1.500 × 1.315 × 1.500 |
| researchTable | 1.5 | 1.500 × 0.855 × 0.955 |
| ropeBarricade | 1.0 | 2.700 × 1.000 × 0.250 |
| smelter | 1.35 | 1.071 × 1.350 × 1.060 |
| spikeStrip | 1.0 | 2.700 × 0.500 × 0.700 |
| stairs | 1.0 | 2.400 × 2.650 × 2.700 |
| towerPlatform | 1.0 | 2.700 × 2.300 × 2.700 |
| upperFloor | 1.0 | 2.700 × 2.300 × 2.700 |
| wall | 1.0 | 2.700 × 2.000 × 0.250 |
| waterTank | 1.4 | 1.105 × 1.211 × 1.400 |
| workbench | 1.5 | 1.500 × 0.873 × 1.151 |

## Verification

- npm run build passed with type checking, using Node 22 required by the pinned SDK and current CI.
- All scripts/test-*.cjs regression suites passed. Expanded model tests cover furniture size budgets, shared visual/collider grounding, cardinal grid fit, ghost matching, gates and entity cleanup.
- Connected Motorola Edge 60 Pro, Explorer 1.14.1 (2114), latest rebuilt local preview: visually inspected the reduced armory bench, workbench, engineering equipment, smelter, water tank, rain collector and structural feet while rotating the view. Screenshots show feet meeting the planks and more clearance around utility equipment.
- Bevy Web on decentraland.org loaded the same rebuilt scene; respawn succeeded and the workbench, water tank, crop bed and surrounding structures rendered correctly. Saved bevy-after.png. This is a visual smoke test, not a fresh full campaign or exhaustive stair traversal.
- npm run check:textures still reports 49 existing textures above its 512 px limit. The GLB files were not edited in this change; texture downscaling is outside this scale/grounding fix.
- Twenty generated static GLBs remain unintegrated and use their existing prototype sprites. This change does not claim to integrate them.

## Production build check

The first deployment attempt stopped before upload because the generated release includes `previousDescriptor`, causing `typeof RELEASE` to infer a required property in the update handler. The handler now uses the existing `Release` type, where predecessor metadata is optional. Reproduced the production preparation locally (release stamp, scene metadata, production flag, build); it passed type checking. Restored development metadata and IS_PRODUCTION=false afterwards. Release lifecycle/handoff regressions also passed.
