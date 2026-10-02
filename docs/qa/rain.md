# Passing rain cloud

Implemented October 1, 2026. Runtime weather uses the existing saved expansion clock in solo play and authoritative world seconds in cooperative play. No save schema changes.

- Cloud approaches at 1:40; rain and collector splashes start at 2:00.
- Rain stops at 3:00; the cloud shrinks away by 3:20. Repeats every three minutes.
- Five soft gray sphere lobes drift across the raft. Rain uses small pale blue particles, gravity and slight wind. The cloud and shower adapt to raft bounds.
- Up to eight nearby collectors show catchment splashes, including full collectors. Water production remains one drink per 15 rain seconds, capped at four.
- Weather budget is at most 516 live particles: 420 rain plus eight collector emitters capped at 12 each.
- Lobby/startup, death, victory and disconnected states clear effects. Removing or replacing a collector removes its emitter.

Automated checks: `test-rain.cjs` covers weather boundaries, production cadence, cloud arrival/departure, raft coverage, particle budget, collector removal, multiplayer clock and cleanup. Expansion, cooperative, gameplay and progression suites pass. Initial build/type check passed on Node 26. Final build is checked on Node 22, as required by package.json. Regression scripts passed on Node 20, but the installed SDK build command cannot run on Node 20 because it uses `fs.globSync`.

Visual QA remains pending: no Explorer preview was running in the available desktop session. The particle skill documents Unity-only particle rendering; mobile Godot requires confirmation against the actual client version. Ordinary cloud geometry does not require particle support.

Manual checks in Unity Explorer and mobile:

1. Place a collector, observe 1:40–3:20, and confirm the cloud moves overhead and rain falls downward to deck/water height.
2. Check catchment splash alignment on the collector canopy, including rotated collectors and tower supports.
3. Confirm four drinks accumulate during a complete shower, with no production during dry weather. Join a second client during rain and compare weather and collector prompts.
4. Expand the raft; check shower coverage from its edges. Place more than eight collectors and approach different groups to check bounded nearby effects.
5. Remove collectors while raining; return to lobby, reset, die/respawn and reconnect. Confirm there are no orphan effects or duplicate clouds.
6. Check desktop/mobile frame rate, cloud silhouette and rain readability. Particle appearance and mobile support have not been visually verified.
