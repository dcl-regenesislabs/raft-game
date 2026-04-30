# Iteration 01 — Water Floor

## Goal

Settle on the water look-and-feel for the RAFT-like scene. The first iteration
ships exactly what we have today: a 480×480 m UV-scrolling tiled PNG plane and
**one** wooden box platform at the parcel center. Nothing else.

## Current state (shipped)

- `src/factories/water.ts` — 30×30 tiled PNG plane (`assets/scene/water/water-tile.png`),
  PBR material, slight roughness/metallic for a wet look.
- `src/components.ts` — `WaterScroll` component carries per-axis UV speed +
  accumulated offsets + cached tile count.
- `src/systems/waterScroll.ts` — per-frame UV drift; rebuilds the plane's UVs
  with offset values wrapped to `[0, 1)`.
- `src/factories/platform.ts` — single 6×0.3×6 m wooden box, collider, walnut PBR.
- `src/index.ts` — `main()` adds the water + system + one platform + empty UI.

## Open experiments for follow-up iterations

When we revisit "different types of waters", things to try (one per branch,
A/B walk-test in `npm run dev -- --bevy-web`):

- Layered scrolling tiles at different speeds + alphas for parallax depth.
- Subdivided plane with vertex-driven gerstner-style wave offset (no shader
  access in SDK7, but mesh subdivision + per-frame vertex offset is feasible).
- Reflective material tuning (metallic ↑, roughness curve), HDR-style highlights.
- MP4 animated loop comparison (`water-loop.mp4` + `VideoPlayer`) as a baseline
  for "expensive but pretty" — measure perf cost and decide.
- Edge foam ring around the platform (separate plane with a fading mask).
- Vertical bob: have the platform ride a sine wave so the world reads as ocean,
  not pond.

## Out of scope (this iteration)

Player movement on a moving raft, raft scaling, resource gathering, hunger,
shark, crafting, networking. Those land in later iteration plans.
