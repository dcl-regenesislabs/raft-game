# Iteration 2 integration QA

Date: 2026-09-17. Ten construction assets integrated into placed objects and placement ghosts. HUD icons remain unchanged. The debug sandbox adds a southern display row at grid Z=-2, X=-2 through 7, with a connected walkway at Z=-1.

## Placement audit

[Exact source bounds, node scales and normalized runtime bounds](../../art/meshy/iteration-2/placement-audit.json). All ten runtime GLBs were re-imported into Blender and measured with node transforms applied; bounds agree within 0.00001 m. No animations or built-in collider meshes. Original generated GLBs are preserved in `docs/art/meshy/iteration-2/source-models/`; `scripts/prepare-iteration-two-models.py` reproducibly fits runtime exports without changing texture pixels or geometry counts.

Entity scale is 1 for these ten assets; their model origin is centred horizontally at the bottom. At a platform origin (x,16,z), the model origin is (x,16.2,z). Bounds are origin plus the listed min/max. Debug row closed extents are inside X=[392.65,422.35], Z=[392.55,395.45], Y=[16.2,19.85], well inside the 800 × 800 m scene and its height budget. Cardinal rotations fit the 3 m grid. Open gates extend up to 2.7 m toward the adjacent tile; account for swing clearance when placing nearby structures.

| Asset | Runtime width × height × depth (m) |
|---|---|
| wall | 2.70 × 2.00 × 0.25 |
| gate | 2.70 × 2.00 × 0.30 |
| stairs | 2.40 × 2.65 × 2.70 |
| upperFloor | 2.70 × 2.30 × 2.70 |
| railing | 2.70 × 1.00 × 0.30 |
| armoredFoundation | 2.90 × 0.16 × 2.90 |
| towerPlatform | 2.70 × 2.30 × 2.70 |
| ropeBarricade | 2.70 × 1.00 × 0.25 |
| spikeStrip | 2.70 × 0.50 × 0.70 |
| lookoutPost | 2.70 × 3.65 × 2.70 |

Upper floor and tower deck tops are at 2.3 m above the deck, matching existing tower support offsets. Raised structures use mesh physics to retain openings beneath decks. Stair rails reach 2.65 m; a separate 2.3 m rise / 2.7 m run ramp smooths out the generated risers. Spike strips remain nonblocking. Gate opening swings the complete generated assembly about its left post; it is not an independently rigged panel. Closing and hydration share the same transform helper.

## Checks completed

- 33 expansion regression tests, including deck fit, cardinal footprint, ghost transforms, collision roles, cleanup, gate swing and repeated closing.
- Gameplay regression suite; 14 progression tests; scene configuration check.
- TypeScript and `npm run build` passed. Node 20 tests/typecheck passed, but the installed SDK build requires `fs.globSync` and fails on Node 20. Build passed with Node 22.23.2, matching the current package.json engine requirement.
- All 20 expansion GLBs pass texture validation at 2048 × 2048.
- Offline runtime renders: [contact sheet](runtime-models.jpg).

## Android observations

Motorola Edge 60 Pro, serial 0089321234, Explorer v1.13.3.1909-6f71f4e-prod. ADB reverse port 8002 opens the current local preview. Restarted Explorer without clearing its data, then selected Developer Tools → New Sandbox to seed the updated test layout.

- New volumetric upper floor, railing, foundation, tower, stairs, gate and wall were visible during navigation. [Structure view](01-mobile-structures.png).
- Walked up the stair ramp using only the joystick, without jumping: [before](02-mobile-stairs.png), [at top](03-mobile-ramp.png).
- Tapped Open gate; assembly swung clear and the prompt became Close gate. Tapped again; the gate returned to its starting position and the prompt reverted. [Closed](04-mobile-gate-closed.png), [open](05-mobile-gate-open.png), [closed again](06-mobile-gate-reclosed.png).

## Remaining limitations

Desktop Explorer verification, on-device save/load, full placement/rotation/removal coverage, every structure collision and repeated-asset performance remain unverified. Phone evidence is a focused rendering, stairs and gate smoke test. Offline previews cover all ten assets. Pale platform tops and dark lookout-post texture patches remain from generation; no additional paid generation or texture changes were made.

Local preview is left running on port 8002. Nothing was deployed.
