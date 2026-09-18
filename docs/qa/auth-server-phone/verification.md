# Android save/load round trip — 2026-09-17

Result: PASS against the local preview server using the connected Motorola Edge
60 Pro over USB ADB. The installed Godot Explorer identifies itself as
`v1.13.3.1909-6f71f4e-prod`. No APK installation or application-data clearing was
needed.

## Procedure and results

1. Started the auth-server SDK preview on port 8000 with Bevy scene/comms logging.
   Used the existing ADB reverse mapping `tcp:8000 → tcp:8000`.
2. Opened `decentraland://open?preview=http://127.0.0.1:8000&position=0,0`
   with the SDK-generated `pulse-realm` parameter. Both phone and headless server
   logged accepted Pulse handshakes for the same local-development realm.
   The server observed the phone's player, and the phone connected to LiveKit.
3. The initial save probe reached local player storage and returned not found.
   This was expected: no preview save existed for this player.
4. Tapped Survival Menu → Save. The phone showed **Saved.** and local server
   storage contained a 5,532-byte `progress:full` save with 27 raft platforms.
5. Used the Explorer's scene reload control. Android logs show fresh scene-code
   loading and another accepted Pulse handshake. The game initialized fresh
   client state without automatically applying the cloud save.
6. Tapped Survival Menu → Load → Reload. The phone showed **Loaded.** and its
   health bar returned to the saved range.
7. Saved again through the phone UI, then compared the server's stored JSON with
   the original. Inventory layout/counts/selection/durabilities, raft data and
   unlocked recipes matched exactly. Play time advanced from 34.21 s to 72.23 s;
   hunger/thirst decreased and health regenerated during the intervening play.

All interactions used ADB touch input. Storage inspection was read-only; no
save payload was injected into the phone or server. No gameplay code changed
during verification. The preview and phone remain open at the Survival Menu.

## Evidence

- [Save acknowledgement](01-saved.png)
- [Fresh state after scene reload](02-after-reload.png)
- [Restored vitals](03-restored-vitals.png)
- [Load acknowledgement](04-loaded.png)
- [Original save summary](saved-state-summary.json)
- [Round-trip comparison](roundtrip-comparison.json)
- [Phone transport and reload logs](phone-transport.log)
- [Server transport logs](server-transport.log)

## Limits

This verifies actual mobile client ↔ server messaging and local preview
persistence, including scene reload and reconnection. It does not verify
production storage, production server cold starts, ranking submission, or
oversized saves. No deployment was performed. Android emitted social-service
subscription failures and scene frame-budget warnings during loading; neither
prevented this save/load round trip.
