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

import { PlatformConstruction } from '../components'
import { PLATFORM_SIZE_X, PLATFORM_SIZE_Y, PLATFORM_SIZE_Z } from './platform'

export type ConstructionKind = 'grill' | 'purifier'

export const CONSTRUCTION_KINDS: readonly ConstructionKind[] = ['grill', 'purifier']

const SRC: Record<ConstructionKind, string> = {
  grill: 'assets/scene/items/grill.glb',
  purifier: 'assets/scene/items/purifier.glb'
}

// Visual world-size of the construction GLB. Tuned to read as a piece of
// furniture sitting on the raft deck, not dwarfing it.
const VISUAL_SIZE_M: Record<ConstructionKind, number> = {
  grill: 0.6,
  purifier: 0.6
}

// World-meters lift of the construction above the platform's origin so it
// lands on the VISIBLE raft deck rather than the (sunken) collider top.
// Exported so the spectral ghost preview reads the exact same value —
// the hovered preview position must match the placed entity's position
// or the placement will visibly jump on commit.
export const CONSTRUCTION_DECK_OFFSET_M = 0.52
// Local-space Y the factory writes into Transform. The platform parent
// has scale.y = PLATFORM_SIZE_Y, so a local Y of N renders at N *
// PLATFORM_SIZE_Y world meters above the platform origin.
const DECK_TOP_LOCAL_Y = CONSTRUCTION_DECK_OFFSET_M / PLATFORM_SIZE_Y

// Hover-prompt text per construction kind. Names the action so the
// player knows what tapping the construction will do, regardless of
// what they're currently holding.
const HOVER_TEXT: Record<ConstructionKind, string> = {
  grill: 'COOK',
  purifier: 'PURIFY WATER'
}
// Max distance the SDK pointer-input layer will register hovers/clicks
// against the construction. Roughly arm's length so the player has to
// actually walk up to it, not click from across the raft.
const HOVER_MAX_DISTANCE = 5

export function createConstruction(
  platform: Entity,
  kind: ConstructionKind
): Entity {
  const visualSize = VISUAL_SIZE_M[kind]
  const child = engine.addEntity()
  // Cancel the platform parent's non-uniform (3, 0.3, 3) scale so the
  // construction renders proportionally, then up-scale to visualSize.
  Transform.create(child, {
    parent: platform,
    position: Vector3.create(0, DECK_TOP_LOCAL_Y, 0),
    rotation: Quaternion.fromEulerDegrees(0, 0, 0),
    scale: Vector3.create(
      visualSize / PLATFORM_SIZE_X,
      visualSize / PLATFORM_SIZE_Y,
      visualSize / PLATFORM_SIZE_Z
    )
  })
  GltfContainer.create(child, {
    src: SRC[kind],
    // The GLB's own visible mesh acts as the click target — no overlay
    // collider needed. Player can't walk through it either; that's
    // governed by the platform deck and the player's existing collider.
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER
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
  PlatformConstruction.create(platform, { kind, child })
  return child
}

export function getConstructionGlb(kind: ConstructionKind): string {
  return SRC[kind]
}

export function getConstructionVisualSize(kind: ConstructionKind): number {
  return VISUAL_SIZE_M[kind]
}
