import {
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  Material,
  MeshRenderer,
  Transform,
  VisibilityComponent,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

export type HeldItemKind = 'hook' | 'hammer' | 'spear' | 'food'

export interface HeldItemConfig {
  src: string
  // Camera-local rest pose. Axes: +X right, +Y up, +Z forward.
  offset: Vector3
  rotation: Quaternion
  scale: Vector3
}

// Per-item rest pose. Tune individually so each model reads as held in the
// right hand with the "useful" end pointing forward/up. The sway system reads
// these constants, so changes here flow through automatically. The 'food'
// entry has no GLB src — food items render as a textured plane (Sprite3D)
// whose texture is supplied per-food-id via setHeldFood.
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
  },
  food: {
    src: '',
    // Held a touch closer than tools — food is a flat plane, so a smaller
    // forward offset reads as cradled in the hand rather than poked out.
    // Y rotation 180° flips the plane so the texture faces the camera.
    // Sits ~1/8 screen-height below the tools' rest pose so the icon
    // doesn't crowd the crosshair while still reading as held.
    offset: Vector3.create(0.3, -0.27, 0.55),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    // Bigger than the tools — the sprite is a flat icon, so it reads as
    // small unless we push the scale up.
    scale: Vector3.create(0.5, 0.5, 0.5)
  }
}

// The held viewmodel is two camera-parented child entities under a shared
// root: one carries the GLB tools, the other carries the food sprite. Only
// one is visible at a time (toggled via VisibilityComponent), so swapping
// between a tool and a food never leaves a stale GLB on screen.
let toolEntity: Entity | null = null
let spriteEntity: Entity | null = null
let heldKind: HeldItemKind = 'hook'
// Active food id while heldKind === 'food'. Used by the eat system so it
// knows which food to consume from the inventory. Null otherwise.
let heldFoodId: string | null = null

export function createHeldItem(initial: HeldItemKind = 'hook'): Entity {
  // Tool child — carries the GLB. Pose is set per-tool by setHeldItem.
  toolEntity = engine.addEntity()
  Transform.create(toolEntity, {
    parent: engine.CameraEntity,
    position: Vector3.Zero(),
    rotation: Quaternion.Identity(),
    scale: Vector3.One()
  })
  // path '' applies to every node in the GLB — no shadow casting on the
  // held viewmodel.
  GltfNodeModifiers.create(toolEntity, {
    modifiers: [{ path: '', castShadows: false }]
  })

  // Sprite child — textured plane (unlit). Material is set on first food
  // selection, so the entity ships with no material on creation.
  spriteEntity = engine.addEntity()
  Transform.create(spriteEntity, {
    parent: engine.CameraEntity,
    position: Vector3.Zero(),
    rotation: Quaternion.Identity(),
    scale: Vector3.One()
  })
  MeshRenderer.setPlane(spriteEntity)
  // Hidden by default; only shown when a food item is equipped.
  VisibilityComponent.create(spriteEntity, { visible: false })

  // Apply the initial tool pose + GLB. setHeldItem also flips visibility,
  // which sets the tool entity to visible (default state, no-op).
  setHeldItem(initial)
  return toolEntity
}

export function setHeldItem(kind: HeldItemKind): void {
  if (toolEntity === null || spriteEntity === null) return
  // 'food' kind requires a texture — callers must use setHeldFood. If
  // somebody calls setHeldItem('food') directly there's no texture to
  // show, so bail out instead of swapping to an empty sprite.
  if (kind === 'food') return
  const cfg = HELD_ITEMS[kind]
  GltfContainer.createOrReplace(toolEntity, { src: cfg.src })
  applyRestPose(toolEntity, cfg)
  setVisible(toolEntity, true)
  setVisible(spriteEntity, false)
  heldKind = kind
  heldFoodId = null
}

// Equip a food item as a Sprite3D (textured plane) parented to the camera.
// Hides the GLB tool child and shows the sprite child with the supplied
// texture on an unlit basic material so scene lighting doesn't darken it.
// The eat system reads `heldFoodId` to know which food to consume when the
// player fires.
export function setHeldFood(foodId: string, texture: string): void {
  if (toolEntity === null || spriteEntity === null) return
  const cfg = HELD_ITEMS.food
  Material.setBasicMaterial(spriteEntity, {
    texture: Material.Texture.Common({ src: texture }),
    // Cutout transparency keeps the plane silhouette tight to the icon.
    alphaTest: 0.5,
    castShadows: false
  })
  applyRestPose(spriteEntity, cfg)
  setVisible(toolEntity, false)
  setVisible(spriteEntity, true)
  heldKind = 'food'
  heldFoodId = foodId
}

// Returns whichever child is currently active so the sway / gesture systems
// write to the visible viewmodel and leave the hidden one alone.
export function getHeldItemEntity(): Entity | null {
  return heldKind === 'food' ? spriteEntity : toolEntity
}

export function getHeldItemKind(): HeldItemKind {
  return heldKind
}

export function getHeldFoodId(): string | null {
  return heldFoodId
}

export function getHeldItemRest(): HeldItemConfig {
  return HELD_ITEMS[heldKind]
}

function applyRestPose(entity: Entity, cfg: HeldItemConfig): void {
  const t = Transform.getMutable(entity)
  t.position = cfg.offset
  t.rotation = cfg.rotation
  t.scale = cfg.scale
}

function setVisible(entity: Entity, visible: boolean): void {
  VisibilityComponent.createOrReplace(entity, { visible })
}
