# Image-first expansion artwork

Expansion items use transparent painted sprites during concept validation. Existing original game models are preserved. Do not generate expansion models until the concept is approved; the next modeling pass is the user's Meshy workflow.

## Source and derivation

- `images/concepts/expansion/*.png`: original full-resolution generated images, retained for Meshy. Excluded from deployment.
- `images/scene/expansion/*.png`: 512px transparent world textures, bottom-aligned.
- `images/hud/expansion/*.png`: 128px inventory icons, from exactly the same artwork.
- `images/hud/main-action/`: tightly fitted native action icons.

## Simple placeable art direction (2026-09-16)

Placeable constructions now use the simplest readable forms: plain surfaces, chunky geometry, broad colors and one identifying feature. No grain, wear, rivets, decorative fittings, exposed mechanisms, loose props or electrical wiring. The simplified workbench (`images/concepts/expansion/workbench.png`) is the style reference. It consists of a tabletop, four legs and a small block vise.

All 33 placeable expansion objects use this direction, with matching inventory icons derived from their new source images. Tools, resources and the boarding enemy keep their previous artwork.

Generated independently with the **built-in image-generation tool**, one call per asset. Exact subject specifications for the other 32 placeables are in `simple-structure-specs.json`.

Prompt template:

> Use case: stylized-concept. Create a replacement game sprite for {id}. The reference image defines the exact simple visual style, not the subject. Subject design: {specification}. Match plain smooth surfaces, chunky toy-like basic geometry, warm wood / charcoal / muted brass / teal palette, subtle two-tone shading and restrained dark edges. As simple as possible for later low-complexity 3D modeling: only a few large parts, no decorative parts. No wood grain, scratches, wear, rivets, bolts, tiny seams, mechanical internals, surface textures, loose tools, clutter, cables or visible electrical wiring. Do not add details beyond the subject specification. Three-quarter front view slightly from above. One complete isolated object, centered, true transparent alpha background, no floor or external shadow, no lettering, square high-resolution PNG. Simplicity is the highest priority; recognizable silhouette over realism.

## Automatic power

Power connections are inferred from placement within seven meters through generators, batteries and relays. There are no rendered wires, wire placement actions or saved manual connections. Moving or removing a device updates connectivity automatically. Wire remains an abstract crafting ingredient. Power-source artwork has no visible cables or internal wiring.

Rebuild derived textures:

```sh
python3 scripts/build-expansion-sprites.py
node scripts/build-main-action-icons.cjs
npm run build
```

## Runtime

`src/expansion/sprites.ts` supplies fixed-orientation cutout planes with emissive color to preserve the artwork. Uniform root transforms avoid the raft parent's nonuniform-scale distortion. Invisible box colliders are separate children: gates rotate their physical barrier; stairs retain eight steps; raised floors retain decks and supports. Root cleanup explicitly removes all visual and collision children. Placement ghosts use the same artwork with validity tinting. Support save data records the sprite's kind rather than inferring it from a GLB filename.

Sprites are temporary illustrations, not volumetric objects. Their perspective is painted into the artwork. Sprites and placement previews follow the object rotation instead of the camera; they appear thin when viewed edge-on. Collision footprints remain gameplay approximations pending the final model pass.
