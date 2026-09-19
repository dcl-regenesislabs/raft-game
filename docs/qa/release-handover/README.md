# Deployment versions and state handover — 2026-09-19

## Release policy

`src/config/release.ts` has two separate concepts:

- `WORLD_COMPATIBILITY`: an explicit positive integer. Keep it unchanged for compatible code/art/UI updates. Increment it when an update must intentionally discard the shared world and all personal state. The replacement then starts a fresh 4×4 raft in a new generation. A save-format/wire/rules change is not automatically inferred from Git diffs.
- `RELEASE`: a unique deployment identity, sequence and predecessor. `npm run deploy` runs `scripts/prepare-release.mjs` before building. It stamps both the compiled code and published `raft-release.json`, using Git HEAD plus a monotonic timestamp. It reads the current published predecessor; unavailable/malformed metadata aborts publication instead of guessing.

Use `npm run deploy` or the main-branch deployment workflow. Direct SDK publication bypasses preparation and is not supported by this handover mechanism. Keep the development `release.ts` and `IS_PRODUCTION = false` committed; production stamping happens in the publishing workspace. `node scripts/prepare-release.mjs --dry-run` checks predecessor discovery without changing files or storage. CI runs regression suites before publication.

## Compatible deployment

1. Servers poll the publisher's Worlds content metadata every five seconds. Clients also check every fifteen seconds, independently of the old server's room.
2. When an old server detects the new deployment, it stops gameplay and accepting commands, finishes any ongoing backup, saves its final in-memory state and writes a handoff acknowledgement. Players see the full-screen update gate and can no longer play the old version.
3. The replacement uses its own manifest namespace. On first arrival it waits up to twenty seconds for the predecessor's handoff; it then imports that final checkpoint. If the predecessor is absent/unreachable, it falls back to its last completed backup. This fallback can lose unbacked progress; it is not a zero-loss handover guarantee.
4. Players re-enter using the new scene and receive normal authoritative snapshots. Personal inventory/vitals, shared construction/storage/progression, generation and receipts carry over.

Each deployment has a separate manifest/chunk namespace. An old server's late storage write cannot overwrite the replacement's world. The preceding namespaces remain available for diagnosis/recovery. This does **not** provide a distributed lock for duplicate server instances of the *same* deployment; hosting must still run one authority per scene version.

If an intervening deployment had no visitors, it has no checkpoint. The replacement follows immutable predecessor descriptors to the last running world. It fails closed if this chain is missing, malformed, unavailable or exceeds 32 skipped deployments; it never treats that as permission to reset. Old deployment namespaces are retained; automated cross-deployment archival/garbage collection is not included.

## Incompatible deployment

Increment `WORLD_COMPATIBILITY`, then use the normal publishing command. After resolving the predecessor, the new authority creates a new generation with 16 bare platforms and no player records. New arrivals get starter supplies. The fresh state must be saved before gameplay begins. The old namespace is retained, and old clients are gated until they re-enter. Compatibility decreases are rejected by the publishing script; rollback publication needs an explicit forward compatibility policy.

Changing the starting raft size alone does not erase an existing world. The current compatibility value remains 1.

## Loaded clients and outages

- New version announcements are carried in an appended, stable JSON message envelope. Existing message layouts/order are preserved. Joining production gameplay also requires a matching deployment identity in a separate version handshake.
- A client update notice discards unconfirmed predictions and blocks movement/actions. A later old heartbeat cannot dismiss it.
- A server that cannot refresh release metadata for thirty seconds pauses gameplay until verification succeeds. Lookup/storage failures never trigger a new raft.
- The dialog offers **RE-ENTER WORLD** using Decentraland's realm action. Some Explorers retain downloaded scene versions after script reload or same-realm navigation; the dialog also tells players to restart Decentraland if needed. There is no claimed universal forced-reload API.
- **Bootstrap limitation:** clients/servers deployed before this feature cannot retroactively acquire the update watcher/dialog. The first deployment inherits the last legacy cooperative backup, and those already-loaded legacy clients need to re-enter manually. Future releases have the handoff and update gate.
- Version checks depend on the Worlds service exposing the new entity. Asset-pipeline completion and production client behavior still require hosted verification.

## Verification

Node 22.23.2; installed SDK unchanged. All `scripts/test-*.cjs` and the scene build passed. See `regressions.log` and `build.log`.

`test-release-lifecycle.cjs` runs the actual server loop against controlled publication metadata/storage: final accepted action checkpoint, retired command rejection, compatible inheritance, isolated late writes, compatibility reset, deployments without visitors, failed reads, immutable descriptor caching and monotonic versions. The server/client integration suite checks that outdated clients stop actions and remain gated after old heartbeats.

The publishing preparation dry run read the actual Worlds metadata successfully and identified the legacy predecessor. It made no live storage writes and published nothing.

`phone-update-required.png` shows the actual React-ECS dialog in Godot Explorer on the connected Motorola Edge 60 Pro. A temporary local notice injection was used only for this visual check and removed afterward. The production re-entry button was not used to claim a hosted upgrade test. During development, adding a field to the existing hello schema produced mixed-version decode errors; the implementation was changed to preserve that schema and use appended version envelopes instead.

No deployment/push was performed. Hosted two-version handover, asset readiness, device re-entry behavior and same-version single-writer hosting remain release checks.

Platform references: [current troubleshooting guidance](https://github.com/decentraland/docs/blob/main/creator/sdk7/debugging/troubleshooting.md), [realm navigation](https://docs.decentraland.org/creator/scenes-sdk7/interactivity/external-links).
