# Simple placeable artwork — 2026-09-16

Replaced all 33 expansion construction images with plain, chunky forms. Each station has a single identifying feature. Removed grain, rivets, decorative machinery, loose tools and exposed electrical cables. Inventory and native action icons derive from the same artwork; full-resolution sources remain ready for the later model pass.

Power already used proximity-based automatic connections. Made the seven-meter range explicit in one shared constant and in crafting descriptions; radio feedback now explains placing a nearby power source rather than implying a manual connection. Wire remains only a crafting ingredient. No wiring entities or connection actions were introduced.

Validation:

- Build and TypeScript passed.
- 93 automated checks passed: gameplay 28, mobile controls 21, UI 18, expansion 25, scene metadata 1.
- New autowiring coverage verifies the range boundary, relay addition/removal, moving consumers and exhausted generators.
- Reviewed the complete 33-image contact sheet for simple forms and absence of electrical cables.
- Motorola screenshot `simple-stations-phone.png` confirms the new station textures render as transparent cutout sprites. Full gameplay was not replayed on the device during this art-only pass.

Artwork preview: `docs/art/simple-structures-preview.jpg`.
Sources and prompt set: `docs/art/prototype-sprites.md` and `docs/art/simple-structure-specs.json`.
