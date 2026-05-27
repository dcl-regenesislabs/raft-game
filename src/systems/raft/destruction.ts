import {
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  Transform,
  engine,
  pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  MainPlatform,
  Platform,
  PlatformUnderAttack
} from '../../components'
import {
  destroyPlatformEntity,
  getPlatformVisual
} from '../../factories/platform'
import { buildSpectralPbMaterial } from '../../factories/spectralPlatform'
import { playSfx } from '../../audio/sfx'
import { isInventoryActionLocked } from '../../ui/inventoryToggle'
import { showNotification } from '../../ui/notification'
import { isStorageNonEmpty } from '../../ui/storageSession'
import { triggerHammerSwing } from '../hammerSwing'
import { publishLookAtHit } from '../lookAtTarget'
import {
  DESTROY_OPTS,
  DESTROY_RAY_MAX_DISTANCE,
  registerCameraForwardRaycast,
  unregisterCameraForwardRaycast,
  type RaycastHandler
} from './shared'

const RAFT_GLB = 'assets/scene/items/raft_v4.glb'

// Pulsing red palette for the destroy-mode hover indicator.
const DESTROY_GHOST_DIM = Color4.create(0.55, 0.10, 0.10, 1)
const DESTROY_GHOST_BRIGHT = Color4.create(1.0, 0.30, 0.30, 1)
// Radians per second of the sin() that drives the ghost pulse. ~1 Hz —
// same shape the spectral placement ghosts use so destroy / place share
// the same visual rhythm.
const DESTROY_BLINK_RATE = Math.PI * 2
// Local scale applied to the overlay when parented to the hovered raft's
// visual. Slightly above 1 so the red shell renders just outside the wood
// deck — eliminates z-fighting without making the highlight look bloated.
const DESTROY_OVERLAY_SCALE = 1.01

// The non-main raft the cursor is currently over while in destroying mode.
// Drives the on-screen "DELETE PLATFORM" banner and the position of the
// shared red overlay entity.
let destroyHoverEntity: Entity | null = null
// Single shared overlay entity. Created lazily on first enterDestroying.
// We parent it to the hovered raft's GLB visual to inherit position +
// yaw, and toggle scale to 0 to hide it when nothing is hovered. Keeping
// the highlight on a dedicated entity (rather than overriding the
// platform's own GLB material) means there's no renderer-state to clear
// when the cursor moves off — empty modifier arrays and `deleteFrom`
// both leave the original GLB stuck on the previous red material.
let destroyOverlay: Entity | null = null
// Accumulating phase for the destroy ghost pulse. Reset whenever the
// hover target changes so each new platform starts the pulse from the
// dim end, mirroring placement-ghost behaviour.
let destroyBlinkPhase = 0

export function getDestroyHoverEntity(): Entity | null {
  return destroyHoverEntity
}

// Wipes the cached hover ref + raycast registration so the BACK TO
// LOBBY sweep can destroy platforms without leaving a stale entity id
// pointing into a now-empty engine. The overlay entity is also dropped
// — the sweep nukes the engine, so we let enterDestroying lazy-create
// a fresh one next time the hammer enters destroy mode.
export function resetRaftDestructionState(): void {
  unregisterCameraForwardRaycast()
  destroyHoverEntity = null
  destroyOverlay = null
  destroyBlinkPhase = 0
}

export function enterDestroying(): void {
  ensureDestroyOverlay()
  hideDestroyOverlay()
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    if (MainPlatform.getOrNull(entity) !== null) continue
    // Skip platforms a shark has already chosen — locked until the bite
    // resolves. Platforms targeted later are caught by the runtime check
    // inside attachDestroyClick's callback.
    if (PlatformUnderAttack.getOrNull(entity) !== null) continue
    attachDestroyClick(entity)
  }
  registerCameraForwardRaycast(DESTROY_RAY_MAX_DISTANCE, handleDestroyRaycast)
}

export function exitDestroying(): void {
  unregisterCameraForwardRaycast()
  hideDestroyOverlay()
  destroyHoverEntity = null
  destroyBlinkPhase = 0
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    if (MainPlatform.getOrNull(entity) !== null) continue
    pointerEventsSystem.removeOnPointerDown(entity)
  }
}

// Each frame: a platform may become shark-locked AFTER we entered destroy
// mode. Strip its onPointerDown so the "DELETE PLATFORM" hover text and
// cursor feedback disappear — the runtime guard inside the click callback
// already blocks the destroy action itself. Also keeps the red overlay
// glued to the currently hovered raft and pulses its colour.
export function tickDestroying(dt: number): void {
  for (const [entity] of engine.getEntitiesWith(Platform, PlatformUnderAttack)) {
    pointerEventsSystem.removeOnPointerDown(entity)
  }
  if (destroyHoverEntity === null) {
    hideDestroyOverlay()
    destroyBlinkPhase = 0
    return
  }
  // Hover target may have been destroyed (shark bite, BACK TO LOBBY) or
  // newly shark-locked between raycast updates — drop it and hide the
  // overlay so we never paint red on a stale entity.
  if (
    Platform.getOrNull(destroyHoverEntity) === null ||
    MainPlatform.getOrNull(destroyHoverEntity) !== null ||
    PlatformUnderAttack.getOrNull(destroyHoverEntity) !== null
  ) {
    destroyHoverEntity = null
    hideDestroyOverlay()
    destroyBlinkPhase = 0
    return
  }
  showDestroyOverlayOver(destroyHoverEntity)
  destroyBlinkPhase += dt * DESTROY_BLINK_RATE
  const t = (Math.sin(destroyBlinkPhase) + 1) / 2
  paintDestroyOverlay(lerpColor(DESTROY_GHOST_DIM, DESTROY_GHOST_BRIGHT, t))
}

export function commitDestroyFromHover(): boolean {
  if (destroyHoverEntity === null) return false
  if (MainPlatform.getOrNull(destroyHoverEntity) !== null) return false
  if (PlatformUnderAttack.getOrNull(destroyHoverEntity) !== null) return false
  // Block dismantling a storage chest with items still inside so the
  // player can't accidentally vaporise their hoard. Sharks and gameOver
  // bypass this guard because they don't go through this entry point.
  if (isStorageNonEmpty(destroyHoverEntity)) {
    showNotification('Empty the storage before dismantling.')
    return false
  }
  const target = destroyHoverEntity
  destroyHoverEntity = null
  hideDestroyOverlay()
  destroyPlatformEntity(target)
  triggerHammerSwing()
  playSfx('woodBreak')
  return true
}

// --- internals ---

function attachDestroyClick(entity: Entity): void {
  pointerEventsSystem.onPointerDown(
    { entity, opts: DESTROY_OPTS },
    () => {
      if (isInventoryActionLocked()) return
      if (MainPlatform.getOrNull(entity) !== null) return
      // Locked while a shark is committed to this platform.
      if (PlatformUnderAttack.getOrNull(entity) !== null) return
      // Same dismantle guard as `commitDestroyFromHover`: a non-empty
      // storage refuses player-initiated destruction.
      if (isStorageNonEmpty(entity)) {
        showNotification('Empty the storage before dismantling.')
        return
      }
      if (destroyHoverEntity === entity) destroyHoverEntity = null
      hideDestroyOverlay()
      destroyPlatformEntity(entity)
      triggerHammerSwing()
      playSfx('woodBreak')
    }
  )
}

const handleDestroyRaycast: RaycastHandler = (result) => {
  let next: Entity | null = null
  const firstId = result.hits[0]?.entityId
  // Keep lookAtTarget classification fresh while we own the raycaster.
  publishLookAtHit(firstId)
  if (firstId !== undefined) {
    const candidate = firstId as Entity
    if (
      Platform.getOrNull(candidate) !== null &&
      MainPlatform.getOrNull(candidate) === null &&
      // Don't paint the destroy tint on a shark-locked platform — it's
      // already pulsing red from the bite, and it can't be destroyed.
      PlatformUnderAttack.getOrNull(candidate) === null
    ) {
      next = candidate
    }
  }

  if (next === destroyHoverEntity) return
  destroyHoverEntity = next
  destroyBlinkPhase = 0
}

// Lazy-creates the shared overlay entity. It's a raft GLB with an opaque
// red PBR override; we hide it via scale=0 and re-parent it to whichever
// raft visual is currently hovered.
function ensureDestroyOverlay(): Entity {
  if (destroyOverlay !== null) return destroyOverlay
  const overlay = engine.addEntity()
  Transform.create(overlay, {
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(0, 0, 0)
  })
  GltfContainer.create(overlay, { src: RAFT_GLB })
  GltfNodeModifiers.create(overlay, {
    modifiers: [
      {
        path: '',
        castShadows: false,
        material: buildSpectralPbMaterial(DESTROY_GHOST_DIM)
      }
    ]
  })
  destroyOverlay = overlay
  return overlay
}

// Parents the overlay to the hovered raft's visual child so it inherits
// the raft's world position and yaw automatically — local scale slightly
// above 1 keeps it just outside the wood deck to avoid z-fighting.
function showDestroyOverlayOver(platform: Entity): void {
  const overlay = ensureDestroyOverlay()
  const visual = getPlatformVisual(platform)
  if (visual === null) {
    hideDestroyOverlay()
    return
  }
  const transform = Transform.getMutable(overlay)
  transform.parent = visual
  transform.position = Vector3.create(0, 0, 0)
  transform.rotation = Quaternion.Identity()
  transform.scale = Vector3.create(
    DESTROY_OVERLAY_SCALE,
    DESTROY_OVERLAY_SCALE,
    DESTROY_OVERLAY_SCALE
  )
}

function hideDestroyOverlay(): void {
  if (destroyOverlay === null) return
  Transform.getMutable(destroyOverlay).scale = Vector3.create(0, 0, 0)
}

// Replaces the modifiers array so the PBR override picks up the pulse
// colour. Mutating nested oneof fields is brittle across the proto
// bridge, so we swap the whole array each frame (same pattern as
// spectralPlatform.setSpectralColor).
function paintDestroyOverlay(color: Color4): void {
  if (destroyOverlay === null) return
  const mods = GltfNodeModifiers.getMutable(destroyOverlay)
  mods.modifiers = [
    {
      path: '',
      castShadows: false,
      material: buildSpectralPbMaterial(color)
    }
  ]
}

function lerpColor(a: Color4, b: Color4, t: number): Color4 {
  return Color4.create(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
    1
  )
}
