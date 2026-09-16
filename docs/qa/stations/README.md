# Single-player station crafting verification — 2026-09-15

## Automated checks

Build and TypeScript checks pass. 91 automated checks pass:

- Gameplay: 28
- Mobile controls: 21
- UI: 18
- Expansion gameplay/station integration: 23
- Scene configuration: 1

The expansion tests execute real production, station context, craft transaction, power, pathfinding, and raid modules against an in-memory ECS; rendering/input are mocked. Every one of the 60 craft recipes is tested at its required workplace, including rejection from basic crafting. Metal plates are tested through smelting, not instant crafting.

## Motorola Edge 60 Pro

Installed Explorer: 1.14.0.1925 staging. Tested through ADB against the local SDK preview, without modifying Explorer.

Verified using actual on-screen taps:

- Workbench proximity action opens Workbench-only recipes and six relevant category controls.
- Crafting an Armory consumes six wood, two plates, and two nails. Its craft button stays in the bottom-right footer.
- Outside tap dismisses the workbench; the HUD saw reopens **Basic crafting**, with only the twelve basic recipes.
- Armory, Engineering bench, and Research table each open their own recipe lists. Entire unrelated categories disappear. The Research table lists four recipes; Engineering lists eight.
- Smelter presents separate Load Scrap and Add Wood controls near the crosshair with distinct icons. Loading consumes exactly two metal; fueling consumes one wood. After twenty process seconds, collection adds one metal plate. Ten unused fuel seconds remain.
- Close controls and craft footers stay visible within the phone safe area. Captured menus rendered around 55–60 FPS during these checks; this is not a sustained performance benchmark.

The temporary local command helper was used only to position the player, supply test materials, inspect state, and advance the smelter clock. The interactions and craft/close actions above used ADB taps. The helper was removed and the final scene rebuilt/reloaded afterward.

## Limits

Full survival-to-radio progression, every construction placement, and long raid balancing have **not** been manually completed on the phone. Core mechanics have automated coverage; the combat expansion and original low-poly art are a first playable implementation. Navigation currently changes salvage arrivals rather than moving the raft. Multiplayer and auth-server sync remain excluded.

Screenshots in this folder show the actual phone UI, not mockups.
