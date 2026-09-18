# Custom mobile action controls

The scene now owns the main tool, jump, hammer mode and contextual/rotation
buttons. `UiInputBinding` maps them to existing InputActions, preserving native
jump physics and tool hold/release behavior. Native joystick and crosshair remain.
Proximity actions keep their existing near-crosshair UI without duplicates.
Jump stays to the left of the primary action, regardless of equipment.
Panels remove the custom control tree; renderer binding removal releases input.

Validation:
- TypeScript and production build passed.
- Existing 118 regression checks passed.
- Custom touch UI render test passed: action mapping, jump binding/position,
  safe insets, proximity deduplication, hammer mode, icon replacement, held/bite
  feedback and hidden-state removal.
- Local SDK and Explorer source confirm UiInputBinding and native jump mapping.
- Connected Motorola observed through read-only screenshot; it still displayed
  the previous native controls. No phone touches, reload or restart were sent
  because the user is testing. Device verification of the new UI remains pending.

On-device follow-up: simultaneous joystick/action touches, jump, charge/release
hook, finger cancellation, equipment changes, panel opening during a hold,
rotation/erase mode, simultaneous purifier actions, and fishing bite/retract.

## Visual refinement

Read-only Motorola capture confirmed the first custom implementation was loaded:
beige button textures had excessive transparent padding, making jump look tiny,
and the enlarged hook artwork spilled outside the visible button surface.
Replaced those surfaces with dedicated dark translucent circular SVG/PNG assets,
a clear arrow-over-ground jump glyph, larger visible secondary controls, and
contained tool artwork. Touch rectangles remain fixed while only icon art animates.
The revised build, custom UI test and 22 mobile control tests pass. A subsequent
capture still showed the beige revision: the new styling requires a scene reload.
No automated input or reload was sent during the user's phone session.
