import { Entity, Transform, engine } from '@dcl/sdk/ecs'

import { FloatingGarbage, PlatformConstruction, WaterScroll } from '../components'
import { GRAB_MAX_DISTANCE } from '../factories/floatingGarbage'
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
//   - garbageGrab, for the "look at a floating item + press E / action
//     button → bank it" flow
//
// Singleton — there is exactly one camera-forward raycaster on the camera
// entity. Two other systems also register their own handler on it: the
// raft builder (hammer place/destroy modes) and the construction
// placement system (grill / purifier selected). This system steps aside
// — relinquishes its claim to the raycaster — whenever either of those
// is non-idle, and re-registers the moment they go back to idle.
//
// Floating debris is classified through the same raycast path as the
// other interactables: each FloatingGarbage entity carries a CL_POINTER
// box collider + a PointerEvents prompt (set up in
// `factories/floatingGarbage.ts`), so hovering one fires the SDK's
// "GRAB" prompt and the raycast resolves the hit to a 'garbage' target
// here. A player-distance gate matches the PointerEvents `maxDistance`
// so the on-screen prompt and our action-button visibility stay in
// lockstep.

export type LookAtTarget =
  | 'water'
  | 'purifier'
  | 'grill'
  | 'storage'
  | 'garbage'
  | null

// Reach for the structure raycast — the player has to lean over the
// edge of the raft to interact, not click from across the deck.
const LOOK_MAX_DISTANCE = 8

let waterEntityCached: Entity | null = null
let raycasterActive = false
let currentTarget: LookAtTarget = null
// Grill platform entity behind the current 'grill' classification, if
// any. Lets readers (e.g. the action button icon swap) inspect that
// grill's `ActiveCook` to pick the right contextual icon — empty grill
// shows the cook icon, ready/burned shows the dish/coal.
let currentGrillPlatform: Entity | null = null
// Floating-debris entity behind the current 'garbage' classification,
// if any. The grab system reads this to know what to bank when the
// mobile action button is tapped; the action-button icon swap reads
// its `kind` to show the about-to-grab material.
let currentGarbageEntity: Entity | null = null

export function getLookAtTarget(): LookAtTarget {
  return currentTarget
}

export function getLookAtGrillPlatform(): Entity | null {
  return currentTarget === 'grill' ? currentGrillPlatform : null
}

export function getLookAtGarbageEntity(): Entity | null {
  return currentTarget === 'garbage' ? currentGarbageEntity : null
}

// Kind ('wood' / 'barrel' / 'plants' / 'plastic' / 'metal') of the
// currently-grabbable item, or null. Used by the action-button icon
// swap so mobile players see which material they're about to grab.
export function getLookAtGarbageKind(): string | null {
  const entity = getLookAtGarbageEntity()
  if (entity === null) return null
  const data = FloatingGarbage.getOrNull(entity)
  return data === null ? null : data.kind
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
    applyClassification({ target: null })
    return
  }
  applyClassification(classifyHit(water, hitId))
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
      applyClassification(classifyHit(water, result.hits[0]?.entityId))
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
    applyClassification({ target: null })
  }
}

function findWaterEntity(): Entity | null {
  // Validate the cache against the live ECS state — the lobby's water
  // entity gets cached on the lobby pass, then destroyed by
  // `teardownLobby` when the player picks a portal. Without this check,
  // every classifyHit() compares the camera ray against a dead entity ID
  // and the cup-fill / action-button routing never sees `target = 'water'`.
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

// Classification result. The grill / garbage cases carry the target
// entity so the look-at module can publish it for readers like the
// action button without re-iterating components.
type Classification =
  | { target: 'water' | 'purifier' | 'storage' | null }
  | { target: 'grill'; platform: Entity }
  | { target: 'garbage'; entity: Entity }

function applyClassification(c: Classification): void {
  currentTarget = c.target
  currentGrillPlatform = c.target === 'grill' ? c.platform : null
  currentGarbageEntity = c.target === 'garbage' ? c.entity : null
}

function classifyHit(water: Entity, hitId: number | undefined): Classification {
  if (hitId === undefined) return { target: null }
  const hit = hitId as Entity
  if (hit === water) return { target: 'water' }
  // Floating debris pickup target. Re-check the player distance so the
  // 'garbage' classification only fires within the same reach as the
  // PointerEvents hover prompt — the raycast runs to LOOK_MAX_DISTANCE
  // (8 m) which is wider than the grab range.
  if (FloatingGarbage.getOrNull(hit) !== null) {
    if (isWithinGrabRange(hit)) return { target: 'garbage', entity: hit }
    return { target: null }
  }
  for (const [platform, pc] of engine.getEntitiesWith(PlatformConstruction)) {
    if (pc.child === hit) {
      if (pc.kind === 'purifier') return { target: 'purifier' }
      if (pc.kind === 'grill') return { target: 'grill', platform }
      if (pc.kind === 'storage') return { target: 'storage' }
      return { target: null }
    }
  }
  return { target: null }
}

function isWithinGrabRange(entity: Entity): boolean {
  const player = Transform.getOrNull(engine.PlayerEntity)
  const target = Transform.getOrNull(entity)
  if (player === null || target === null) return false
  const dx = target.position.x - player.position.x
  const dy = target.position.y - player.position.y
  const dz = target.position.z - player.position.z
  return dx * dx + dy * dy + dz * dz <= GRAB_MAX_DISTANCE * GRAB_MAX_DISTANCE
}
