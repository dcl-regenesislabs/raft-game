# Image-first prototype verification

## Automated

- SDK build and TypeScript check passed.
- 92 checks passed: gameplay 28, mobile controls 21, UI review 18, expansion 24, scene configuration 1.
- Expansion checks cover station ownership, production, defense/power/rescue behavior, sprite child cleanup, staircase collision steps, and transparent source/world/icon assets for all 51 items plus the boarding enemy.
- World textures are 512px; inventory icons are 128px. Full-resolution source artwork is excluded from deployment.
- No expansion GLB references or temporary phone-test helper remain in scene code.

## Motorola

Verified sprite rendering and workbench proximity action, opened the workbench crafting panel and checked the matching new item icons. Initial alpha-blended material let the ocean show through; explicit alpha-cutout material fixed this without Explorer changes.

Screenshots record the station sprites and workbench menu. The complete survival-to-radio loop and every physical collider were not manually replayed on the phone in this art pass. Stairs/collision cleanup have automated coverage. Camera-facing sprites cannot visually communicate physical yaw like the future models will.

Art source locations, prompt template and regeneration commands: `docs/art/prototype-sprites.md`.
