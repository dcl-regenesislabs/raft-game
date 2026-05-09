import { Entity, engine, pointerEventsSystem } from '@dcl/sdk/ecs'

import {
  MainPlatform,
  Platform,
  PlatformUnderAttack
} from '../../components'
import {
  PLATFORM_COLOR,
  PLATFORM_DESTROY_TINT,
  applyPlatformMaterial,
  destroyPlatformEntity
} from '../../factories/platform'
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

// The non-main raft the cursor is currently over while in destroying mode.
// Drives the in-world tint and the on-screen "DELETE PLATFORM" banner.
let destroyHoverEntity: Entity | null = null

export function getDestroyHoverEntity(): Entity | null {
  return destroyHoverEntity
}

// Wipes the cached hover ref + raycast registration so the BACK TO
// LOBBY sweep can destroy platforms without leaving a stale entity id
// pointing into a now-empty engine.
export function resetRaftDestructionState(): void {
  unregisterCameraForwardRaycast()
  destroyHoverEntity = null
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
  if (destroyHoverEntity !== null) {
    if (Platform.getOrNull(destroyHoverEntity) !== null) {
      applyPlatformMaterial(destroyHoverEntity, PLATFORM_COLOR)
    }
    destroyHoverEntity = null
  }
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    if (MainPlatform.getOrNull(entity) !== null) continue
    pointerEventsSystem.removeOnPointerDown(entity)
  }
}

// Each frame: a platform may become shark-locked AFTER we entered destroy
// mode. Strip its onPointerDown so the "DELETE PLATFORM" hover text and
// cursor feedback disappear — the runtime guard inside the click callback
// already blocks the destroy action itself.
export function tickDestroying(): void {
  for (const [entity] of engine.getEntitiesWith(Platform, PlatformUnderAttack)) {
    pointerEventsSystem.removeOnPointerDown(entity)
  }
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

  if (
    destroyHoverEntity !== null &&
    Platform.getOrNull(destroyHoverEntity) !== null
  ) {
    applyPlatformMaterial(destroyHoverEntity, PLATFORM_COLOR)
  }
  destroyHoverEntity = next
  if (destroyHoverEntity !== null) {
    applyPlatformMaterial(destroyHoverEntity, PLATFORM_DESTROY_TINT)
  }
}
