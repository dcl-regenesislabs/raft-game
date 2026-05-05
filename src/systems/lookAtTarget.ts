import { Entity, engine } from '@dcl/sdk/ecs'

import { PlatformConstruction, WaterScroll } from '../components'
import { getRaftBuilderMode } from './raftBuilder'
import {
  registerCameraForwardRaycast,
  unregisterCameraForwardRaycast
} from './raft/shared'

// Owns the camera-forward raycast that classifies whatever the player is
// currently aiming at into one of a few interactable kinds. Reads:
//   - cupFill, for "salt-water cup pointed at the purifier" routing
//   - actionButton / ActionButton.tsx, for the grill-override that swaps
//     the on-screen action button to a "open cook menu" button while
//     the camera is on a placed grill
//   - constructionInteract, for routing the action button press to the
//     correct construction handler
//
// Singleton — there is exactly one camera-forward raycaster on the camera
// entity, and the raft builder's placing/destroying modes own it while
// active. This system therefore steps aside (unregisters) whenever the
// hammer is in placing or destroying mode.

export type LookAtTarget = 'water' | 'purifier' | 'grill' | null

// Same reach as the cup hover prompt: the player has to lean over the
// edge of the raft to interact, not click from across the deck.
const LOOK_MAX_DISTANCE = 8

let waterEntityCached: Entity | null = null
let raycasterActive = false
let currentTarget: LookAtTarget = null

export function getLookAtTarget(): LookAtTarget {
  return currentTarget
}

export function lookAtTargetSystem(_dt: number): void {
  const water = findWaterEntity()
  if (water === null) return
  const builderIdle = getRaftBuilderMode() === 'idle'
  if (raycasterActive !== builderIdle) {
    if (builderIdle) {
      registerCameraForwardRaycast(LOOK_MAX_DISTANCE, (result) => {
        currentTarget = classifyHit(water, result.hits[0]?.entityId)
      })
      raycasterActive = true
    } else {
      unregisterCameraForwardRaycast()
      raycasterActive = false
      currentTarget = null
    }
  }
}

function findWaterEntity(): Entity | null {
  if (waterEntityCached !== null) return waterEntityCached
  for (const [entity] of engine.getEntitiesWith(WaterScroll)) {
    waterEntityCached = entity
    return entity
  }
  return null
}

function classifyHit(water: Entity, hitId: number | undefined): LookAtTarget {
  if (hitId === undefined) return null
  const hit = hitId as Entity
  if (hit === water) return 'water'
  for (const [, pc] of engine.getEntitiesWith(PlatformConstruction)) {
    if (pc.child === hit) {
      if (pc.kind === 'purifier') return 'purifier'
      if (pc.kind === 'grill') return 'grill'
      return null
    }
  }
  return null
}
