# Language support — 2026-10-02

English, Spanish and Brazilian Portuguese are available throughout the scene. Settings exposes DEFAULT, ENGLISH, ESPAÑOL and PORTUGUÊS in solo and cooperative play. DEFAULT follows Explorer; unsupported or absent locale values resolve to English. Explicit choices apply immediately and last for the current scene session, including deaths, world resets, menu transitions and save/load. They are not written to shared world saves or persisted across a scene reload, matching the existing session-only music setting.

## Explorer integration

Verified against the installed SDK and the adjacent `godot-explorer` implementation:

- `lib/src/dcl/js/js_modules/Runtime.js` returns `configurations.locale` and a forward-compatible top-level `locale`.
- `lib/src/godot_classes/dcl_scene_locale.rs` supplies the resolved **app** locale as a BCP-47 tag, not the operating system locale.
- Explorer emits `localeChanged`, but the pinned SDK's `observables.js` legacy event poll only dispatches `comms`. The scene therefore checks `getExplorerInformation` every two seconds, without draining the SDK's event queue or upgrading dependencies.
- Regional forms such as `es-AR`, `pt-BR`, `pt_PT` normalize to supported languages. API failures retain the last successful detection. Explicit choices always win; returning to DEFAULT uses the latest detected language.

## Translation boundaries

`src/i18n/catalog.ts` contains complete English messages and both translations, with numbered placeholders. `t()` translates rendered labels, including cached notifications and catalog data. Templates preserve counts and interpolate translated item names. Unknown diagnostics remain readable in English. Game IDs, assets, saves, recipes and network messages retain their original values.

A late ECS system translates local TextShape and PointerEvents presentation components, preserving their English source so existing NPC bubbles, signs and prompts can change back to English. Tracking entries are removed when components disappear. Both UI rendering and world text use the same translator. The bounded cache is cleared when the effective language changes.

Language names use their native spelling so players can recognize them even after choosing an unfamiliar language. The Settings selector uses existing touch-consumption handling; the multiplayer panel scrolls within the device's available height.

## Automated validation

- All 15 `scripts/test-*.cjs` suites passed on Node 20.20.2.
- The language suite checks every translation and its placeholders, content-catalog/UI coverage, dialogue line lengths, regional detection, fallbacks, explicit overrides, live selector interactions, changing world prompts, entity cleanup, and unchanged ranking addresses.
- UI review and custom touch suites pass with localized display boundaries.
- `npm run build` passed on Node 22 with type checking. Node 20 cannot run this installed SDK's build command: it uses `fs.globSync`, absent in Node 20. No SDK or package versions were changed.

## Explorer visual QA outstanding

No running Explorer/local scene preview was available during this pass. Mock layout checks do not establish in-world font rendering, wrapping or pointer behavior. Desktop and mobile screenshots are still needed for:

1. DEFAULT in English, Spanish and Portuguese; change Explorer language while a menu is open and allow two seconds for detection.
2. Force each language, change Explorer language, and verify the override remains; choose DEFAULT to resume following Explorer.
3. Settings on short mobile screens; scroll to Resume and verify a selection does not also fire the equipped tool.
4. Craft/cook descriptions, tutorial pages, inventory/storage counts, confirmations, notifications, and death/victory screens.
5. Chef bubble accents and line breaks, lobby signs, leaderboard loading/empty text, and dynamic machine hover prompts.
6. Two players using different languages while crafting, transferring items and reloading shared state.

The game logo/title remains the original artwork.
