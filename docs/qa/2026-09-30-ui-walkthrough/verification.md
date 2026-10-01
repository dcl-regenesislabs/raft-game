# UI walkthrough — 2026-09-30

Branch: `fix/desktop-hud-edge-spacing`, based on `dd72f58` (the unmerged HUD/starter-raft feature). Changes are in the sibling `raft-game-ui-review` worktree, not the original main checkout. No deployment.

## Implemented and visually verified

- Bottom toolbar and builder strip center on the entire canvas, independently of the minimap/chat margin. In the 1512-pixel-wide viewport the toolbar midpoint is 756. Small bottom gutter remains.
- Desktop uses the existing 1600×900 virtual reference (20% larger than 1920×1080). SDK performs scaling once; no DPR multiplier. Mobile retains SDK's 1600×720 override.
- More tools now stays open during structure placement/hammer use. Previously render logic immediately forced it closed. Builder controls and transient cost/name labels hide while extra slots are expanded, then return after selection. Selected the hidden hammer in Bevy and switched BUILD to REMOVE successfully.
- Research recipe states use readable Unlocked/Locked text instead of missing checkmark glyphs. Craft availability uses OK; mobile picker selection uses ON. The current debug phase uses gold text instead of low-contrast dark teal.
- Shared outcome panel gets an explicit content-derived height bounded by the available screen. Bevy previously stretched the scroll container to near-full-screen height. Verified both the two-button fixture and real one-button multiplayer death screen; real RESPAWN returned to the HUD with restored vitals.

## Walkthrough coverage

| Surface | Evidence / result |
| --- | --- |
| Main HUD | Normal desktop vitals, three menu icons, tutorial, collapsed/expanded objective, centered toolbar inspected. Objective opens/closes and has clearance from guide and vitals. |
| Toolbar / building | Initial five slots, extra slots, selection highlight, counts, durability, hidden-tool selection, BUILD/REMOVE state and rotate control visibility inspected. Extra-tools regression fixed. Did not place/remove raft tiles in the main preview. |
| Backpack | All 25 slots fit; select item, EQUIP, return to HUD tested. Equipment model and toolbar selection update. |
| Crafting | Tools/resources/research categories, locked materials, recipe details, close button and menu transition checked. Craft progress behavior covered by existing suites, not a timed visual capture in this pass. |
| Research | Chapter switching, long-list scrolling, unlocked/locked recipe labels verified in final build. |
| Cooking | In isolated QA scene, opened a real grill menu, selected roasted potato, saw ingredient/fuel auto-fill and enabled COOK, submitted. Storage afterward showed one potato and one wood consumed. |
| Storage | In isolated QA scene, all 25+25 slots visible at equal sizes. Selected potato stack and transferred 20 into backpack: storage 98→78, backpack empty→20. Selection instructions and counts updated. |
| Settings | Main menu, reset confirmation, CANCEL, debug menu and scrolling through lower actions tested. No reset submitted. Music toggle not changed. |
| Endings | Real death/respawn verified. Shared two-button outcome layout and CONTINUE tested through isolated fixture; no actual campaign victory or score submission. |
| Connection | Shared connection overlay rendered using an isolated fixture. Real connection also exercised during preview reloads. |
| Startup/update | Source and regression review only. Forced StartupScreen without startup state did not reproduce its gated animation; no claim of visual pass. Version-update flow not forced. |
| Mobile / contextual gameplay | Existing touch, menu paging, input consumption, ending gates and gameplay regressions pass. Phone interaction, mobile visual layout, fishing bite controls, combat banners, proximity prompts and every timed notification were not exercised end-to-end in this pass. |

Temporary QA controls only exist in `/tmp/raft-ui-walkthrough`; they are not part of the source branch. The fixture uses existing debug actions and actual station entities in a separate preview realm on port 8002. Main preview is port 8001.

## Size and style consistency

Shared ocean-blue panels, teal actions and gold active/selection accents remain consistent. HUD menu icons and toolbar cells both use 64 virtual units; ordinary close/menu actions use 48-unit targets. Dense lists use smaller text than menu headings; endings intentionally use a larger headline. Storage's two grids share identical cell dimensions. No global font enlargement was layered over the virtual-canvas scaling.

## Remaining issue: narrow Bevy browser view

At the normal viewport, UiCanvasInformation reported 1512×731 and devicePixelRatio 2, matching the visible layout dimensions. Under the browser's 960×540 viewport override it reported 1920×1080 and devicePixelRatio 1, including left interactable inset 291.6. The visible native minimap and the scene did not agree on clearance; the tutorial overlapped the minimap. Reproduced after a clean reload at the narrow size. Screenshot includes a temporary diagnostic label; all diagnostic code was removed from the final build.

This is an unresolved renderer/emulation coordinate mismatch, not a verified phone failure. A scene-only DPR multiplier would be unjustified and was not added. Check actual native-window resizing and the phone before claiming responsive visual sign-off.

## Validation

- `npm run build`: passes bundling and TypeScript checking.
- All 13 `scripts/test-*.cjs` suites pass under Node 22.23.3 (CI targets Node 20).
- UI review suite now has 22 cases, including More tools remaining open during placement, selecting an extra tool, and restoring builder controls.
- Updated a stale cooperative test to construct/remove a removable expansion at 2,0 rather than a protected starter tile at 1,0. Its delayed-action/replacement assertion remains intact.
- `git diff --check`: clean.
- Final browser loaded rebuilt source; preview servers restarted after the final build. Main tab left open.

Screenshots: `more-tools-fixed.png`, `storage-transfer.png`, `ending-before.png`, `ending-after.png`, `death-live.png`, `research-labels.png`, `narrow-canvas-mismatch.png`, `final-hud.png`.
