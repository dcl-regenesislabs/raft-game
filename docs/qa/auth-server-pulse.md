# Auth-server / Pulse integration — 2026-09-17

SDK, ECS and JS runtime are pinned to `7.29.1-35154657340.commit-e2bbcc9`.
The ECS override keeps the SDK and asset packs on one ECS instance and permits
the prerelease version despite asset-packs' stable-only peer range.

Node 22 is required. The previous repository guideline and CI configuration used
Node 20; an actual Node 20.20.2 build failed because the new SDK calls
`fs.globSync`. Build and deployment workflows now use Node 22.

The server branch starts the existing per-wallet save and ranking service.
The message shim is removed and server code is included in TypeScript checking.
Gameplay simulation remains client-side; scores and save contents are still
client-reported. This change does not make gameplay or rankings cheat-proof.
Storage keys remain `progress:full` and `ranking:full:`.

Clients wait for transient server heartbeats before sending requests, expire
readiness after six seconds, and re-probe after reconnecting. A manual load waits
for an outstanding save-existence probe so the probe cannot swallow the load.
Storage writes returning false produce failed acknowledgements.

## Verification

- Node 22.23.2: `npm run build` passes, including server type checking.
- All existing `scripts/test-*.cjs` suites passed.
- `node scripts/test-server-integration.cjs` passes: cold start, heartbeat expiry,
  reconnect, wallet scoping, failed persistence, probe/manual-load ordering and
  duplicate load results.
- `npm ls @dcl/sdk @dcl/ecs @dcl/js-runtime --depth=2` confirms one deduplicated
  ECS version and matching SDK/runtime versions.
- Started a separate local preview on port 8015, without opening an Explorer:

  ```sh
  RUST_LOG='warn,scene_runner::renderer_context=info,comms=info' npm start -- --no-client --port 8015
  ```

  The SDK launched `bevy-headless-server@0.1.0-35098753248.commit-508acb8`.
  Observed server log excerpts:

  ```text
  pulse: configured for pulse-server.decentraland.org:7777 (base domain)
  pulse: local scene development realm resolved to lsd:b64-…
  pulse: connected
  pulse: scene-listener handshake (1 realms, 1 rects) sent
  pulse: handshake accepted
  "[SERVER] Save and ranking service started"
  starting livekit protocol
  ```

  Hot reload also restarted the scene's save/ranking service successfully.
  The temporary preview was stopped after verification.

## Remaining in-world verification

Update: the Android save → scene reload → load round trip subsequently passed
on the connected phone. See [phone verification](auth-server-phone/verification.md)
for screenshots, transport logs and the restored-state comparison. The limitations
below describe the original headless-only run; production cold start and ranking
submission remain unverified.

A real desktop/mobile player save → reload → load round trip, ranking submission,
and production cold start were not exercised. Pulse handshake acceptance verifies
the server's Pulse connection, not the complete player-to-storage round trip.
Nothing was deployed. Saves retain the existing single-message JSON format and
its transport-size constraint; large-save chunking is not part of this update.

Use `npm start` for the production preview stack, or
`npm start -- --bevy-web --dclenv zone` for the SDK's zone preview stack.
