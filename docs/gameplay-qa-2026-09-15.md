# Gameplay QA — 2026-09-15

## Scope and result

SDK 7.28.0. Direct entry and the new tutorial were the focus. Save/load, restart through the server, rankings, and authoritative-server sync were excluded as requested.

- Build and TypeScript checking pass.
- Source-level gameplay tests: 20 pass, 2 fail.
- Direct entry, starter hook/hotbar, ocean/debris rendering, and tutorial layout were visually inspected in Godot's iOS emulation using Vulkan on an isolated Xvfb display.
- The tutorial previously covered the crosshair. Its card was moved upward and narrowed; the corrected layout was visually verified.
- Top-row craft/inventory buttons still overlap the vitals in this emulator layout.
- OpenGL compatibility mode produced a large black UI region. Vulkan did not; this is a client/rendering-path observation, not evidence of a scene JavaScript crash.
- Mouse-driven interactions were not reliable in the isolated Vulkan session. The full touch tutorial, hook catches, fishing timing, placement/collisions, shark combat, island encounters, and victory were NOT verified end-to-end. Source tests are not substitutes for those checks.
- No TypeError, ReferenceError, SyntaxError or JavaScriptError appeared in the inspected fresh emulator log. Client warnings/errors remain, so this is not a clean-client certification.

## Reproduced failures

1. **Bonus hunger is lost on the next drain tick.** `restoreStat` allows hunger above 1, but `adjustStat` calls `setStat`, which caps it at 1. Starting at 1.2 and draining 0.001 produces 1 instead of 1.199. This undermines the bonus on higher-tier meals. Location: `src/ui/statsBars.ts:29`.
2. **Purification can exceed remaining fuel during a slow frame.** With 0.1 seconds of fuel and a 1-second frame, the purifier converts 0.06667 of a bowl rather than at most 0.00667. Conversion uses the full frame delta after fuel is exhausted. Location: `src/systems/purifierProcess.ts:66`.
3. **Texture validation fails:** eight 2048×2048 embedded GLB textures exceed the project's 512-pixel check: boat, fettuccine_sea_food, raft_v2, raft_v3, spaghetti_shark_pomodoro, information_panel, portal_ring, welcome.

The two gameplay failures were left reproducible for review; no balance or server changes were made.

## Reproduction

Run from the scene root:

```sh
npm run build
node scripts/test-gameplay.cjs
npm run check:textures
```

The source test script transpiles the actual TypeScript modules. Renderer/ECS storage, held-item rendering, audio, notifications, and external services are mocked. Cooking and crafting tests use the actual recipe catalogs. The script exits with status 1 while the reproduced failures remain.

For the client, serve the scene with `npm run start -- --no-client`, then from `../godot-explorer`:

```sh
cargo run -- run -- --emulate-ios --preview http://127.0.0.1:8000 --guest-profile --skip-lobby
```

`--skip-lobby` here bypasses the Explorer lobby; the scene's `SKIP_LOBBY` setting separately controls the game lobby. The visual test used the existing compiled Godot executable with `--display-driver x11` on Xvfb, without changing Explorer source.

## Source test results

- **PASS** Normal starter loadout contains only the hook
- **PASS** Debris collection deposits resources and advances tutorial
- **PASS** Insufficient materials do not craft or advance tutorial
- **PASS** Rope recipe deducts two plants and advances tutorial
- **PASS** Hammer recipe spends materials and creates equippable tool
- **PASS** Guide hide/reopen retains earlier progress
- **PASS** Every craft recipe resolves an inventory output and material definitions
- **PASS** Crafting cup, filling, drinking and retaining empty cup
- **PASS** Salt water reduces thirst and does not complete drink objective
- **PASS** Eating cooked food restores hunger and advances tutorial
- **PASS** Fresh tutorial reset clears completed objectives
- **FAIL** Bonus hunger survives the next survival drain tick — bonus reserve was discarded: 1
- **PASS** Purifier converts water while fueled and stops when empty
- **PASS** Purifier does not convert water without fuel
- **FAIL** Purifier lag spike cannot convert more than remaining fuel permits — converted 0.06666666666666667 with only 0.1 seconds fuel
- **PASS** All cooking recipes match regardless of ingredient order and have valid outputs
- **PASS** Cooking rejects an unrecognized ingredient combination
- **PASS** Cooking menu preview does not spend ingredients
- **PASS** Cooking requires fuel and a valid grill
- **PASS** Starting cooking consumes exact recipe quantities and prevents double cooking
- **PASS** Survival freezes during lobby and death
- **PASS** Normal survival drains vitals and triggers game over at zero life

## Physical Android device verification

Tested through ADB on Motorola Edge 60 Pro (`0089321234`), installed Explorer `org.decentraland.godotexplorer` version 1.14.0 / 1925 (staging). Landscape screenshots are 2712×1220. The app connected to this workspace's preview using USB reverse on port 8000 and the preview deep link with **position 14,5**. Omitting the position left the client loading at the default parcel.

Verified with actual touch events:

- Direct game entry renders the raft, starter hook, ocean, debris, and first tutorial objective.
- Tutorial skip and reopen both change the visible guide as intended.
- Crafting opens and its close button works. With no materials, rope shows 0/2 plants and a disabled craft action.
- Native camera dragging changes the view. Native fire press/release clears hook charge; hook durability decreases after use. Successful catches were not verified.
- Inspected screenshots show approximately 30 FPS and normal thermal status; this is a short smoke test, not a performance benchmark.
- No TypeError, ReferenceError, SyntaxError, or JavaScriptError was found in the captured app log.

Additional reproduced problems:

1. **Backpack extends above the screen, including its close control.** The visible inventory cannot be closed through its own close button. Native preview reload was used to recover.
2. **Vitals overlap the crafting/backpack buttons** on the physical phone as well as in emulation.
3. **Tutorial button input leaks into hook charging.** Starting with an idle hook, tapping Skip Guide hides the guide but raises the hook and leaves its orange charge bar full after release. Press/release on the native fire button clears it. A separately tested camera-only swipe did not reproduce the stuck charge, so camera dragging is not established as the cause.
4. Crafting's **REQUIRES** heading wraps its final letter onto another line.
5. Hook charge indicator is offset to the right of the world crosshair.

The full eleven-step tutorial, resource catches, crafted-item placement, fishing, combat, and victory remain unverified on device. Inventory clipping and tutorial input leakage prevent calling the mobile experience ready. Save/auth-server synchronization remains outside scope.

Device screenshots are in `/tmp/raft-android-qa/`: `backpack-ready.png`, `crafting.png`, `reopen.png`, `fire-release.png`, `camera-only.png`, and `skip-isolated.png`. These temporary local artifacts are not packaged with the scene.

## Native mobile controls and UI redesign follow-up

This section supersedes the earlier mobile layout findings where noted.

### Implementation

- Mobile uses SDK `TouchScreenControls`: POINTER uses the equipped item icon; four native shortcut actions switch the remaining quick slots, with native + overflow. E/F retain independent contextual actions. No custom mobile hotbar or second fire button remains.
- Craft, backpack, menu, equipped status and vitals share a top-right HUD. The guide sits beside it, clear of the expanded native controls. Placement rotation/mode controls share the same HUD area.
- Shared panels, inventory cells and action buttons now use pale surfaces, dark text and teal accents. Backpack sizing accounts for scaled safe-area dimensions and keeps its header/close button visible.
- UI input waits for release before allowing world actions. Native equipment switches cancel pending charges, placement previews and fishing lines. Fishing still uses the single native pointer, with catch/retract status feedback.
- Purifier tutorial wording now matches the existing direct-drinking interaction, which records the water/drink milestones.

### Verification

- `npx tsc --noEmit`: pass.
- `npm run build`: pass.
- `node scripts/test-mobile-controls.cjs`: 10/10 pass (resolver/icons, simultaneous E/F, fishing, release gate, safe-area scaling, native selection/cancellation, desktop fire isolation).
- `node scripts/test-gameplay.cjs`: 20 pass, 2 existing failures: bonus hunger is clamped on the next tick; purifier conversion can exceed remaining fuel during a large time step.
- Motorola Edge 60 Pro, installed Explorer 1.14.0/1925: native item icon overrides and + overflow confirmed. Hammer and fishing rod selected through native shortcuts. Rod cast produced an active line and Retract status; switching to hammer removed the line and restored hammer controls.
- Backpack open/close, assignment swapping and full panel bounds were checked on the phone. Crafting panel fits, close is accessible, and REQUIRES no longer wraps.
- During the preceding iteration, native cup filling, raft placement (including material deduction), and purifier placement were checked on the phone. Native pointer icons for hook, spear, cup and fishing rod rendered.
- Tutorial hide/reopen was checked for accidental charge activation after the input gate fix. The charge indicator now uses the viewport center.
- Temporary seeded inventory used for tool testing was removed. The final preview starts with the normal hook inventory.

### Remaining verification limits

This is not a complete end-to-end gameplay certification. Purifier pouring/fueling, food consumption, cooking and successful fishing catches have not all been exercised on the final native-shortcut build. Simultaneous E/F and catch behavior have resolver-level coverage, not complete device coverage. Desktop bindings have source/test coverage but no fresh interactive desktop walkthrough. Cook/storage/death/win panels share the new theme but have not all been visually exercised on device. Save/auth-server synchronization remains excluded.

Phone screenshots: `/tmp/raft-android-qa/redesign-final.png`, `native-overflow.png`, `native-switch-released.png`, `native-line-final.png`, `native-cancel-final.png`, `pack-held.png`, `modern-craft.png`. These local QA artifacts are not bundled into the scene.

## Final inventory and minimal HUD revision

This section supersedes the five-slot selector and native equipment shortcut design above.

- One 30-slot backpack accepts materials and equipment in any position. Moving an equipped item preserves its identity and durability. Broken or consumed equipment selects remaining equipment consistently on mobile and desktop.
- Change Tool opens a dropdown underneath the button, listing only equippable items from all 30 slots. Removed assignment editing and native equipment shortcuts. Desktop retains its five keyboard shortcuts; equipment elsewhere is available through the backpack Equip action.
- Icon-only HUD vitals and menu buttons use dark ocean panels and comfortable touch targets. Fixed double-applied safe-area insets. Removed overlapping floating debug/music controls and placed them inside the menu.
- Native world-action controls stay visible during the dropdown/release guard; world input remains blocked until release. Contextual action availability can still legitimately hide a button, such as equipping an empty cup away from water.
- Menu > Debug Tools > Start Debug Playtest now invokes the existing debug seeder. No temporary inventory fixture remains.

### Final verification

- TypeScript, production build and git diff whitespace check passed.
- Mobile controls: 12/12 tests passed.
- Gameplay: 23 passed, the same 2 known failures remain (bonus hunger clamp and purifier fuel during a large time step).
- Motorola / installed Explorer: activated existing DEBUG mode; verified populated 6-by-5 backpack with visible close control; moved equipped hook from first to last slot; verified the dropdown retained its selected state and listed hammer, rod, cup and hook while excluding ingredients; selected cup and observed dropdown close and held item update.
- Final menu layout was inspected on the phone without the previous debug/music overlap. Crafting and cooking layouts were inspected during this iteration; complete cooking, storage transfer, food, purifier and fishing catch device walkthroughs remain incomplete. Desktop has code/test coverage, not a fresh interactive walkthrough. Save/auth sync remains excluded.

Latest local screenshots: `/tmp/raft-android-qa/menu-refactored.png`, `debug-tools-final.png`, `backpack-30-final.png`, `backpack-reordered-final.png`, `equipment-all-slots-final.png`, `cup-equipped-final.png`.

## Structure proximity and icon revision

- Grill, purifier and storage now declare InteractionType.PROXIMITY with both current and legacy player-distance fields. E/F remain separate entries; entity-targeted SDK events route actions. Removed the parallel native global-input/raycast dispatch for structures.
- Renderer-selected proximity enter/leave updates the shared contextual target. Also accepts proximity-tagged HOVER_ENTER/LEAVE because the installed Godot Explorer reports these legacy events. No hand-written distance/facing approximation.
- Native icons use the complete catalog, fixing missing grill artwork from starter-layout-only lookup. Pour uses salt-water cup; drink uses fresh-water cup; fuel uses wood. Mobile structure text feedback is hidden; desktop retains keyboard hints.
- 13 mobile control tests pass, including grill/salt-water catalog artwork. TypeScript passes.
- Motorola: grill icon observed with crosshair beside the mesh (`proximity-grill-offmesh.png`); purifier showed simultaneous cup/wood icons and fuel interaction lit its flame (`proximity-fueled.png`). Successful off-target Cook activation and full range-boundary behavior are not yet confirmed.
- Explorer source selects proximity within a central screen region (radius one-third of the shorter viewport dimension), with a player-distance limit and nearest/priority arbitration. This is more restrictive than proximity anywhere around the player. No Explorer source changes made.

### Proximity text restored

Restored showFeedback on all actionable structure proximity entries on mobile as requested. Native icon overrides remain; the Explorer also renders the action hover text (Cook, Add salt water, Add wood, and state-dependent output prompts). Passive enter/leave tracking entries keep feedback disabled. This supersedes the mobile-text-hidden note above.

### Purifier secondary tooltip workaround

Explorer `scene_manager.rs` breaks after the first proximity tooltip entry. The purifier still declares separate primary and secondary actions, but only the primary description appears in that overlay. On mobile, the primary description now includes `· Add wood` while fuel can be added. Native water/wood icons and input routing remain separate; the extra description disappears while the fire burns. Build and 13 control tests pass. Device visual confirmation of this combined text remains pending; the phone was in Explorer settings during inspection. No Explorer source modified.

## Custom proximity actions (current design)

Supersedes native tooltip and combined-label workarounds. Proximity enter/leave selects the nearby structure; a scene-owned panel renders independent primary/secondary buttons with catalog icons and text. Action descriptions/visibility reuse the control resolver. Native structure hover feedback and duplicate E/F touch buttons are hidden. Keyboard proximity actions remain available. UI clicks revalidate target identity, menu state and action availability, then use the same action handlers with touch suppression.

The experimental Explorer patch was reverted; this works in the installed Explorer without an app update. Build/type check and 15 control tests pass, including stale-target rejection, menu blocking, separate action dispatch, and duplicate native button suppression. Motorola verified two distinct purifier buttons; pressing Add wood lit the flame, removed only Add wood, and retained Add salt water. Screenshots: `custom-proximity-reload.png`, `custom-proximity-fuel.png`, `custom-proximity-leave.png` under `/tmp/raft-android-qa`.

## Native hammer controls and revised artwork

- Replaced mobile text rotation/mode widgets with native E/F rotation icons and ACTION_3 mode toggle. POINTER retains commit behavior.
- Build checked icon edits the existing hammer artwork; erase variant is a demolition hammer with a red X and selected check. Prompts: build-control-icons.md.
- TypeScript and scene build passed; 17 targeted mobile-control tests passed.
- Motorola installed Explorer verified native icon overrides, build -> erase -> build toggling, rotation icons hidden in erase and restored in build. Mode switching left the targeted platform intact. Tapped clockwise control; raft preview geometry is symmetric, so visual angle change was not conclusively verified.
- Screenshots: /tmp/raft-android-qa/hammer-native-v2.png, hammer-erase.png, hammer-return-build.png.

## Final yellow highlight: Motorola verification

Tested the current scene on Motorola 0089321234 with installed Explorer 1.14.0.1925. Restarted local preview and reloaded to discard the old scene.

- Original hammer visible in Build; yellow gradient hammer visible in Erase.
- Matching mirrored rotation arrows render through native TouchScreenControls.
- Clockwise tap visibly rotated the preview boards 90 degrees; counterclockwise returned them to their original orientation. This supersedes the earlier inconclusive rotation check.
- Build -> Erase -> Build succeeds. Erase hides rotation, Build restores it; mode taps did not delete the targeted platform.
- Backpack hides native hammer actions; close button remains accessible.
- 17 mobile-control tests pass; latest scene build/type check passed.
- Evidence: docs/qa/hammer-controls/yellow-{build,clockwise,counterclockwise,erase}.png.

## Hammer usability iteration: distinct action and mode switch

Current design: large native action button, small alternate-tool mode switch, distinct coral eraser, soft cream selection glow. One near-crosshair mode hint replaces duplicated mobile placement/destruction hover text and red banner. Desktop retains its existing controls. Two separate native mode buttons were tested and rejected because installed Explorer collapsed them behind '+'.

Motorola testing found stale IA_POINTER isPressed after UI transitions. The release guard now accepts a fresh DOWN after the quiet interval as a new gesture; continuously held touches remain blocked. Regression coverage added (18 mobile tests pass). Scene build and type checks pass.

Device retest: equip hammer, select erase, remove a debug tile, select build, rotate, place a new tile (material counts decrease), open/close backpack. Distinct icons and soft eraser glow render; single prompt is legible without native hover overlap. Screenshots in docs/qa/hammer-controls/final-*.png. No save/auth synchronization testing.
