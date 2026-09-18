# Iteration-one Android smoke test

Date: 2026-09-16. Device: Motorola Edge 60 Pro, connected over USB ADB. Explorer: org.decentraland.godotexplorer, displayed version v1.14.0.1974-7368e6e-staging. Landscape capture size: 2712 × 1220.

Opened the existing app with the preview deep link pointing to http://127.0.0.1:8000, through the existing ADB reverse mapping. No application data was cleared and no APK was installed.

## Observed

- The scene loaded and the iteration-one models rendered on the workshop raft, with textures and volumetric silhouettes. Screenshots cover the workbench, smelter, research table, ammo crate, armory and engineering benches, rain collector, crop bed, water tank and improved grill (the latter visible at the far end).
- ADB joystick swipes moved along the workshop; camera swipes changed the view.
- The engineering bench interaction opened its Navigation crafting menu; closing it returned to the game.
- The smelter displayed both load-metal and add-wood actions. After touch input its fuel label changed from 0s to 30s. A complete smelting cycle/output collection was not verified.
- Most captured HUD readings were approximately 27–36 FPS. At the smelter with its two action prompts visible, repeated captures showed 2–3 FPS and delayed input. After moving away, the HUD recovered to 25 FPS. This is a reproducible observation within this run, not proof that model geometry caused the slowdown. Thermal status was 1 during this period.

## Findings

1. Performance needs follow-up: severe frame-rate drop while interacting with the smelter. Compare proximity UI behavior against the pre-model build and profile before attributing it to GLBs.
2. Rain collector retains the known dark/green texture streaks on its posts.
3. Smelter front opening and workbench vise face away from the debug workshop approach. Rotate these debug placements for clearer inspection, or establish a consistent model-forward convention.
4. Android logs include missing `dcl_shape` metadata errors during loading and MeshRenderer/SceneUi frame-budget warnings. No JavaScript exception or failed GLB load was found in the inspected log slice. This does not establish the origin of the renderer warnings.

## Evidence

- [Workshop overview](01-workshop-overview.png)
- [Engineering crafting menu](02-engineering-interaction.png)
- [Armory and engineering models](03-station-models.png)
- [Survival equipment](04-survival-models.png)
- [Workbench, smelter and research table](05-workbench-smelter-research.png)
- [Smelter fuel accepted, low FPS](06-smelter-fueled.png)
- [Moved away, FPS recovered](07-after-moving-away.png)
- [Android log slice](device-log.txt)

This was a rendering/navigation/interaction smoke test. Placement ghost colors, placement/rotation, every station action, collision coverage, save/load round-trip and long-duration stability were not verified on-device. No game-code changes were made during this test. The app remains open on the workshop raft.
