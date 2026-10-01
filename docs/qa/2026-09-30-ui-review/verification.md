# Bevy Web UI review — 2026-09-30

## Revision and scope

The initial test used `main` at `2e98c3a`. After the user questioned the older-looking HUD, a fresh remote inspection found the unmerged rework on `origin/feat/web-hud-and-starter-raft`, `dd72f58`. **The current review refers to that feature branch.** Screenshots prefixed `feature-` show it; screenshots beginning `desktop-` show the older main and must not be used to judge the rework.

The feature branch was built in an isolated worktree at `/tmp/raft-game-ui-review` and served on port 8001 with the pinned SDK, Node 22.23.3, Bevy Web (zone), and its local authoritative server. The original checkout remains on main. No gameplay or UI source was edited, merged, pushed, or deployed.

## Virtual scaling

Official documentation: https://docs.decentraland.org/creator/scenes-sdk7/2d-ui/onscreen-ui

The documented factor is `Math.min(canvasWidth / virtualWidth, canvasHeight / virtualHeight)`. Numeric dimensions and font sizes are scaled by the SDK. The installed `@dcl/react-ecs` implementation explicitly excludes `devicePixelRatio` from this calculation.

The feature branch correctly configures `virtualWidth: 1920, virtualHeight: 1080, screenInset: 'none'` in `src/ui/index.tsx`. This pinned SDK overrides 16:9 virtual dimensions to 1600×720 on mobile. `src/ui/mobileLayout.ts` mirrors that platform choice and converts canvas-pixel insets to virtual coordinates by dividing by the same factor. Desktop uses the SDK `InteractableArea` wrapper. No evidence of a second scene-side Retina multiplier was found.

Do not change the virtual scaling to compensate for the old main screenshot. Main used 1600×720 on both platforms and bypassed desktop interactable-area positioning.

## Feature-branch findings

- The new desktop HUD is substantially cleaner: vitals and menu icons are grouped at the top right; the tutorial is beside the minimap; the tool bar is compact at the bottom. The old guide/vitals collision is absent in the inspected normal viewport.
- Backpack, crafting and investigation panels open and close, fit inside the viewport, and retain visible controls. All 25 backpack slots are visible.
- Small-window readability needs attention. At 960×540, the correct 1920×1080 virtual scale is 0.5, so 14-unit labels become 7 canvas pixels. Recipe descriptions, category labels and secondary text are difficult to read. Consider larger design fonts or an adaptive compact layout while preserving SDK virtual scaling.
- Investigation unlocked-recipe check marks appear as empty boxes in Bevy Web, while diamond markers render. See `src/ui/components/Investigation.tsx` (the check-mark prefixes) and `feature-investigation.png`. Prefer a supported icon/image or text status.
- Build passes. Twelve of thirteen regression scripts pass. `scripts/test-cooperative.cjs:404` fails in the delayed-object replacement test: it destroys starter tile `1,0`, then expects a replacement instance. The new `isStarterTile` protection rejects that removal, so the fixture no longer reaches its intended replacement scenario. Move that scenario to an added, removable expansion tile and retain the stale-action assertions.

## Other setup observations

The original checkout had old installed dependencies, so its first build failed on the missing `TouchScreenControls` export. Installing the SDK versions already declared in package.json resolved the build. The original package-lock.json is out of sync with package.json, causing `npm ci` to fail. Its dependency files were not changed during this review.

The first preview launch through nested `npm exec` failed to start the headless process. Launching the pinned SDK CLI directly with Node 22 resolved it. The feature server reached its first tick and logged cooperative authority startup. Missing local storage-manifest responses were initial empty-preview state, not a production save test.

## Phone status and limits

ADB detects the Motorola Edge 60 Pro running Android 16. The installed `org.decentraland.godotexplorer` reports versionName 1.14.1 and versionCode 2114. This is the installed version, not independently verified as the newest available release.

**On-device visual/input verification is pending.** The computer-control interface could not access the scrcpy mirror. Explicit permission to use ADB for opening the preview, touches and screenshots was requested and had not been received when these notes were written. No phone UI pass is claimed.

Desktop checks are a visual/menu smoke test, not a complete survival campaign, crafting/production/combat run, or sustained performance benchmark. Temporary browser viewport overrides were reset. No Mac-specific scaling fix was applied.
