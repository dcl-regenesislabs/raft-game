import { Entity, engine } from '@dcl/sdk/ecs'

import { PlatformConstruction, WaterScroll } from '../components'
import { getConstructionPlacementMode } from './constructionPlacement'
import { getRaftBuilderMode } from './raftBuilder'
import { registerCameraForwardRaycast } from './raft/shared'

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
// entity. Two other systems also register their own handler on it: the
// raft builder (hammer place/destroy modes) and the construction
// placement system (grill / purifier selected). This system steps aside
// — relinquishes its claim to the raycaster — whenever either of those
// is non-idle, and re-registers the moment they go back to idle.

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

// Called by whichever system owns the camera-forward raycaster while we
// don't, so the look-at classification stays fresh for downstream readers
// (action button visibility, contextual icon swap, constructionInteract
// button-hit routing). Without this, the mobile action button tap on an
// already-placed grill / purifier gets swallowed whenever the player has
// a grill or purifier still selected for placement: lookAtTarget's
// currentTarget would be stale-null, and constructionInteract's
// buttonHits check would never fire.
export function publishLookAtHit(hitId: number | undefined): void {
  const water = findWaterEntity()
  if (water === null) {
    currentTarget = null
    return
  }
  currentTarget = classifyHit(water, hitId)
}

export function lookAtTargetSystem(_dt: number): void {
  const water = findWaterEntity()
  if (water === null) return
  const otherOwnerActive =
    getRaftBuilderMode() !== 'idle' ||
    getConstructionPlacementMode() !== 'idle'
  const shouldOwn = !otherOwnerActive
  if (raycasterActive === shouldOwn) return
  if (shouldOwn) {
    registerCameraForwardRaycast(LOOK_MAX_DISTANCE, (result) => {
      currentTarget = classifyHit(water, result.hits[0]?.entityId)
    })
    raycasterActive = true
  } else {
    // A placement system has taken over the camera raycaster (the raft
    // builder's enter*/transitionMode call already registered its own
    // handler this frame). Just drop ownership locally — calling
    // removeRaycasterEntity here would wipe the raycaster they just
    // installed and freeze their hover preview until the player
    // re-entered the mode. The placement system is expected to publish
    // its hits via publishLookAtHit so currentTarget stays fresh.
    raycasterActive = false
    currentTarget = null
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
