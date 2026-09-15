# Hammer control artwork

Generated with the built-in image tool. Build/erase edits reference `images/hud/items/hammer.png`; original artwork is retained.

## build-selected

Output: `images/hud/build-selected.png`

Prompt: Use case: precise-object-edit. Edit the provided existing game hammer icon. Preserve its exact wooden hammer, rope, shape, orientation, colors and simple outlined cartoon style. Only add a small clearly visible teal circle containing an ivory CHECK at the lower-right of the hammer head to indicate selected build mode. Keep the hammer unchanged. Transparent background, no text, square icon.

## erase-selected

Output: `images/hud/erase-selected.png`

Prompt: Use case: precise-object-edit. Create an ERASE-HAMMER demolition-mode variant from this existing game hammer icon. Preserve the recognizable wooden hammer silhouette, diagonal orientation, rope binding and simple dark-outline cartoon style. Add a prominent coral-red demolition X on the hammer head and a few small broken wood chips beside its striking end, so it reads as a dismantling hammer, not a stationery eraser. Add a small teal circular CHECK badge at lower-right to indicate selected mode. Transparent background, no text, square game icon.

Rotation outputs: `images/hud/rotate-clockwise.png`, `images/hud/rotate-counterclockwise.png`. Prompt: single thick ivory circular arrow in the named direction, dark outline, warm cartoon game style, transparent square background, no text.


## Consistency revision

Counterclockwise is an exact horizontal pixel mirror of the approved clockwise asset. The original hammer remains the build icon. Erase uses images/hud/hammer-highlighted.png: original hammer reference edited with a circular golden-yellow gradient background, no checks or demolition markings. Single toggle retained: yellow indicates erase active. Prior generated hammer variants are superseded.

Built-in edit prompt: Preserve the existing hammer shape, rope, proportions, colors, orientation and framing; add only a circular yellow gradient background, pale bright center and golden edge, transparent outside the circle, no badges or extra decoration.

## Softer, distinct tools (current)

Current assets: original `items/hammer.png`, `eraser.png`, `build-soft-selected.png`, `erase-soft-selected.png`. Rotation remains the exact mirrored pair.

Built-in image tool prompts:
- Hammer selected (edit original): preserve existing hammer; add only a very subtle low-opacity desaturated cream-gold circular halo, feathered edge; no bright yellow, checks, badges or text; transparent PNG.
- Eraser (generate): simple chunky coral-pink and cream rubber eraser, diagonal, dark brown outline, warm cartoon shading, centered transparent square, generous padding, legible at 48px; no hammer, check, X, badge or circle.
- Eraser selected (edit eraser): preserve artwork, scale and orientation; add an extremely subtle desaturated cream-gold translucent halo, feathered edges; no saturated yellow or bright white; no badge, check or text.

The large native POINTER performs the selected action; the smaller alternate-tool icon switches mode. Only the large action uses the soft selected texture. This avoids the native '+' overflow observed with two mode buttons alongside rotation.
