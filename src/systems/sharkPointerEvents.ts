import {
  InputAction,
  PointerEventType,
  PointerEvents,
  Transform,
  engine
} from '@dcl/sdk/ecs'

import { SharkAttack, SharkHittable } from '../components'
import { getHeldItemKind } from '../factories/heldItem'
import {
  SHARK_HOVER_HIT,
  SHARK_HOVER_MAX_DISTANCE,
  SHARK_HOVER_NEEDS_SPEAR
} from '../factories/shark'

// Mirrors the PHASE_BITE encoding used by sharkDirector / sharkAttack.
// A shark is only attackable while it is biting a raft — orbiting sharks
// and approach/return phases are ignored.
const PHASE_BITE = 1

// Player must be within this distance to a biting shark for the hover
// prompt to appear and a hit to register. Matches STRIKE_REACH_M in the
// spear-attack system so the UI advertises only what the swing can reach.
const HIT_RADIUS_M = 4.0

// Per-frame: ensure each shark has a PointerEvents component iff it is
// currently biting AND the player is within hit range. Outside of those
// conditions the component is stripped so the cursor never lights up on
// orbiters or far-away biters.
export function sharkPointerEventsSystem(_dt: number): void {
  const playerT = Transform.getOrNull(engine.PlayerEntity)
  if (playerT === null) return
  const px = playerT.position.x
  const py = playerT.position.y
  const pz = playerT.position.z
  const text =
    getHeldItemKind() === 'spear' ? SHARK_HOVER_HIT : SHARK_HOVER_NEEDS_SPEAR

  for (const [entity] of engine.getEntitiesWith(SharkHittable)) {
    const attack = SharkAttack.getOrNull(entity)
    const isBiting = attack !== null && attack.phase === PHASE_BITE

    let inRange = false
    if (isBiting) {
      const t = Transform.getOrNull(entity)
      if (t !== null) {
        const dx = t.position.x - px
        const dy = t.position.y - py
        const dz = t.position.z - pz
        inRange = dx * dx + dy * dy + dz * dz <= HIT_RADIUS_M * HIT_RADIUS_M
      }
    }

    const shouldHavePointer = isBiting && inRange
    const existing = PointerEvents.getMutableOrNull(entity)

    if (shouldHavePointer) {
      if (existing === null) {
        PointerEvents.create(entity, {
          pointerEvents: [
            {
              eventType: PointerEventType.PET_DOWN,
              eventInfo: {
                button: InputAction.IA_POINTER,
                hoverText: text,
                maxDistance: SHARK_HOVER_MAX_DISTANCE,
                showFeedback: true
              }
            }
          ]
        })
      } else {
        const evt = existing.pointerEvents[0]
        if (evt !== undefined && evt.eventInfo !== undefined) {
          evt.eventInfo.hoverText = text
        }
      }
    } else if (existing !== null) {
      PointerEvents.deleteFrom(entity)
    }
  }
}
