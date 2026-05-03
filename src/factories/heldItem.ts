import {
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

export type HeldItemKind = 'hook' | 'hammer' | 'spear'

export interface HeldItemConfig {
  src: string
  // Camera-local rest pose. Axes: +X right, +Y up, +Z forward.
  offset: Vector3
  rotation: Quaternion
  scale: Vector3
}

// Per-item rest pose. Tune individually so each model reads as held in the
// right hand with the "useful" end pointing forward/up. The sway system reads
// these constants, so changes here flow through automatically.
export const HELD_ITEMS: Record<HeldItemKind, HeldItemConfig> = {
  hook: {
    src: 'assets/scene/items/hook.glb',
    offset: Vector3.create(0.35, -0.2, 0.6),
    rotation: Quaternion.fromEulerDegrees(195, 240, 0),
    scale: Vector3.create(0.25, 0.25, 0.25)
  },
  hammer: {
    src: 'assets/scene/items/hammer.glb',
    offset: Vector3.create(0.35, -0.2, 0.6),
    rotation: Quaternion.fromEulerDegrees(15, 240, 0),
    scale: Vector3.create(0.25, 0.25, 0.25)
  },
  spear: {
    src: 'assets/scene/items/spear.glb',
    offset: Vector3.create(0.35, -0.2, 0.6),
    rotation: Quaternion.fromEulerDegrees(70, 0, 15),
    scale: Vector3.create(0.4, 0.4, 0.4)
  }
}

let heldEntity: Entity | null = null
let heldKind: HeldItemKind = 'hook'

export function createHeldItem(initial: HeldItemKind = 'hook'): Entity {
  const cfg = HELD_ITEMS[initial]
  const entity = engine.addEntity()
  Transform.create(entity, {
    parent: engine.CameraEntity,
    position: cfg.offset,
    rotation: cfg.rotation,
    scale: cfg.scale
  })
  GltfContainer.create(entity, { src: cfg.src })
  // path '' applies to every node in the GLB — no shadow casting on the
  // held viewmodel.
  GltfNodeModifiers.create(entity, {
    modifiers: [{ path: '', castShadows: false }]
  })
  heldEntity = entity
  heldKind = initial
  return entity
}

export function setHeldItem(kind: HeldItemKind): void {
  if (heldEntity === null || heldKind === kind) return
  const cfg = HELD_ITEMS[kind]
  GltfContainer.getMutable(heldEntity).src = cfg.src
  const t = Transform.getMutable(heldEntity)
  t.position = cfg.offset
  t.rotation = cfg.rotation
  t.scale = cfg.scale
  heldKind = kind
}

export function getHeldItemEntity(): Entity | null {
  return heldEntity
}

export function getHeldItemKind(): HeldItemKind {
  return heldKind
}

export function getHeldItemRest(): HeldItemConfig {
  return HELD_ITEMS[heldKind]
}
