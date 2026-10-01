# Physical Android UI and input walkthrough

Tested via user-authorized ADB on Motorola Edge 60 Pro, physical landscape display 2712×1220, Decentraland 1.14.1 (2114, visible build `5aef36d-prod`). The device loaded the current local build through USB port reverse `tcp:8001`, using `decentraland://open?preview=http%3A%2F%2F127.0.0.1%3A8001&position=25%2C25`. This was the cleaned build after removal of the drop-test overlay, not the deployed World.

## Results

| Flow | Observed result | Evidence |
| --- | --- | --- |
| Startup and HUD | Loaded shared raft. Current single collapsed guide and updated tool labels visible; no temporary diagnostics. HUD controls fit inside the physical screen and do not overlap native controls. | 02-scene.png |
| Backpack | Opened all 25 slots in a centered panel; close button and all rows visible. Crosshair, joystick and world action buttons hidden. | 03-inventory.png |
| Inventory transfer | Tapped potato stack in slot 2 then slot 3; both potatoes moved to slot 3. | 04-inventory-moved.png |
| Close and movement | Close restored crosshair/actions. Joystick swipe moved the player relative to the raft; subsequent backward movement also worked. | 05-movement.png, 20-walk-back.png |
| Guide | Opened a single mobile guide with readable body copy and CLOSE GUIDE. Closing returned to its compact summary without skipping progression. Guide is nonmodal and retains world controls. | 06-guide.png |
| Craft menu | Categories, recipe details, costs and disabled NEED ITEMS action visible. Crosshair/actions hidden. | 07-crafting.png |
| Investigation | Opened from crafting; readable Locked/Unlocked labels. Next-page button changed 1/2 to 2/2 and revealed remaining rewards. | 08-investigation.png, 09-research-page2.png |
| Outside dismissal | Tapping outside crafting closed it; no visible hook action leaked through. | Followed by 10-settings.png |
| Settings | Opened centered panel and resumed successfully; crosshair and world actions hidden while open. Did not reset the shared world. | 10-settings.png |
| Equipment picker | Opened Hands/Hook/Potato list. Current item marked ON. Crosshair and world action controls hidden while picker open. | 11-tool-picker.png |
| Equip and eat | Selected potato; held-item artwork and action icon changed. A 250 ms press consumed exactly one potato, reducing stack 2→1. | 12-potato-equipped.png, 14-food-count.png, 15-food-held.png |
| Hook | Re-equipped hook, held action for 1100 ms; charge bar/raised hook appeared and later returned to idle. No successful salvage catch established. | 16-hook-cast.png, 17-hook-return.png |
| Camera | Right-side swipe changed camera direction/pitch; reverse swipe restored view. | 18-look.png, 20-walk-back.png |
| Jump | 180 ms jump press visibly raised camera above raft; player subsequently returned to deck. | 19-jump.png, 20-walk-back.png |

## Caveats and remaining coverage

- One instantaneous `adb input tap` on the potato action did not consume an item; a deliberate 250 ms press did. This could reflect very short injected input/frame timing. Do not treat short physical taps as validated until manually reproduced or instrumented.
- Visible layout is consistent on this landscape device: menu text fits, controls are reachable, and crosshair visibility matches the tested modal states. This does not establish every screen size or orientation.
- This is an on-device UI/input walkthrough, not a complete campaign run. Successful resource catching, completed crafting, construction, station cooking/purification, fishing, combat, death/respawn and save/reconnect were not exercised here.
- No error-level entries matched error/exception/panic/fatal in the sampled process-specific logcat output; this is a limited sample, not a full-session crash audit.
- No scene source or phone settings changed during this pass. Test inventory was rearranged and one potato consumed in the local preview. Left the phone on the raft with the hook equipped and menus closed; USB reverse remains active for continued preview use.

## Follow-up: hide action icons during hook hold

Implemented after the walkthrough at the user's request. Mobile action-button artwork becomes transparent while the hook is charging; input bindings and hit areas stay mounted so the held touch is not interrupted. Mobile proximity actions also hide during charging. Release or cancellation restores the action icons.

Built successfully and passed custom-touch UI, mobile-controls (26 cases), and gameplay regressions. The custom-touch regression verifies identical bindings and hit-area geometry while hidden, plus artwork restoration afterward.

On the same physical phone, held the hook action for four seconds. `22-hook-holding.png` shows the charge meter with the right-side action icons hidden. `23-hook-released.png` shows the cast in flight and both hook/jump icons restored immediately after release. The preview refresh stalled; restarting the app restored loading of the current build. No test-only scene controls were added.

## 2026-10-01: false construction reach errors

Fixed predicted construction identities: local IDs now remain stable across unrelated server allocations (other players and debris), and queued target/station references are replaced with confirmed IDs on acknowledgement. Covers build/place and retained starter tiles after dismantling. Stale/replaced structures now have a separate error; actual distance validation remains enforced.

Reproduced the old failure in the cooperative network integration test: another player places a structure while a build + placement are queued; the placement is rejected and the tile remains empty. The same test passes after the fix. Added coverage for place + station crafting, dismantle + replacement, prediction rebasing, and distinct stale-vs-distance rejection.

Validation: all four scripts/test-cooperative*.cjs suites pass, npm run build passes (including type checking), git diff --check passes. Reloaded the updated port-8001 preview on the connected Motorola (Explorer 1.14.1). Movement and a nearby rain collector interaction succeeded: Drink (4) became Drink (3), with no reach error (screenshots 24–25). The precise concurrent allocation race is covered by the network integration test; it was not reproduced with simultaneous physical devices. No deployment performed.
