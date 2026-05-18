import {
  Entity,
  InputAction,
  PointerEventType,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

import { playSfx } from '../audio/sfx'
import { FloatingGarbage } from '../components'
import { destroyFloatingGarbage } from '../factories/floatingGarbage'
import { bankGarbageKind } from '../factories/garbageBank'
import { isHeldViewmodelHidden } from '../factories/heldItem'
import { actionButtonJustPressed } from '../ui/actionButton'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { isStartupGateActive } from '../ui/startupGate'
import { consumeWorldClick } from '../ui/worldClickGate'
import { getConstructionPlacementMode } from './constructionPlacement'
import { getLookAtGarbageEntity } from './lookAtTarget'
import { getRaftBuilderMode } from './raftBuilder'

// Direct pickup of floating debris.
//
// Each FloatingGarbage entity carries a PointerEvents prompt bound to
// IA_PRIMARY (E) inside the GRAB_MAX_DISTANCE radius — see
// `factories/floatingGarbage.ts`. This system watches every entity for
// that entity-targeted trigger and banks the item the moment it fires.
// The pointer-event maxDistance already enforces "must be close enough"
// (and gates the hover prompt the player sees), so no extra range check
// is needed here.
//
// Mobile uses the existing on-screen action button as a second input
// path — when the look-at classification is 'garbage', tapping the
// button banks whichever entity the camera is currently aimed at. The
// action-button icon also swaps to the about-to-grab material via the
// contextual-icon hook in `ui/components/ActionButton.tsx`.
//
// Banking calls `consumeWorldClick()` so the hook-thrower's mobile
// charge start (which shares the same action-button press) skips this
// frame instead of charging a hook on top of the grab.

export function garbageGrabSystem(_dt: number): void {
  if (isStartupGateActive()) return
  if (isHeldViewmodelHidden()) return
  if (isInventoryActionLocked()) return
  // Placement / hammer modes repurpose E and the action button — stand
  // aside to avoid grabbing while the player meant to rotate / fire.
  if (getRaftBuilderMode() !== 'idle') return
  if (getConstructionPlacementMode() !== 'idle') return

  // Path 1 (desktop + mobile direct tap): the SDK delivered an
  // IA_PRIMARY press to a specific FloatingGarbage entity via its
  // pointer event. Only one item can be hit at a time — first match
  // wins and we return.
  for (const [entity] of engine.getEntitiesWith(FloatingGarbage)) {
    if (
      inputSystem.isTriggered(
        InputAction.IA_PRIMARY,
        PointerEventType.PET_DOWN,
        entity
      )
    ) {
      grabGarbage(entity)
      return
    }
  }

  // Path 2 (mobile action button): there's no entity-targeted input
  // when the player taps the HUD button, so fall back to the look-at
  // classification to pick the target. Desktop also surfaces this
  // path for free since the action button isn't shown there.
  if (!isMobile()) return
  if (!actionButtonJustPressed()) return
  const target = getLookAtGarbageEntity()
  if (target === null) return
  grabGarbage(target)
}

function grabGarbage(entity: Entity): void {
  // Defensive: the entity could have been despawned (lifetime / scene
  // bounds) or hooked between the look-at sweep and the input read.
  const data = FloatingGarbage.getOrNull(entity)
  if (data === null) return
  playSfx('waterSplash')
  bankGarbageKind(data.kind)
  destroyFloatingGarbage(entity)
  consumeWorldClick()
}
