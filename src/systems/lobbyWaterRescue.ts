import { InputModifier, Transform, engine } from '@dcl/sdk/ecs'
import { movePlayerTo } from '~system/RestrictedActions'

import { GRID_ORIGIN } from '../factories/platform'
import { getLobbyArrivalPosition } from '../factories/lobby'
import { LOBBY_RAFT_Y } from '../factories/sceneLevels'
import { isStartupGateActive } from '../ui/startupGate'

// Player Y at or below this means they've left the raft into the water.
// LOBBY_RAFT_Y = 0.3 (raft base), deck top sits at 0.6, water surface at
// 0.18, seabed at 0. Anything ≤ 0.3 has feet at the raft base or below —
// well under the deck the player should be standing on, and consistent
// regardless of which raft/bridge cell they were on.
const LOBBY_WATER_THRESHOLD = LOBBY_RAFT_Y

// Y lift above the parcel floor when teleporting back to the bridge tail.
// Mirrors the `GRID_ORIGIN.y + 1` drop used by the BACK TO LOBBY path so
// the player lands on the deck with a tiny step-down rather than spawning
// inside the raft mesh.
const ARRIVAL_HEIGHT = 1

const MOVEMENT_LOCK_S = 1
const RESCUE_COOLDOWN_S = 1.5

function setMovementLocked(locked: boolean): void {
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableWalk: locked,
      disableJog: locked,
      disableRun: true,
      disableJump: locked,
      // Scene-wide invariant — see `fallRescue.ts` for the long form.
      disableDoubleJump: true,
      disableGliding: true
    })
  })
}

let inFlight = false
let cooldownRemaining = 0
let lockRemaining = 0

// Lobby-specific water rescue. The game-world `fallRescue` self-suppresses
// while the startup gate is active (its WATER_LEVEL-0.5 threshold would
// otherwise fire constantly against the lobby's 0.6 m deck), so something
// else has to cover the "player entered the world from a neighbouring scene
// and landed in the water" case. That's this system.
//
// While the gate is active and the player's feet sit at or below the raft
// base, we teleport them to the lobby's bridge-tail spawn — the same
// arrival point the BACK TO LOBBY flow uses. No life damage is charged
// (gameplay hasn't started yet).
export function lobbyWaterRescueSystem(dt: number): void {
  if (lockRemaining > 0) {
    lockRemaining -= dt
    if (lockRemaining <= 0) {
      lockRemaining = 0
      setMovementLocked(false)
    }
  }
  if (cooldownRemaining > 0) {
    cooldownRemaining -= dt
    if (cooldownRemaining < 0) cooldownRemaining = 0
  }

  if (!isStartupGateActive()) return

  const player = Transform.getOrNull(engine.PlayerEntity)
  if (player === null) return
  if (player.position.y > LOBBY_WATER_THRESHOLD) return
  if (inFlight) return
  if (cooldownRemaining > 0) return

  inFlight = true
  cooldownRemaining = RESCUE_COOLDOWN_S
  lockRemaining = MOVEMENT_LOCK_S
  setMovementLocked(true)

  const arrival = getLobbyArrivalPosition(GRID_ORIGIN.x, GRID_ORIGIN.z)
  movePlayerTo({
    newRelativePosition: {
      x: arrival.x,
      y: GRID_ORIGIN.y + ARRIVAL_HEIGHT,
      z: arrival.z
    }
  }).finally(() => {
    inFlight = false
  })
}
