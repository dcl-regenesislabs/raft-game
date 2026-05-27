import {
  Entity,
  InputAction,
  PointerEventType,
  PointerEvents,
  Transform,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import { WaterScroll } from '../components'
import { playSfx } from '../audio/sfx'
import { getHeldFoodId, getHeldItemKind } from '../factories/heldItem'
import { actionButtonJustPressed } from '../ui/actionButton'
import {
  getSelectedSlot,
  isSelectionPointerLockoutActive,
  transmuteContainerSlot
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { showNotification } from '../ui/notification'
import { consumeWorldClick } from '../ui/worldClickGate'
import { getLookAtTarget, type LookAtTarget } from './lookAtTarget'

// Manages everything cup-related that depends on what the camera is
// currently aimed at:
//   1. Toggles a "FILL CUP" PointerEvents prompt on the water plane
//      so the SDK only shows the hover cue while an empty cup is held.
//   2. Fires an empty-cup fill when the player taps the water (direct
//      entity-targeted click) or presses the mobile action button
//      while looking at water.
//
// Camera-forward classification (water / purifier / grill) lives in
// `lookAtTarget` so the action button can reuse it for the grill
// override (open cook menu while aimed at a grill).

const HOVER_TEXT = 'FILL CUP'
const HOVER_MAX_DISTANCE = 8

// Re-exported so existing callers (action button, construction interact)
// don't need to know that classification moved into a separate module.
export type CupTarget = LookAtTarget
export function getCupTarget(): CupTarget {
  return getLookAtTarget()
}

let waterEntityCached: Entity | null = null

export function cupFillSystem(_dt: number): void {
  const water = findWaterEntity()
  if (water === null) return

  const heldKind = getHeldItemKind()
  const heldId = getHeldFoodId()
  const cupKindHeld = heldKind === 'cup'
  const emptyCupHeld = cupKindHeld && heldId === 'cup'

  syncWaterPointer(water, emptyCupHeld)

  if (!emptyCupHeld) return
  if (isInventoryActionLocked()) return
  if (isSelectionPointerLockoutActive()) return
  // No `isPointerLocked()` gate here on purpose — see the matching
  // note in `constructionInteractSystem`. The entity-targeted
  // IA_POINTER trigger below is sufficient: it only fires when the
  // SDK actually delivered a click on the water entity, so the gate
  // would only swallow legitimate re-lock clicks after a UI interaction.

  // Two fire paths:
  //   - Entity-targeted IA_PRIMARY PET_DOWN on water — the player
  //     pressed E while hovering the water plane (desktop) or tapped
  //     it directly (mobile). Matches the construction E-press model
  //     so left-click stays free for the held-tool primary action.
  //   - The mobile action button — only valid when the camera is
  //     currently aimed at water (so the button effectively means
  //     "fill the cup with what I'm pointing at").
  const tappedWater = inputSystem.isTriggered(
    InputAction.IA_PRIMARY,
    PointerEventType.PET_DOWN,
    water
  )
  const actionButtonFire =
    isMobile() &&
    actionButtonJustPressed() &&
    getLookAtTarget() === 'water' &&
    isPlayerWithinFillRange(water)
  if (!tappedWater && !actionButtonFire) return

  const slot = getSelectedSlot()
  if (transmuteContainerSlot(slot, 'saltWater')) {
    playSfx('cupFill')
    showNotification('Cup filled with salt water.')
  }
  consumeWorldClick()
}

// Mirror the SDK's PointerEvents.maxDistance check (which the FILL CUP
// hover uses on the water plane) for the mobile action button fire
// path. Without this, the button fires whenever `getLookAtTarget()`
// classifies the look as 'water' — but that classification uses a
// camera-origin raycast, and in third-person view the camera sits a
// few metres behind the avatar. The player can be standing too far
// from the water to see the FILL CUP prompt while the camera ray
// still lands on water within 8 m, so the button would "work" from
// out of reach. Gating on the player-to-water-hit distance (camera
// ray projected onto the water plane, measured from the player
// position) keeps the two paths consistent.
function isPlayerWithinFillRange(water: Entity): boolean {
  const player = Transform.getOrNull(engine.PlayerEntity)
  const camera = Transform.getOrNull(engine.CameraEntity)
  const waterTransform = Transform.getOrNull(water)
  if (player === null || camera === null || waterTransform === null) return false
  const forward = Vector3.rotate(
    Vector3.create(0, 0, 1),
    camera.rotation as Quaternion
  )
  // Need a downward-facing ray to hit the horizontal water plane.
  if (forward.y >= -0.01) return false
  const waterY = waterTransform.position.y
  const t = (waterY - camera.position.y) / forward.y
  if (t <= 0) return false
  const hit = Vector3.create(
    camera.position.x + forward.x * t,
    waterY,
    camera.position.z + forward.z * t
  )
  return Vector3.distance(player.position, hit) <= HOVER_MAX_DISTANCE
}

function findWaterEntity(): Entity | null {
  // Validate the cache: the lobby builds its own WaterScroll entity, and
  // `teardownLobby` destroys it before `buildGameWorld` creates the real
  // y=4 game water. A stale cache from the lobby pass leaves this system
  // attaching FILL CUP pointer events to a destroyed entity, which the
  // SDK silently ignores.
  if (
    waterEntityCached !== null &&
    WaterScroll.getOrNull(waterEntityCached) !== null
  ) {
    return waterEntityCached
  }
  waterEntityCached = null
  for (const [entity] of engine.getEntitiesWith(WaterScroll)) {
    waterEntityCached = entity
    return entity
  }
  return null
}

function syncWaterPointer(entity: Entity, shouldHavePointer: boolean): void {
  const existing = PointerEvents.getOrNull(entity)
  if (shouldHavePointer) {
    if (existing === null) {
      PointerEvents.create(entity, {
        pointerEvents: [
          {
            eventType: PointerEventType.PET_DOWN,
            eventInfo: {
              button: InputAction.IA_PRIMARY,
              hoverText: HOVER_TEXT,
              maxDistance: HOVER_MAX_DISTANCE,
              showFeedback: true
            }
          }
        ]
      })
    }
  } else if (existing !== null) {
    PointerEvents.deleteFrom(entity)
  }
}
