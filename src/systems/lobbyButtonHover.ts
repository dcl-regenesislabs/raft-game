import {
  InputAction,
  PointerEventType,
  Transform,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { LobbyButton, LobbyButtonHover } from '../components'
import {
  hasSavedGame,
  isSaveProbeComplete,
  isStartupGateActive,
  isStartupGateExiting
} from '../ui/startupGate'

// Hover-zoom for the lobby panel buttons. PET_HOVER_ENTER snaps the
// per-button `targetMul` to 1.12, PET_HOVER_LEAVE snaps it back to 1.0,
// and each frame we lerp `currentMul` toward the target so the visible
// plate zooms smoothly (12 = ~80 ms to settle).
//
// Only the visual child + the floating label scale — the click-plate
// parent stays at its fixed pad-sized box so the trigger area is
// independent of the hover animation. The visual's local scale is
// `(visualLocalX × mul, visualLocalY × mul, 1)`; the text scales
// uniformly by `mul`.
//
// Gated on `isStartupGateActive`/`isStartupGateExiting` so we don't
// burn frames on stale entities once the player commits to entering
// the world (the lobby gets torn down a moment later).

const ZOOM_HOVER_MUL = 1.12
const ZOOM_REST_MUL = 1
const LERP_SPEED = 12

export function lobbyButtonHoverSystem(dt: number): void {
  if (!isStartupGateActive()) return
  if (isStartupGateExiting()) return

  const loadAvailable = isSaveProbeComplete() && hasSavedGame()

  for (const [entity, , btn] of engine.getEntitiesWith(LobbyButtonHover, LobbyButton)) {
    const enter = inputSystem.isTriggered(
      InputAction.IA_POINTER,
      PointerEventType.PET_HOVER_ENTER,
      entity
    )
    const leave = inputSystem.isTriggered(
      InputAction.IA_POINTER,
      PointerEventType.PET_HOVER_LEAVE,
      entity
    )
    const state = LobbyButtonHover.getMutable(entity)
    // Disabled LOAD button never blooms — force the rest target so a
    // hover-enter event can't latch the zoom on while the probe is
    // still pending or no save was found. The lerp below still runs
    // so a button that flips disabled mid-hover settles cleanly back
    // to base scale.
    const inert = btn.kind === 'LOAD' && !loadAvailable
    if (inert) state.targetMul = ZOOM_REST_MUL
    else if (enter) state.targetMul = ZOOM_HOVER_MUL
    else if (leave) state.targetMul = ZOOM_REST_MUL

    // Frame-rate independent lerp toward the target. Clamp the step at
    // 1 so a long stutter (huge dt) snaps to target rather than
    // overshooting past it.
    const step = Math.min(1, dt * LERP_SPEED)
    const next = state.currentMul + (state.targetMul - state.currentMul) * step
    if (Math.abs(next - state.currentMul) < 0.0005 && next === state.targetMul) {
      // Settled — skip the Transform writes once we're stable to avoid
      // re-emitting CRDT updates every frame on idle buttons.
      continue
    }
    state.currentMul = next

    Transform.getMutable(state.visualEntity).scale = Vector3.create(
      state.visualLocalX * next,
      state.visualLocalY * next,
      1
    )
    Transform.getMutable(state.textEntity).scale = Vector3.create(next, next, next)
  }
}
