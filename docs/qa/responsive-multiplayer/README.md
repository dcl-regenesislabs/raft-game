# Responsive cooperative multiplayer — 2026-09-19

This revision supersedes the per-action durability and one-second presentation behavior described in `../cooperative/README.md`.

## Behavior

- The authority validates and applies actions sequentially in memory. Commands are serviced on a 50 ms scheduler; continuous simulation/state updates run at 200 ms. Neither path waits for routine storage writes.
- Background backups run every 60 seconds and after a peer departure is detected (heartbeat timeout: 8 seconds). A complete world/player checkpoint keeps both sides of chest transfers together. Failed or ambiguous backups retain the exact candidate until reconciled, then capture newer live state. Writes remain serialized.
- New-world creation and administrator reset still wait for durable storage. Reset must not resurrect an old generation after a restart. Startup errors never create a replacement world. A detected competing writer stops the authority.
- **Durability tradeoff:** normal action confirmation now means accepted in server memory, not saved in the database. Abrupt process loss can roll back to the last completed backup—normally up to about a minute plus write latency, longer during an outage. Graceful departure requests a backup; it cannot guarantee a write if the process is killed first.
- The client keeps a confirmed snapshot and a bounded queue of eight local actions. Shared rules predict inventory, collection and construction immediately. Only the queue head is sent; subsequent actions remain visibly predicted and are rebased as confirmations arrive. Lost acknowledgements recover through session receipts, retries are deduplicated, and rejected predictions restore inventory/geometry from the authority. Predicted construction references are remapped to their confirmed identities.
- Random rewards are provisional until confirmation. Death/respawn and reset are not predicted.
- Debris moves every render frame using velocity and bounded extrapolation (0.5 seconds), with blended corrections. Enemies/island presentation also blends between updates. Local water bobbing, rotation and submersion under raft tiles are restored. Presentation never mutates server state.
- Hook pickups create a cosmetic item that immediately travels with the returning hook. Rejected pickups cancel that cosmetic copy. Returning the hook never grants a second inventory reward. Building plays local feedback immediately; the repeated “Saved” toast is removed.
- Outgoing snapshot chunks use round-robin recipient scheduling and a 200-chunk/second budget, with bounded queues. This prevents unbounded host-call bursts; it does not establish acceptable latency at the 32-player capacity limit.

## Verification

Node 22.23.2, existing SDK pins unchanged. All `scripts/test-*.cjs` suites and the scene build passed; see `regressions.log` and `build.log`.

New/updated behavior checks:

- Both competing clients show a platform and debit materials before any network tick; reconciliation preserves one platform and refunds the loser. Normal actions do not write the database.
- Lost action acknowledgements and a dropped delta recover through snapshots; a queue of predicted inventory moves drains correctly.
- Gameplay remains available through a storage outage lasting over one backup interval. Recovery writes the backup; disconnect/reconnect and reset continue to work.
- A deliberately stalled backup cannot prevent live mutations. Uncertain writes retry the same immutable snapshot.
- Hook collection is exercised against mocked ECS entities: immediate following, rejection cleanup, no cosmetic allocations when enqueue fails, no double inventory grants on reel completion.
- Motion corrections blend rather than teleport, remain comparable at 30/60/120 FPS, and stop extrapolating after the bounded horizon.

## Phone observations

Motorola Edge 60 Pro, Godot Explorer v1.14.0.2022-f8741d1-prod, local preview through ADB reverse. Existing local world was retained; no production data was changed.

Phone autojoin/respawn, water movement and touch hook casts were exercised. `phone-motion.mp4` records the water motion and cast. A development hot reload remained on the synchronization overlay; a fresh scene reload recovered. This remains a preview/handover observation, not evidence of flawless recovery under all deployment conditions.

| Sample | Duration | Average FPS | Frame p95 | Frame p99 | Frames >50 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Water motion, stationary camera, recorder off | 29.92 s | 58.56 | 16.85 ms | 17.09 ms | 2 |
| Water motion and touch casting, recorder on | 29.83 s | 54.07 | 33.33 ms | 33.52 ms | 5 |

Measured actual-present SurfaceFlinger timestamps, excluding initial history. Raw data: `phone-fps-without-recording.json` and `phone-fps.json`. Recording has measurable overhead; these short samples do not establish sustained thermal or maximum-world performance. `server-cpu-benchmark.json` measures headless CPU work only.

## Remaining in-world verification

Two physical clients racing the same placement/pickup, confirmed hook attachment/reel pickup under adverse network conditions, full construction/crafting/storage playthrough, high player counts, large raft GPU stress and sustained thermal load still need testing. Automated conflict/hook coverage is not equivalent to that physical multiplayer validation. Production cold starts, exclusive writer handover and abrupt termination around backups also remain hosted release checks.

Validation above was completed locally before the requested commit/push. Hosted deployment verification remains outstanding. `IS_PRODUCTION` remains false.
