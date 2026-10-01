# Desktop HUD edge spacing — 2026-09-30

Based on `origin/feat/web-hud-and-starter-raft` at `dd72f58`; worktree branch `fix/desktop-hud-edge-spacing`.

The desktop HUD previously used the entire Bevy `interactableArea` rectangle, including large top/right/bottom margins. At the inspected normal browser viewport those gaps were approximately 45/90/45 canvas pixels.

The desktop layout now keeps the reported left-side chrome clearance plus a 12-unit virtual gutter. Top, right and bottom use the hardware-safe canvas plus that same small gutter. The wrapper and standalone objective/notification placement all use the shared helper. The 1920×1080 virtual canvas and SDK scaling are unchanged; mobile retains its existing reported safe areas.

Bevy Web verification: top/right/bottom gaps reduced to approximately 8 canvas pixels at the normal browser size, and backpack opening/closing still works with all 25 slots visible. Before/after screenshots accompany this note. At 960×540, the three requested edge gaps scale to 6 canvas pixels. The tutorial still partly overlaps the native minimap at that size: the reported left clearance is narrower than the visible map. That separate narrow-window left-side issue is not addressed by this top/right/bottom adjustment.

Validation: build/typecheck passed; mobile controls, UI review and custom-touch UI suites passed; git diff whitespace check passed. No new on-device phone check was performed. The earlier unrelated cooperative starter-tile test failure remains outside this change.

Changes are uncommitted in the separate worktree. Nothing was deployed or pushed.

## Follow-up: HUD size and minimap clearance

Changed the desktop virtual reference to 1600×900, giving a uniform 20% increase at the same viewport via the SDK scaling formula. The mobile 1600×720 override is retained and the inset helper uses the matching desktop reference. Desktop left clearance now reserves at least 220 canvas pixels for native chrome plus 24 virtual units of separation; other edges retain their small 12-unit spacing.

Reloaded and visually verified the current Chrome preview: the guide now has a visible gap from the minimap, and text, vitals, menu buttons and tool slots are larger. See `larger-hud-minimap-gap.png`. Build/typecheck, mobile-controls, UI-review and custom-touch suites passed. This follow-up was visually checked at the normal browser viewport; a full responsive and phone retest remains pending.
