import {
  Entity,
  GltfNodeModifiers,
  engine,
  pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'

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

// Pulsing red palette applied to the hovered platform's existing GLB
// visual via GltfNodeModifiers — no duplicate entity, just an in-place
// material override that's stripped again when the cursor moves off.
const DESTROY_GHOST_DIM = Color4.create(0.55, 0.10, 0.10, 1)
const DESTROY_GHOST_BRIGHT = Color4.create(1.0, 0.30, 0.30, 1)
// Radians per second of the sin() that drives the ghost pulse. ~1 Hz —
// same shape the spectral placement ghosts use so destroy / place share
// the same visual rhythm.
const DESTROY_BLINK_RATE = Math.PI * 2

// The non-main raft the cursor is currently over while in destroying mode.
// Drives the on-screen "DELETE PLATFORM" banner and the in-place ghost
// material applied to that raft's visual child.
let destroyHoverEntity: Entity | null = null
// Accumulating phase for the destroy ghost pulse. Reset whenever the
// hover target changes so each new platform starts the pulse from the
// dim end, mirroring placement-ghost behaviour.
let destroyBlinkPhase = 0

export function getDestroyHoverEntity(): Entity | null {
  return destroyHoverEntity
}

// Wipes the cached hover ref + raycast registration so the BACK TO
// LOBBY sweep can destroy platforms without leaving a stale entity id
// pointing into a now-empty engine. The ghost is an in-place modifier
// on the platform itself, so destroying the platform takes the override
// with it — no separate teardown needed.
export function resetRaftDestructionState(): void {
  unregisterCameraForwardRaycast()
  destroyHoverEntity = null
  destroyBlinkPhase = 0
}

export function enterDestroying(): void {
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
  if (destroyHoverEntity !== null) clearDestroyGhost(destroyHoverEntity)
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
// already blocks the destroy action itself. Also advances the ghost pulse
// on the currently hovered raft so the red override reads as a heartbeat.
export function tickDestroying(dt: number): void {
  for (const [entity] of engine.getEntitiesWith(Platform, PlatformUnderAttack)) {
    pointerEventsSystem.removeOnPointerDown(entity)
  }
  if (destroyHoverEntity === null) return
  destroyBlinkPhase += dt * DESTROY_BLINK_RATE
  const t = (Math.sin(destroyBlinkPhase) + 1) / 2
  applyDestroyGhost(destroyHoverEntity, lerpColor(DESTROY_GHOST_DIM, DESTROY_GHOST_BRIGHT, t))
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
  destroyPlatformEntity(target)
  triggerHammerSwing()
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
      destroyPlatformEntity(entity)
      triggerHammerSwing()
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

  if (destroyHoverEntity !== null) clearDestroyGhost(destroyHoverEntity)
  destroyHoverEntity = next
  destroyBlinkPhase = 0
  if (destroyHoverEntity !== null) {
    applyDestroyGhost(destroyHoverEntity, DESTROY_GHOST_DIM)
  }
}

// Writes (or refreshes) the red PBR override on the platform's visual
// child. Creates the GltfNodeModifiers component on first call and
// mutates the existing one on subsequent calls — replacing the modifiers
// array each frame mirrors what spectralPlatform does, because mutating
// nested oneof fields is brittle across the proto bridge.
function applyDestroyGhost(platform: Entity, color: Color4): void {
  const visual = getPlatformVisual(platform)
  if (visual === null) return
  const spec = {
    modifiers: [
      {
        path: '',
        castShadows: false,
        material: buildSpectralPbMaterial(color)
      }
    ]
  }
  if (GltfNodeModifiers.getOrNull(visual) === null) {
    GltfNodeModifiers.create(visual, spec)
    return
  }
  GltfNodeModifiers.getMutable(visual).modifiers = spec.modifiers
}

// Strips the override so the raft pops back to its native wood textures
// the moment the cursor leaves it (or destroy mode exits). Safe to call
// when no override is present.
function clearDestroyGhost(platform: Entity): void {
  const visual = getPlatformVisual(platform)
  if (visual === null) return
  if (GltfNodeModifiers.getOrNull(visual) === null) return
  GltfNodeModifiers.deleteFrom(visual)
}

function lerpColor(a: Color4, b: Color4, t: number): Color4 {
  return Color4.create(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
    1
  )
}
