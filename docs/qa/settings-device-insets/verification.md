# Settings, outcome alignment and pickup artwork — 2026-09-17

- Game Over and the shared victory panel now use `screenInsetArea` for both
  centering and available dimensions. Other modals retain their previous inset
  behavior unless explicitly opted into device insets.
- Settings also uses device insets. Its main page is 420 × 440 virtual pixels,
  with music, survival guide, save/load, more options and resume. Instructions and
  the introductory text were removed. Lobby/restart and development-only tools
  are on secondary pages. Existing load/restart confirmations remain.
- Collectible pickup uses hand artwork in the mobile primary interaction and
  main action controls, and the legacy contextual action button. Builder and
  placement modes retain their existing actions. Looking away restores the tool.

## Verification

`npm run build`, `node scripts/test-ui-review.cjs`,
`node scripts/test-mobile-controls.cjs` and
`node scripts/test-custom-touch-ui.cjs` passed.

On the connected Motorola Edge 60 Pro, Godot Explorer
`v1.13.3.1909-6f71f4e-prod`, via ADB:

- Opened Settings and checked the compact centered layout, readable buttons and
  absence of scrolling on its initial main page. [Screenshot](01-settings.png)
- Navigated More options → Developer tools and used Test Death / Retry.
- Game Over is centered horizontally on the display rather than shifted right
  by the Explorer's interactable-area reservation. Both retry actions are fully
  visible. [Screenshot](02-game-over.png)
- The phone remains on Game Over. During developer-menu navigation, a swipe
  over a fixture button activated it; used the scrollbar afterward. No cloud
  save was overwritten during this UI check.

The hand artwork switch is regression-tested for both target acquisition and
looking away; a targeted on-device pickup screenshot was not captured. Desktop
was checked by build/mocks rather than a live Explorer session. No deployment.

## Follow-up: native hover hand glyph

Removed the custom GrabPrompt UI. Floating debris again enables native
PointerEvents feedback and highlighting on every platform. While targeting
salvage, TouchScreenControls supplies the hand texture for IA_PRIMARY; Godot
Explorer's tooltip_label.gd reads this override for its native hover glyph,
independently of the native gamepad button being hidden. Looking away clears
that override. Desktop retains its keyboard binding.

Build, 26 mobile-control checks and custom-touch-UI checks passed. The new
regression covers native icon assignment, unchanged-state deduplication and
restoration on target loss. On-device hover appearance and pickup still need
confirmation for this revision.
