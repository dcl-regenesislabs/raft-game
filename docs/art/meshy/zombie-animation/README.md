# Zombie rig and animations

The original reference was regenerated in T-pose with Meshy T2 smart topology, target 4,000 polygons, and a 2048 × 2048 texture. The rig request used a 1.7 m height.

## Completed

- T-pose: `01a0b719-0a3d-716a-bd26-8d5d177c8ab4` — 15 credits.
- Rig: `01a0b71b-2ea7-77d9-ba95-8412b72a2a71` — 5 credits, including walk and run.
- Output: `assets/scene/items/expansion/zombie-animated.glb`.
- 4,301 triangular faces, one mesh/material, 24 joints, embedded 2048 × 2048 texture.
- Clip names: `idle` (4.033 s), `walk` (1.067 s), `run` (0.667 s), `attack` (1.8 s), `hit` (1.667 s), `death` (3 s).
- Combined GLB: 6,774,796 bytes. Total approved and consumed credits: 32.

Run `python3 scripts/package-zombie-animations.py` to combine the downloaded clips. The script checks joint names and inverse bind matrices, remaps animation targets, and copies animation buffers while retaining one copy of the mesh and texture.

Blender imported all six clips from the combined GLB. Sampled renders confirmed visible skeletal deformation, including the attack, recoil, and fallen death poses; evidence is saved as `combined-*-preview.png` and `combined-inspection.json`. Meshy rig files include a static pose clip; it is not included as an idle animation. The texture check passed with `--max-size 2048`; the SDK build and type check passed using Node 22. The model has not yet been connected to the game's raid entities or tested in Explorer.

## Additional animations completed

Idle (action 0), unarmed attack (191), hit reaction (178), and death (8) consumed 3 credits each, 12 additional credits, following explicit approval. Task IDs and statuses are recorded in `extra-tasks.json`. Action IDs come from the [Meshy animation library](https://docs.meshy.ai/en/api/animation-library).

Source clips are saved as `zombie-idle.glb`, `zombie-attack.glb`, `zombie-hit.glb`, and `zombie-death.glb`. All six clips share identical joint ordering and inverse bind matrices. During integration, loop idle/walk/run and trigger attack/hit/death as one-shot states. Death requires delaying entity cleanup until its clip completes. Walking should use in-place motion or have root translation removed so it does not conflict with the game movement system.
