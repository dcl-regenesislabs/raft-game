import {
  ColliderLayer,
  Entity,
  GltfContainer,
  InputAction,
  PointerEventType,
  PointerEvents,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  PlatformConstruction,
  STORAGE_SLOT_COUNT,
  StorageContents
} from '../components'
import { PLATFORM_SIZE_X, PLATFORM_SIZE_Y, PLATFORM_SIZE_Z } from './platform'

export type ConstructionKind = 'grill' | 'purifier' | 'storage'

export const CONSTRUCTION_KINDS: readonly ConstructionKind[] = ['grill', 'purifier', 'storage']

const SRC: Record<ConstructionKind, string> = {
  grill: 'assets/scene/items/grill.glb',
  purifier: 'assets/scene/items/purifier.glb',
  storage: 'assets/scene/items/storage.glb'
}

// Visual world-size of the construction GLB. Tuned to read as a piece of
// furniture sitting on the raft deck, not dwarfing it.
const VISUAL_SIZE_M: Record<ConstructionKind, number> = {
  grill: 0.6,
  purifier: 0.6,
  storage: 0.6
}

// World-meters lift of the construction above the platform's origin so it
// lands on the VISIBLE raft deck rather than the (sunken) collider top.
// Per-kind because each GLB's mesh origin sits differently relative to
// its visible base. Exported via getConstructionDeckOffset so the
// spectral ghost preview reads the exact same value — the hovered
// preview position must match the placed entity's position or the
// placement will visibly jump on commit.
const DECK_OFFSET_M: Record<ConstructionKind, number> = {
  grill: 0.62,
  purifier: 0.52,
  storage: 0.4
}

// Hover-prompt text per construction kind. Names the action so the
// player knows what tapping the construction will do, regardless of
// what they're currently holding.
const HOVER_TEXT: Record<ConstructionKind, string> = {
  grill: 'COOK',
  purifier: 'PURIFY WATER',
  storage: 'OPEN STORAGE'
}

// Per-grill-state hover text used by the cook flow. The default ('COOK')
// applies whenever the grill is empty; cooking removes the prompt
// entirely (and the PointerEvents component) so taps are inert while
// food is on the fire.
export const GRILL_HOVER_PICKUP = 'PICK UP'
export const GRILL_HOVER_BURNED = 'GRAB COAL'
// Max distance the SDK pointer-input layer will register hovers/clicks
// against the construction. Roughly arm's length so the player has to
// actually walk up to it, not click from across the raft.
const HOVER_MAX_DISTANCE = 5

export function createConstruction(
  platform: Entity,
  kind: ConstructionKind,
  yawDeg: number = 0
): Entity {
  const visualSize = VISUAL_SIZE_M[kind]
  const child = engine.addEntity()
  // Cancel the platform parent's non-uniform (3, 0.3, 3) scale so the
  // construction renders proportionally, then up-scale to visualSize.
  Transform.create(child, {
    parent: platform,
    // Local Y: platform parent has scale.y = PLATFORM_SIZE_Y, so local
    // Y of N renders at N * PLATFORM_SIZE_Y world meters above the
    // platform origin.
    position: Vector3.create(0, DECK_OFFSET_M[kind] / PLATFORM_SIZE_Y, 0),
    rotation: Quaternion.fromEulerDegrees(0, yawDeg, 0),
    scale: Vector3.create(
      visualSize / PLATFORM_SIZE_X,
      visualSize / PLATFORM_SIZE_Y,
      visualSize / PLATFORM_SIZE_Z
    )
  })
  GltfContainer.create(child, {
    src: SRC[kind],
    // CL_POINTER so the GLB's own visible mesh acts as the click target.
    // CL_PHYSICS so the player can't walk through the construction —
    // without it the GLB renders but is non-solid, and the player just
    // phases into the grill / purifier.
    visibleMeshesCollisionMask:
      ColliderLayer.CL_POINTER | ColliderLayer.CL_PHYSICS
  })
  PointerEvents.create(child, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_POINTER,
          hoverText: HOVER_TEXT[kind],
          maxDistance: HOVER_MAX_DISTANCE,
          showFeedback: true
        }
      }
    ]
  })
  // Grills no longer carry an always-on flame; the flame and food
  // sprites are spawned by `cookSession.startCook` when the player
  // confirms a recipe and stored on the platform's `ActiveCook`
  // component. `aux` stays here as RootEntity (id 0) for the in-flight
  // cleanup branch in `destroyPlatformEntity`.
  PlatformConstruction.create(platform, { kind, child, aux: engine.RootEntity, yawDeg })
  if (kind === 'storage') {
    // Per-storage contents live on the platform entity. Pre-fill 25
    // empty slots so the UI can index them directly without
    // null-guarding length on every render.
    const slots = []
    for (let i = 0; i < STORAGE_SLOT_COUNT; i++) {
      slots.push({ id: '', count: 0 })
    }
    StorageContents.create(platform, { slots })
  }
  return child
}

// Replaces the construction's child PointerEvents with a single PET_DOWN
// entry whose hover text matches the supplied prompt, or removes the
// component entirely when `hoverText` is null. The cook flow drives this
// across grill states:
//   - null         → cooking in progress, taps inert
//   - 'PICK UP'    → cooked plate is ready
//   - 'GRAB COAL'  → cook over-burned
//   - default kind text restored once the grill is empty again
export function setConstructionPointerPrompt(
  child: Entity,
  hoverText: string | null
): void {
  if (hoverText === null) {
    if (PointerEvents.getOrNull(child) !== null) PointerEvents.deleteFrom(child)
    return
  }
  PointerEvents.createOrReplace(child, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_POINTER,
          hoverText,
          maxDistance: HOVER_MAX_DISTANCE,
          showFeedback: true
        }
      }
    ]
  })
}

export function getConstructionDefaultHoverText(kind: ConstructionKind): string {
  return HOVER_TEXT[kind]
}

export function getConstructionGlb(kind: ConstructionKind): string {
  return SRC[kind]
}

export function getConstructionVisualSize(kind: ConstructionKind): number {
  return VISUAL_SIZE_M[kind]
}

export function getConstructionDeckOffset(kind: ConstructionKind): number {
  return DECK_OFFSET_M[kind]
}
