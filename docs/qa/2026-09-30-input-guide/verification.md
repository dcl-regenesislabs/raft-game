# Sky-drop diagnostic

Local Bevy Web preview on port 8001, branch `fix/desktop-hud-edge-spacing`.

- Built the current scene successfully, restarted the no-watch preview, and reloaded Chrome.
- Temporary `InputProbe` UI provides a repeatable teleport to (400, 36, 400), twenty metres above water level.
- Clicking the button changed the visible player position from (400, 17, 400) to (400, 36, 400).
- Subsequent observations remained at exactly Y=36; no fall occurred. Clicking the world and sending W did not change the displayed position. Automated key presses are brief, so they do not establish held-key behavior.
- The scene remained animated. The probe reported ready=true, fishing=false, disableWalk=false, disableJog=false, disableJump=false.
- This makes the normal raft spawn collision unlikely to be the sole cause. The underlying movement/gravity failure is still unresolved.
- Screenshot: `sky-drop-suspended.png`.
- The diagnostic button remains temporarily available for the user's requested test; no normal spawn point was changed and nothing was deployed.

Also loaded the pending consolidated guide and pointer-release changes. UI review (22 cases), mobile controls (26 cases), and build passed. Physical-phone crosshair behavior and browser menu transition behavior still require live verification.

## Production Explorer comparison

Switched the same local preview to `https://decentraland.org/bevy-web/`, retaining the local realm and gatekeeper. No scene rebuild or physics changes between comparisons.

- Normal spawn settled at Y=16.300, matching the raft's floor collider.
- Repeated the sky-drop button: observed Y=35.958 in flight, then Y=16.300 on the raft.
- Gravity and landing therefore work on `.org`; the suspension reproduced only on `.zone` in this comparison. This supports an Explorer environment regression rather than the raft spawn collider as the cause of suspension.
- Screenshot: `org-drop-landed.png`. Browser left on `.org` for further testing. Held-key walking still needs confirmation; a brief automated W press did not establish it.

## Diagnostic cleanup

Removed `InputProbe.tsx`, its UI import/render call, the position/input overlay, and the sky-drop button after the comparison. Normal spawn logic was never modified. Rebuilt successfully and restarted the local preview without the `.zone` environment option. Regression scripts and QA evidence remain as development records, with no diagnostic UI in the scene.
