import {
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  Transform,
  VisibilityComponent,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

export type HeldItemKind = 'hook' | 'hammer' | 'spear' | 'fishingRod' | 'food' | 'cup'

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
  fishingRod: {
    src: 'assets/scene/items/fishing_rod.glb',
    offset: Vector3.create(0.35, -0.1, 0.6),
    rotation: Quaternion.fromEulerDegrees(10, 0, -90),
    scale: Vector3.create(0.245, 0.245, 0.245)
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
  },
  // Containers (cup) reuse the food sprite path — same flat-plane in
  // hand. Pose mirrors the food rest pose so swapping between cup ↔
  // saltWater (which are visually similar) doesn't jolt.
  cup: {
    src: '',
    offset: Vector3.create(0.3, -0.27, 0.55),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    scale: Vector3.create(0.5, 0.5, 0.5)
  }
}

// Rest pose for tier-4 hero plates that ship a GLB instead of a flat
// sprite. The GLB rides the same camera-parented tool entity used by
// regular tools, so heldKind stays 'food' but the visibility/sway code
// routes to the tool child (see `heldFoodIsGlb`). Tuned to sit a touch
// further from the camera than flat-sprite food so the model has room
// to read in 3D; rotation 0 leaves the model's authored up axis intact.
const HELD_FOOD_GLB: HeldItemConfig = {
  src: '',
  offset: Vector3.create(0.3, -0.27, 0.6),
  rotation: Quaternion.fromEulerDegrees(0, 180, 0),
  scale: Vector3.create(0.25, 0.25, 0.25)
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
// True while heldKind === 'food' but the food shipped a GLB — the model
// rides the tool child instead of the sprite child, and visibility/sway
// route accordingly. Reset to false on every non-GLB food / cup equip.
let heldFoodIsGlb = false
// Global hide flag. While true, both viewmodel children stay invisible
// regardless of which kind is "equipped" — the lobby uses this so the
// startup HOOK doesn't render under the title overlay. Item-swap calls
// (setHeldItem/Food/Cup) still update heldKind, so unhiding restores
// the right child.
let viewmodelHidden = false

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
  // Sprite-based kinds ('food', 'cup') require a texture — callers must
  // use setHeldFood / setHeldCup. If somebody calls setHeldItem with
  // a sprite kind directly there's no texture to show, so bail out
  // instead of swapping to an empty sprite.
  if (kind === 'food' || kind === 'cup') return
  const cfg = HELD_ITEMS[kind]
  GltfContainer.createOrReplace(toolEntity, { src: cfg.src })
  applyRestPose(toolEntity, cfg)
  heldKind = kind
  heldFoodId = null
  heldFoodIsGlb = false
  applyKindVisibility()
}

// Equip a food item as a Sprite3D (textured plane) parented to the camera.
// Hides the GLB tool child and shows the sprite child with the supplied
// texture on an unlit basic material so scene lighting doesn't darken it.
// The eat system reads `heldFoodId` to know which food to consume when the
// player fires.
export function setHeldFood(foodId: string, texture: string, glb?: string | null): void {
  if (toolEntity === null || spriteEntity === null) return
  if (glb !== null && glb !== undefined && glb !== '') {
    // Tier-4 hero plates: mount the GLB on the tool child. The sprite
    // child stays hidden via `applyKindVisibility` (it reads
    // `heldFoodIsGlb`), so the flat plane never leaks through.
    GltfContainer.createOrReplace(toolEntity, { src: glb })
    applyRestPose(toolEntity, HELD_FOOD_GLB)
    heldFoodIsGlb = true
  } else {
    applySpriteTexture(spriteEntity, texture)
    applyRestPose(spriteEntity, HELD_ITEMS.food)
    clearToolGlb(toolEntity)
    heldFoodIsGlb = false
  }
  heldKind = 'food'
  heldFoodId = foodId
  applyKindVisibility()
}

// Equip a container (cup / saltWater / freshWater) as a Sprite3D. Same
// render path as setHeldFood but `heldKind` is 'cup' so the food-eat
// system's count-subtract path skips it. The container-action system
// uses `heldFoodId` to know which container variant is active and what
// the fire press should do (fill empty cup at water, purify at the
// purifier, drink to swap the slot back to an empty cup).
export function setHeldCup(containerId: string, texture: string): void {
  if (toolEntity === null || spriteEntity === null) return
  applySpriteTexture(spriteEntity, texture)
  applyRestPose(spriteEntity, HELD_ITEMS.cup)
  clearToolGlb(toolEntity)
  heldKind = 'cup'
  heldFoodId = containerId
  heldFoodIsGlb = false
  applyKindVisibility()
}

// Lobby uses this to stash the viewmodel under the startup overlay so
// the seeded HOOK doesn't peek through. While hidden, both viewmodel
// children stay invisible across item swaps; unhiding re-shows the
// child that matches the current heldKind.
export function setHeldViewmodelHidden(hidden: boolean): void {
  viewmodelHidden = hidden
  applyKindVisibility()
}

export function isHeldViewmodelHidden(): boolean {
  return viewmodelHidden
}

function applyKindVisibility(): void {
  if (toolEntity === null || spriteEntity === null) return
  if (viewmodelHidden) {
    setVisible(toolEntity, false)
    setVisible(spriteEntity, false)
    return
  }
  // GLB-backed food rides the tool child, even though heldKind is 'food'.
  const isSprite = (heldKind === 'food' && !heldFoodIsGlb) || heldKind === 'cup'
  setVisible(toolEntity, !isSprite)
  setVisible(spriteEntity, isSprite)
}

// Returns whichever child is currently active so the sway / gesture
// systems write to the visible viewmodel and leave the hidden one
// alone. Both sprite-based kinds ('food' and 'cup') route to the
// sprite entity — routing 'cup' to the tool entity (as the original
// code did) caused the sway/eat systems to drive the invisible hook
// GLB's pose instead, and the stale GLB visibly leaked through under
// some lighting/visibility conditions.
export function getHeldItemEntity(): Entity | null {
  if (heldKind === 'cup') return spriteEntity
  if (heldKind === 'food') return heldFoodIsGlb ? toolEntity : spriteEntity
  return toolEntity
}

// Both camera-parented children that make up the held viewmodel. Used by
// the BACK TO LOBBY sweep to preserve them — they're attached to
// engine.CameraEntity so swapping them out would force a re-create on
// every lobby return. Either entry may be null if createHeldItem has
// not yet run.
export function getHeldItemViewmodelEntities(): readonly (Entity | null)[] {
  return [toolEntity, spriteEntity]
}

export function getHeldItemKind(): HeldItemKind {
  return heldKind
}

export function getHeldFoodId(): string | null {
  return heldFoodId
}

export function getHeldItemRest(): HeldItemConfig {
  if (heldKind === 'food' && heldFoodIsGlb) return HELD_FOOD_GLB
  return HELD_ITEMS[heldKind]
}

function applyRestPose(entity: Entity, cfg: HeldItemConfig): void {
  const t = Transform.getMutable(entity)
  t.position = cfg.offset
  t.rotation = cfg.rotation
  t.scale = cfg.scale
}

function applySpriteTexture(entity: Entity, texture: string): void {
  // PBR with the texture on emissive (and a black albedo) keeps the
  // unlit basic-material look, while transparencyMode = MTM_ALPHA_TEST
  // ensures alpha is honoured on the unity-desktop client (basic
  // materials render with a black background there).
  Material.setPbrMaterial(entity, {
    texture: Material.Texture.Common({ src: texture }),
    emissiveTexture: Material.Texture.Common({ src: texture }),
    emissiveColor: Color3.White(),
    emissiveIntensity: 1,
    albedoColor: Color4.create(0, 0, 0, 1),
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST,
    alphaTest: 0.5,
    roughness: 1,
    metallic: 0,
    specularIntensity: 0,
    castShadows: false
  })
}

// Strips the GLB off the tool entity so a stale model (e.g. the hook
// the player started with) can't bleed through while a sprite-based
// kind is equipped. VisibilityComponent alone wasn't a hard guarantee —
// pairing visibility=false with an empty src is.
function clearToolGlb(entity: Entity): void {
  GltfContainer.createOrReplace(entity, { src: '' })
}

function setVisible(entity: Entity, visible: boolean): void {
  VisibilityComponent.createOrReplace(entity, { visible })
}
