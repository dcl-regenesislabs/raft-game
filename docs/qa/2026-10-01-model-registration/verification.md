# Generated model registration

Registered 13 placed structures and the static boarding zombie using existing GLBs. No generation or asset modification. Construction previews share the same catalog, scale and deck offset. Existing physics proxies use these bounds; enemies remain non-blocking.

All 14 GLBs have one identity-transform mesh node, no animation clips, and no named built-in colliders. Native bounds were read from their POSITION accessors after confirming node transforms are identity. Existing iteration 3/4 preview renders were inspected. The static zombie is deliberately used; the separate animated variant is not integrated by this registration change.

## Placement audit

Dimensions are X × Y × Z in meters. Origins remain at tile centers; model Y = platform origin Y + deck offset. The visual bottom is at platform Y + 0.1 m. Raised tower placement adds the existing 2.3 m support height. All new horizontal half-extents are at most 1.35 m, fitting a 3 m tile at cardinal rotations. Scene bounds still depend on the existing platform placement rules; no fixed world positions or parcel changes are introduced.

| Asset | Native dimensions | Scale | Deck offset | World dimensions |
| --- | --- | --- | --- | --- |
| netLauncher | 0.980 × 1.000 × 0.674 | 1.5 | 0.850 | 1.471 × 1.500 × 1.011 |
| ballista | 1.000 × 0.564 × 0.873 | 1.8 | 0.610 | 1.800 × 1.016 × 1.571 |
| harpoonTower | 0.703 × 1.000 × 0.996 | 1.6 | 0.900 | 1.125 × 1.600 × 1.594 |
| deckCannon | 1.000 × 0.801 × 0.762 | 1.6 | 0.741 | 1.600 × 1.281 × 1.219 |
| alarmBell | 0.413 × 0.801 × 1.000 | 1.5 | 0.701 | 0.620 × 1.201 × 1.500 |
| sail | 1.000 × 1.000 × 0.512 | 2.7 | 1.450 | 2.700 × 2.700 × 1.382 |
| steeringWheel | 0.848 × 1.000 × 0.274 | 1.3 | 0.750 | 1.102 × 1.300 × 0.357 |
| engine | 1.000 × 0.914 × 0.920 | 1.5 | 0.786 | 1.500 × 1.371 × 1.380 |
| generator | 0.680 × 0.639 × 1.000 | 1.4 | 0.548 | 0.952 × 0.894 × 1.400 |
| batteryBank | 1.000 × 0.771 × 0.541 | 1.2 | 0.564 | 1.200 × 0.926 × 0.649 |
| powerRelay | 0.533 × 1.000 × 0.529 | 1.1 | 0.650 | 0.587 × 1.100 × 0.582 |
| antennaMast | 0.746 × 1.000 × 0.363 | 3 | 1.600 | 2.238 × 3.000 × 1.090 |
| rescueRadio | 1.000 × 0.411 × 0.645 | 0.9 | 0.285 | 0.900 × 0.370 × 0.580 |
| zombie | 0.561 × 1.000 × 0.354 | 1.8 | 1.000 | 1.009 × 1.800 × 0.636 |

## Validation

- Node 20: expansion (34 cases), gameplay, and cooperative (21 cases) regression suites passed. Coverage includes all placeable expansion items having model registrations, deck grounding, tile fit, cleanup, and matching non-colliding placement previews.
- Texture validation passed: all 41 expansion GLBs within 2048 × 2048.
- Build and TypeScript checking passed on Node 22. Node 20 build failed because the installed SDK requires `fs.globSync`; package.json already declares Node >=22. No dependency changes made.
- `git diff --check` passed.
- Explorer desktop/mobile verification has not been performed; firing-direction alignment and in-world appearance remain to be checked. No deployment performed.
