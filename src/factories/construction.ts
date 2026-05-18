import {
  ColliderLayer,
  Entity,
  GltfContainer,
  InputAction,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  PointerEventType,
  PointerEvents,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  PlatformConstruction,
  PurifierState,
  STORAGE_SLOT_COUNT,
  StorageContents
} from '../components'
import { PLATFORM_SIZE_X, PLATFORM_SIZE_Y, PLATFORM_SIZE_Z } from './platform'

export type ConstructionKind = 'grill' | 'purifier' | 'storage'

export const CONSTRUCTION_KINDS: readonly ConstructionKind[] = ['grill', 'purifier', 'storage']

const SRC: Record<ConstructionKind, string> = {
  grill: 'assets/scene/items/grill.glb',
  purifier: 'assets/scene/items/purifier_v2.glb',
  storage: 'assets/scene/items/storage.glb'
}

// Visual world-size of the construction GLB. Tuned to read as a piece of
// furniture sitting on the raft deck, not dwarfing it.
const VISUAL_SIZE_M: Record<ConstructionKind, number> = {
  grill: 0.6,
  purifier: 0.72,
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
  purifier: 0.8,
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
  // Purifier needs a second F-key event for the "add wood" path —
  // grill/storage stay E-only. The hover prompt shows both lines on the
  // purifier so the player can see which key does what.
  const pointerEvents = [
    {
      eventType: PointerEventType.PET_DOWN,
      eventInfo: {
        button: InputAction.IA_PRIMARY,
        hoverText: HOVER_TEXT[kind],
        maxDistance: HOVER_MAX_DISTANCE,
        showFeedback: true
      }
    }
  ]
  if (kind === 'purifier') {
    // Fire starts off → fuel prompt is visible at placement. The
    // purifier process system hides this entry whenever the flame is
    // burning, since one log at a time is the design (no stacking).
    pointerEvents.push({
      eventType: PointerEventType.PET_DOWN,
      eventInfo: {
        button: InputAction.IA_SECONDARY,
        hoverText: 'Add wood',
        maxDistance: HOVER_MAX_DISTANCE,
        showFeedback: true
      }
    })
  }
  PointerEvents.create(child, { pointerEvents })
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
  if (kind === 'purifier') {
    const saltCylinder = createBowlWaterCylinder(child, SALT_BOWL, SALT_WATER_COLOR)
    const freshCylinder = createBowlWaterCylinder(child, FRESH_BOWL, FRESH_WATER_COLOR)
    PurifierState.create(platform, {
      saltCylinder,
      freshCylinder,
      saltAmount: 0,
      freshAmount: 0,
      fireSec: 0,
      flameSprite: engine.RootEntity
    })
  }
  return child
}

// Rebuilds the purifier child's PointerEvents so the E-hover text
// reflects the current bowl state (Add salt water / Grab purified
// water). The F "Add wood" entry is included only when `showFuel` is
// true — the process system hides it while the fire is already
// burning, since the purifier doesn't stack logs (one at a time).
// `purifierProcessSystem` calls this on transitions, not every frame,
// so the SDK doesn't churn the component repeatedly.
export function setPurifierHoverPrompt(
  child: Entity,
  primaryText: string,
  showFuel: boolean
): void {
  const events = [
    {
      eventType: PointerEventType.PET_DOWN,
      eventInfo: {
        button: InputAction.IA_PRIMARY,
        hoverText: primaryText,
        maxDistance: HOVER_MAX_DISTANCE,
        showFeedback: true
      }
    }
  ]
  if (showFuel) {
    events.push({
      eventType: PointerEventType.PET_DOWN,
      eventInfo: {
        button: InputAction.IA_SECONDARY,
        hoverText: 'Add wood',
        maxDistance: HOVER_MAX_DISTANCE,
        showFeedback: true
      }
    })
  }
  PointerEvents.createOrReplace(child, { pointerEvents: events })
}

// Local-frame description of one bowl's water-fill geometry inside the
// purifier GLB. Positions are in mesh-local coordinates (the same units
// as the unscaled GLB) — the construction child entity already applies
// the visual scale, so a sub-entity parented to it can use mesh-local
// values directly. The cylinder defaults to "empty" (scale.y = 0) and
// is animated by `purifierFillSystem` reading `PurifierState.{salt,fresh}Amount`.
type BowlGeometry = {
  // XZ position of the bowl center in mesh-local units.
  centerX: number
  centerZ: number
  // Inner floor Y (where the water "sits") and rim Y (the top of the
  // visible fill). Both in mesh-local units.
  floorY: number
  rimY: number
  // Inner diameter of the bowl in WORLD METRES — converted to local
  // scale via the uniform 0.72m visual size of the construction GLB.
  innerDiameterM: number
}

// Centre bowl (salt-water input). Position derived from front+side ortho
// renders of `assets/scene/items/purifier_v2.glb` in Blender; the bowl
// interior spans roughly Y=-0.20..0.0 with the rim slightly offset from
// the GLB origin.
const SALT_BOWL: BowlGeometry = {
  centerX: 0.09,
  centerZ: 0.09,
  floorY: 0.1,
  rimY: 0.3,
  innerDiameterM: 0.22
}

// Right-hand bowl (fresh-water output). Smaller than the centre bowl;
// sits lower and to the right of the GLB origin.
const FRESH_BOWL: BowlGeometry = {
  centerX: -0.67,
  centerZ: 0.03,
  floorY: 0,
  rimY: 0.12,
  innerDiameterM: 0.17
}

// Salt water reads as a murky grey-green with a faint blue tint so it
// looks unappealing next to the bright fresh-water cylinder. Alpha kept
// below 1 so the player can see through to the bowl interior.
const SALT_WATER_COLOR = Color4.create(0.55, 0.6, 0.58, 0.7)
// Fresh water is a clean tropical blue — same alpha as salt so the two
// read as the "same substance, different state".
const FRESH_WATER_COLOR = Color4.create(0.2, 0.55, 0.95, 0.7)

// Uniform world-scale factor applied by `createConstruction` when
// parenting the GLB under the platform (3 × 0.24 = 0.72 on each axis).
// Sub-entities parented to the construction child inherit the same
// 0.72 multiplier, so converting a target world-metre size to local
// scale = sizeM / 0.72.
const CONSTRUCTION_WORLD_SCALE = 0.72

function createBowlWaterCylinder(
  constructionChild: Entity,
  bowl: BowlGeometry,
  color: Color4
): Entity {
  const cylinder = engine.addEntity()
  Transform.create(cylinder, {
    parent: constructionChild,
    // Centred on the bowl rim by default; `purifierFillSystem` overrides
    // both Y position and scale.y whenever the fill level changes.
    position: Vector3.create(bowl.centerX, bowl.floorY, bowl.centerZ),
    scale: Vector3.create(
      bowl.innerDiameterM / CONSTRUCTION_WORLD_SCALE,
      0,
      bowl.innerDiameterM / CONSTRUCTION_WORLD_SCALE
    )
  })
  MeshRenderer.setCylinder(cylinder)
  Material.setPbrMaterial(cylinder, {
    albedoColor: color,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    metallic: 0,
    roughness: 0.4,
    castShadows: false,
    specularIntensity: 0.5
  })
  return cylinder
}

// Returns the geometry parameters the fill system needs to convert a
// 0..1 fill level into a Transform position + scale. Kept in this
// module so SALT_BOWL / FRESH_BOWL stay alongside their visual
// definitions.
export function getPurifierBowlGeometry(which: 'salt' | 'fresh'): {
  floorY: number
  rimY: number
  worldScale: number
} {
  const bowl = which === 'salt' ? SALT_BOWL : FRESH_BOWL
  return {
    floorY: bowl.floorY,
    rimY: bowl.rimY,
    worldScale: CONSTRUCTION_WORLD_SCALE
  }
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
          button: InputAction.IA_PRIMARY,
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
