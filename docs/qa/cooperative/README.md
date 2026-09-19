# Persistent cooperative raft — implementation and verification

Date: 2026-09-19. Local preview only; **not released to raft.dcl.eth**.

## Implemented architecture

`src/multiplayer/` contains plain state, inventory and gameplay reducers, continuous simulation, chunk transport, and the durable commit coordinator. `src/server/cooperativeServer.ts` owns the world. Client handlers submit actions; `src/client/worldRenderer.ts` projects committed state into ECS entities.

- First confirmed absence initializes 81 bare platforms on -4…4. No lobby, debug supplies or avatar-hiding gameplay area. New wallets get a hook and two potatoes.
- Inventories, vitals and request receipts are private per wallet. Construction, containers, recipes, production, encounters and campaign state are shared.
- A candidate transaction either commits in full or is discarded. Receipts and changes are published only after the immutable chunks and final manifest are durable. Uncertain writes retry the same commit; dependent work waits.
- Tri-state storage reads distinguish HTTP 404 from outages and malformed stored values. Corrupt or incompatible state blocks startup; legacy `progress:full` saves remain untouched.
- Static network registration, heartbeat/join handshake, bounded chunks, checksums, monotonic revisions, buffered deltas, gap recovery and generation invalidation. Tile/construction incarnations prevent delayed actions from touching replacement objects in the same cell.
- One live session per wallet. Eight recent receipt records are retained; retired session timestamps prevent evicted sessions from reopening their request sequence.
- Only the authenticated configured administrator can commit a new generation. Its menu requires confirmation. Connected clients resynchronize; offline records are invalidated.
- Personal death/respawn retains items; the center remains clear and indestructible. Empty-world simulation pauses. Menus do not pause shared survival. Campaign success permits continued play.
- Shared snapshot/delta work is reused across recipients. Unchanged platform records do not rebuild ECS entities. Initial configurable budgets: 32 active wallets, 256 tiles, 64 structures, 80 salvage objects, 64 queued requests, 4 MiB durable state. These are capacity bounds, not a guarantee of GPU performance at maximum occupancy.

## Automated verification

See `regressions.log` and `build.log` for the final commands and output. Node 22.23.2; installed SDK pins unchanged.

- All `scripts/test-*.cjs` suites.
- 19 authoritative tests in `test-cooperative.cjs`: initial raft, conflicting placement, deduplication, pickup races, full-bag rollback, shared unlocks, atomic chest transfers and durability, death, reset, empty/offline behavior, durable reload, partial writes, uncertain manifest publication, malformed reads, competing writers, reordered/duplicated/chunked data, revision gaps, cooking, water, production, fishing, combat cooldown/ammunition and stale object incarnations.
- `test-cooperative-network.cjs` runs the actual server coordinator and client synchronization modules with mocked ECS/transport/storage. Covers simultaneous joins, dropped snapshot chunk, reversed delivery, owner-only snapshots, SDK callbacks without client context, conflicting builds, failed commits/retry, empty-world pause, reconnects, duplicate wallets, loading-time survival protection, and online/offline reset recovery. Also verifies the HTTP storage adapter's absence/error distinction.
- CPU stress harness: `node scripts/benchmark-cooperative.cjs`. Results in `server-cpu-benchmark.json`. Includes 32 wallets, 64 producing devices, 80 salvage objects and eight enemies, at 81 and 256 starting tiles. Excludes service latency, ECS rendering and GPU; it is not an FPS measurement.

## Phone evidence

Motorola Edge 60 Pro, Godot Explorer `v1.14.0.2022-f8741d1-prod`, 2712×1220 capture. ADB was connected during this work despite the earlier plan's device inventory. Preview used local port 8002 and the SDK's pulse realm. No production storage was used.

1. `01-phone-shared-raft.png`: automatic join and the bare raft.
2. `02-phone-settings.png`: ordinary wallet menu with no Save/Load/Restart/Lobby/reset control.
3. `03-phone-committed-inventory.png`: moving both starter potatoes from slot 1 to slot 2 committed through the authority.
4. `04-phone-reloaded-inventory.png`: the same inventory layout survived scene reload and server hot reload.
5. `05-phone-hook-cast.png`: walking and native touch hook casting.
6. `06-phone-gathering-committed.png`: pickup advanced the shared objective. Durable revision 985 contained one plastic, hook durability 39, one remaining potato and the successful receipt. The potato had been consumed through the server previously.

7. `07-phone-persisted-death.png`: death persisted through reload after the idle survival test.
8. `08-phone-personal-respawn.png`: personal respawn restored vitals while keeping the worn hook, plastic and remaining potato. Durable revision 1615 retained generation 1 and the 77 surviving platforms.

Preview reloads failed with `Uncaught SyntaxError: Unexpected end of input` and later `Unexpected token ')'` while build/watch processes were rewriting the bundle. `node --check bin/index.js` passed for the completed bundle, and fresh phone reloads recovered. `09-phone-final-build.png` shows the final build running after reload. Concurrent preview/build output writes are the suspected cause; this was not established as a gameplay exception. Avoid rebuilding the served bundle during final hosted verification.

Opening the backpack/settings did not stop salvage, survival or shark damage. The initially bare raft lost outer platforms to the running shark simulation during testing; reload did not restore them. The protected center remained available.

### Presented-frame measurements

Measured the Godot SurfaceView's actual-present timestamps through SurfaceFlinger, deduplicating repeated samples. Android `gfxinfo` measures the View wrapper and was deliberately not used as game FPS.

| Sample | Duration | Average FPS | Frame p95 | Frame p99 | Frames >50 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bare raft, salvage and survival, stationary camera | 31.97 s | 59.31 | 16.87 ms | 17.03 ms | 2 |
| Backpack, equipment, walking and hook input | 29.83 s | 59.19 | 16.85 ms | 17.06 ms | 2 |

Raw intervals are in `phone-fps-baseline.json` and `phone-fps-interactions.json`. The baseline includes approximately two seconds of initial SurfaceFlinger history. The reusable sampler excludes that history:

```sh
python3 scripts/measure-mobile-fps.py --seconds 30 --output /tmp/raft-fps.json --scenario 'Describe the activity'
```

The scene panel showed approximately 414K triangles, 319 entities, 105 meshes and 101 colliders during the initial raft/salvage sample. These short measurements establish the observed baseline only; they do not establish sustained thermal performance or performance at the configured world limits.

## Release gates still open

- Simultaneous physical desktop + phone play. The available desktop browser stopped at “Enable GPU acceleration” because WebGPU was unavailable. No desktop GPU/browser security settings were changed.
- On-device crafting, storage races, building, combat and reset across two actual clients. These paths have automated coverage, but the phone smoke test does not replace full in-world verification.
- Large built raft/maximum-device GPU stress, join/reset frame spikes and a sustained thermal soak. Confirmed world movement currently arrives at checkpoint cadence (normally one second); further presentation smoothing may be desirable under remote latency.
- An isolated hosted deployment: cold start, process termination around storage publication, empty-host suspension/resume and deployment handover. In-memory fault injection and local hot reload are not evidence of production infrastructure behavior.
- Verify exclusive server ownership during handover. Storage has no CAS. The manifest ownership check detects an already-published competing revision but cannot exclude simultaneous writers that both pass the check. Stop/drain the old authority before starting its replacement; do not enable overlapping deployment versions.
- Tune service/storage latency and capacity against the hosted environment. Transactions intentionally wait for storage. Long outages stop dependent work, and continuous simulation may lose up to its uncommitted checkpoint or slow while writes stall.

`IS_PRODUCTION` remains false. Unrelated model/art work was preserved. No deploy, push or production reset was performed.
