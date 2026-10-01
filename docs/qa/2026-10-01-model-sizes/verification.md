# Meshy model size audit

Audited the current `fix/desktop-hud-edge-spacing` worktree, without changing model assets or gameplay scales. There are 40 static Meshy expansion models plus one animated zombie variant.

## Findings

- 20 models are integrated through `src/expansion/models.ts`; all measured native bounds match the stored configuration within 0.000001 m. Their final footprints fit the 3 m grid at the supported 90-degree rotation steps. Foundation clearance is the tightest: 0.05 m per side.
- The remaining 20 static models are not registered in the runtime model map. The scene uses prototype sprites for their corresponding gameplay items; generated GLBs have a longest dimension around 1 m and no runtime size calibration. A one-metre sail, one-metre bandage, and one-metre cannon are not a coherent final size set. These assets need individual integration, rather than reusing sprite sizes as GLB scale factors.
- The animated zombie is also unused. Its skinned/animated dimensions must be evaluated with bone transforms, not the tiny unskinned mesh-node bounds. Existing Blender pose evidence reports roughly 1.83 m idle height and 1.65 m walk height; this audit did not reevaluate animation poses.
- Grounding needs a separate adjustment: current expansion bases are Y=16.35, versus collider top Y=16.30 and the highest raft visual vertex Y≈16.269. Thus these models sit about 5 cm above the walk surface and at least 8 cm above the visible raft. This is a shared placement-offset issue, not a GLB size mismatch. The old 0.2 m offset was retained after the raft geometry changed.
- Upper-floor/tower tops are 2.3 m above their model base; stair rails reach 2.65 m while the ramp rise is 2.3 m. Open gates extend into neighboring cells and require swing clearance.

## Method and limits

Read POSITION vertices from each deployed GLB, applied the default scene's full node hierarchy (matrix or translation/rotation/scale), then applied the runtime uniform scale. Compared results to stored model bounds, grid footprint and construction placement transforms. Parent platform scale is canceled by the construction code; expansion roots are recreated at unit world scale. All tabulated dimensions are SDK X/Y/Z: width × height × depth, metres.

This is a fresh geometry/source audit, not a fresh per-model Explorer walkthrough. Prior iteration-two phone evidence covers stair walking and gate operation, but does not validate all 40 assets today. Unintegrated assets cannot be visually approved in the current scene. No model regeneration, deployment or source scale change was performed.

## Integrated models — final world dimensions

| Model | Width × height × depth (m) | Entity scale |
|---|---|---|
| ammoCrate | 1.200 × 0.565 × 0.912 | 1.2 |
| armoredFoundation | 2.900 × 0.160 × 2.900 | 1 |
| armoryBench | 1.800 × 1.329 × 1.192 | 1.8 |
| cropBed | 1.084 × 0.703 × 1.600 | 1.6 |
| engineeringBench | 1.740 × 1.800 × 1.276 | 1.8 |
| gate | 2.700 × 2.000 × 0.300 | 1 |
| improvedGrill | 1.400 × 0.708 × 0.965 | 1.4 |
| lookoutPost | 2.700 × 3.650 × 2.700 | 1 |
| railing | 2.700 × 1.000 × 0.300 | 1 |
| rainCollector | 1.800 × 1.579 × 1.800 | 1.8 |
| researchTable | 1.800 × 1.027 × 1.146 | 1.8 |
| ropeBarricade | 2.700 × 1.000 × 0.250 | 1 |
| smelter | 1.189 × 1.500 × 1.178 | 1.5 |
| spikeStrip | 2.700 × 0.500 × 0.700 | 1 |
| stairs | 2.400 × 2.650 × 2.700 | 1 |
| towerPlatform | 2.700 × 2.300 × 2.700 | 1 |
| upperFloor | 2.700 × 2.300 × 2.700 | 1 |
| wall | 2.700 × 2.000 × 0.250 | 1 |
| waterTank | 1.262 × 1.384 × 1.600 | 1.6 |
| workbench | 1.800 × 1.048 × 1.382 | 1.8 |

## Unintegrated static GLBs — native dimensions only

| Model | Width × height × depth (m) |
|---|---|
| alarmBell | 0.413 × 0.801 × 1.000 |
| antennaMast | 0.746 × 1.000 × 0.363 |
| ballista | 1.000 × 0.564 × 0.873 |
| bandage | 0.920 × 0.656 × 1.000 |
| batteryBank | 1.000 × 0.771 × 0.541 |
| boardingShield | 0.742 × 1.000 × 0.470 |
| bow | 1.000 × 0.998 × 0.130 |
| deckCannon | 1.000 × 0.801 × 0.762 |
| engine | 1.000 × 0.914 × 0.920 |
| generator | 0.680 × 0.639 × 1.000 |
| harpoonTower | 0.703 × 1.000 × 0.996 |
| netLauncher | 0.980 × 1.000 × 0.674 |
| powerRelay | 0.533 × 1.000 × 0.529 |
| repairKit | 1.000 × 0.680 × 0.709 |
| rescueRadio | 1.000 × 0.411 × 0.645 |
| sail | 1.000 × 1.000 × 0.512 |
| salvageAxe | 0.906 × 1.000 × 0.201 |
| scrapArmor | 1.000 × 0.799 × 0.613 |
| steeringWheel | 0.848 × 1.000 × 0.274 |
| zombie | 0.561 × 1.000 × 0.354 |

Raw measured bounds and runtime comparisons: [bounds.json](bounds.json).
