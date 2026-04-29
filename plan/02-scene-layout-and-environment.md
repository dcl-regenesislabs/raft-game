# Step 02 — Scene Layout & Environment

## Goal
Place every static asset from Step 01 into the 16×16m parcel so the pond, dock, and three zones exist as a walk-through space — no gameplay yet, just a beautiful empty world.

## Why this step exists here
- **The world has to feel right before any mechanic is added.** Casting against a blank gridbox warps our judgment of every later feel-tuning decision.
- **Spatial layout drives gameplay numbers.** Bobber arc distances, zone trigger sizes, and walk-times to the merchant all depend on real-world placement. Lock the geometry now or rebalance everything later.
- **Performance baseline starts here.** First FPS read on mid-tier Android happens at the end of this step — before any code complexity confounds the measurement.

## Depends on
- Step 01 (every visual asset, locked palette, logged license).

## Adds
- A populated parcel: pond water, shore, dock, three zone dressings, sky, lighting, lanterns.
- Three named **logical zones** marked out (visually distinct dressing) — but no triggers yet.
- The starter `Cube`/`Spinner` scaffolding in `src/components.ts` and `src/index.ts` is removed; the scene loads with no spinning cubes, only the pond.
- An entity-factory module pattern established (per CLAUDE.md): one factory function per environment "kind" (dock, lantern, lily-pad cluster).

## Out of scope
- Player detection of zones (Step 03).
- Animated water shader / day-night (Step 16, stretch).
- VFX particle systems (Step 16). Only the *static* assets land here.
- NPC merchant placement is **stand-in only** (a marker entity at the dock); real NPC wiring is Step 10.

## Acceptance criteria
1. Running `npm run start` opens a scene with the pond, dock, and three zone dressings — and nothing else.
2. The default Decentraland avatar can walk the entire perimeter without falling out, T-posing into a missing collider, or clipping through a prop.
3. Each of the three zones is **visually identifiable in one second** without labels — Lily Cove reads as lush, Starwell as glowing, The Deep as eerie.
4. `npm run build` succeeds; `bin/index.js` is regenerated.
5. Mid-tier Android preview (`npm run start -- --mobile`) sustains ≥45 FPS standing still (we want headroom before gameplay eats into it).
6. Scene size on disk is ≤40 MB (half the §7 budget — the rest is for code, fish data, and audio yet to come).

## Out-of-the-box state to clear
The repo currently ships SDK7 starter content: `Spinner` + `Cube` components and `circularSystem` / `changeColorSystem` systems. These are demo content. This step removes them from `components.ts`, `systems.ts`, `index.ts`, and `factory.ts`, and replaces `setupUi`'s cube-spawn buttons with an empty placeholder that later steps fill in.

## Implementation notes (no code)

Conceptual order:

1. **Decide the parcel grid.** With 16×16m to work with, sketch (on paper or in Scene Editor) where the pond sits, where the dock attaches, and where each of the three zones fits along the pond's edge. The dock is the player's spawn anchor and the merchant's stand. Lily Cove on the near shore, Starwell across the pond, The Deep at the far/back edge.
2. **Strip the starter scaffolding.** Empty `components.ts` of `Spinner`/`Cube`. Remove the systems imports from `index.ts`. The `main()` function should still register `setupUi` but otherwise do nothing yet.
3. **Author entity factories.** One per environment kind: `createDock`, `createPond`, `createLanternCluster`, `createLilyCovePatch`, `createStarwellPatch`, `createTheDeepPatch`. Each factory creates an entity, attaches a `Transform`, attaches a `GltfContainer` pointing at the asset path, returns the entity. No state, no systems.
4. **Compose the world inside `main()`.** A single linear sequence of factory calls, top-to-bottom: pond → shore → dock → sky → lights → Lily Cove dressings → Starwell dressings → The Deep dressings → merchant marker. Reading `main()` should describe the scene.
5. **Update `scene.json` if parcel count changes.** The GDD targets a single parcel (16×16m); confirm `scene.json` reflects this and parcels are correctly listed.
6. **Walk-test on desktop, then on mobile.** Walk every meter. Note any clipping, any missing collider (player walks through a tree), any visual readability issue (zones look the same from above).
7. **Take the FPS baseline.** Record on mid-tier Android, standing still and walking the perimeter. Write the number into `BUDGETS.md` under a new "FPS baseline" row.

Pseudo-flow for `main()` after this step:

```
main():
    create pond
    create shore
    create dock
    create sky / backdrop
    create lantern cluster (× N)
    create lily cove dressings (× M)
    create starwell dressings (× M)
    create the deep dressings (× M)
    create merchant marker (placeholder)
    setupUi()   // empty for now
```

## Risks for this step

| Risk                                                    | Mitigation                                                                                              |
|---------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Zones look the same from the player camera              | Force a top-down + first-person screenshot per zone before approving. If a screenshot fails the readability test, re-dress.  |
| Performance baseline is already <45 FPS                 | Decimate the highest-tri offender; reduce light count; remove duplicate materials. Don't advance until baseline is met.       |
| Walking into a zone clips through a prop                | Add invisible collider boxes via Scene Editor / `MeshCollider` on the offending mesh. Re-walk-test.       |
| Removing starter scaffolding breaks the build           | Build in two passes: first delete components, fix systems.ts imports; then delete systems and fix index.ts. Build between each. |
| Scene size already ≥40 MB                               | Re-export biggest GLB at lower texture resolution, or atlas; revisit Step 01 budgets.                    |

## When this step is done
Open `plan/03-player-presence-and-zones.md`.
