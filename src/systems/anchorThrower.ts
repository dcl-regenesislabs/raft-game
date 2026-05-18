import {
  Entity,
  GltfContainer,
  InputAction,
  PointerEventType,
  Transform,
  VisibilityComponent,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import { playSfx } from '../audio/sfx'
import {
  HOOK_CHARGE_DURATION_S,
  HOOK_GRAVITY,
  HOOK_MAX_FLIGHT_TIME_S,
  HOOK_MAX_THROW_SPEED,
  HOOK_MIN_THROW_SPEED,
  HOOK_REEL_SPEED
} from '../config/gameConfig'
import { FloatingIsland } from '../components'
import {
  beginAnchor,
  getAnchoredIsland,
  getAnchorHookPos,
  isAnchored,
  releaseAnchor,
  resetAnchorState
} from './anchorState'
import { ANCHOR_FORWARD_ROTATION, createAnchorEntity } from '../factories/anchor'
import { Platform } from '../components'
import { RAFT_SIZE } from '../factories/platform'
import { getPlatformExtent } from '../factories/platformExtent'
import { createRopeEntity, hideRope, updateRopeBetween } from '../factories/rope'
import { getHeldItemKind, isHeldViewmodelHidden } from '../factories/heldItem'
import { WATER_LEVEL } from '../factories/sceneLevels'
import { actionButtonJustPressed, isActionButtonPressed } from '../ui/actionButton'
import { isPointerLocked } from '../ui/cursorLock'
import { isFishingLineActive } from './fishingRod'
import { isHookInFlight } from './hookThrower'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { isSelectionPointerLockoutActive } from '../ui/inventoryState'

const CAMERA_FORWARD = Vector3.create(0, 0, 1)
const HAND_OFFSET_LOCAL = Vector3.create(0.25, -0.45, 0.4)

// Island hit detection radius — tight enough to ensure the anchor visually
// lands on sand above water level.
const ISLAND_HIT_RADIUS = 8
const ISLAND_HIT_RADIUS_SQ = ISLAND_HIT_RADIUS * ISLAND_HIT_RADIUS
// Y position where the anchor sits when anchored on the island surface.
// 0.15 above water level so it rests visibly on the sand.
const ANCHOR_ON_ISLAND_Y_OFFSET = 0.15

// Despawn when anchor reaches player hand (on raft) or raft edge (reeling to raft)
const ANCHOR_REEL_DESPAWN_RADIUS_XZ = 1.5


// Tie post: a vertical stick on the raft edge where the rope attaches
// when the player leaves the raft. Uses the fishing rod GLB as placeholder.
const TIE_POST_SRC = 'assets/scene/items/fishing_rod.glb'
// After 90° Z rotation: model Y axis → world X, model X axis → world Y
// So scale Y = world height (short), scale X/Z = world thickness (wide)
const TIE_POST_SCALE = Vector3.create(0.25, 1.6, 1.6)

let anchorEntity: Entity | null = null
let ropeEntity: Entity | null = null
let tiePostEntity: Entity | null = null
let tiePostVisible = false
let chargeT = 0
let charging = false

type AnchorPhaseLocal = 'flying' | 'anchored' | 'reeling'
let anchorPhase: AnchorPhaseLocal = 'flying'
let velocity = Vector3.Zero()
let elapsed = 0

export function getAnchorChargeT(): number {
  return chargeT
}

export function isAnchorInFlight(): boolean {
  return anchorEntity !== null
}

export function resetAnchorThrowerState(): void {
  anchorEntity = null
  ropeEntity = null
  tiePostEntity = null
  tiePostVisible = false
  chargeT = 0
  charging = false
  elapsed = 0
}

// Returns true if the player is standing on any raft platform cell.
// Checks each platform's 3x3 footprint exactly — no margin.
function isPlayerOnRaft(): boolean {
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (player === null) return true // assume on raft if unknown
  const px = player.position.x
  const pz = player.position.z
  const half = RAFT_SIZE / 2
  for (const [entity] of engine.getEntitiesWith(Platform, Transform)) {
    const pos = Transform.get(entity).position
    if (
      px >= pos.x - half && px <= pos.x + half &&
      pz >= pos.z - half && pz <= pos.z + half
    ) {
      return true
    }
  }
  return false
}

// Compute the closest point on the raft AABB edge to a target XZ position,
// at WATER_LEVEL + small offset so the rope visibly emerges from the deck.
function computeRaftTiePoint(targetX: number, targetZ: number): Vector3 {
  const ext = getPlatformExtent()
  // Clamp target to the AABB edge
  const clampedX = Math.max(ext.minX, Math.min(ext.maxX, targetX))
  const clampedZ = Math.max(ext.minZ, Math.min(ext.maxZ, targetZ))
  // If the target is outside the AABB, the clamped point is already on the edge.
  // If inside (shouldn't happen for an anchor), push to nearest edge.
  let tieX = clampedX
  let tieZ = clampedZ
  if (
    clampedX > ext.minX && clampedX < ext.maxX &&
    clampedZ > ext.minZ && clampedZ < ext.maxZ
  ) {
    // Inside — push to nearest edge
    const dMinX = clampedX - ext.minX
    const dMaxX = ext.maxX - clampedX
    const dMinZ = clampedZ - ext.minZ
    const dMaxZ = ext.maxZ - clampedZ
    const minD = Math.min(dMinX, dMaxX, dMinZ, dMaxZ)
    if (minD === dMinX) tieX = ext.minX
    else if (minD === dMaxX) tieX = ext.maxX
    else if (minD === dMinZ) tieZ = ext.minZ
    else tieZ = ext.maxZ
  }
  return Vector3.create(tieX, WATER_LEVEL + 0.25, tieZ)
}

export function anchorThrowerSystem(dt: number): void {
  if (isHeldViewmodelHidden()) {
    cancelCharge()
    return
  }
  const locked = isInventoryActionLocked()
  const handPos = computeHandPos()

  if (anchorEntity !== null) {
    cancelCharge()
    if (handPos === null) return
    advanceAnchor(dt, handPos)
    return
  }

  if (locked) { cancelCharge(); return }
  if (!isMobile() && !isPointerLocked()) { cancelCharge(); return }

  // Only active when the anchor tool is equipped and player is on the raft
  if (getHeldItemKind() !== 'anchor') { cancelCharge(); return }
  if (!isPlayerOnRaft()) { cancelCharge(); return }
  if (isFishingLineActive() || isHookInFlight()) { cancelCharge(); return }

  if (handPos === null) return
  tickCharge(dt, handPos)
}

function tickCharge(dt: number, handPos: Vector3): void {
  const mobile = isMobile()
  const justPressed = mobile
    ? actionButtonJustPressed()
    : inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)
  const stillHeld = mobile
    ? isActionButtonPressed()
    : inputSystem.isPressed(InputAction.IA_POINTER)

  if (!charging) {
    if (justPressed && !isSelectionPointerLockoutActive()) {
      charging = true
      chargeT = 0
    }
    return
  }

  if (!stillHeld) {
    spawnAndThrow(handPos, chargeT)
    cancelCharge()
    return
  }

  chargeT = Math.min(1, chargeT + dt / HOOK_CHARGE_DURATION_S)
}

function cancelCharge(): void {
  charging = false
  chargeT = 0
}

function spawnAndThrow(handPos: Vector3, strength: number): void {
  const aim = computeAimDir()
  if (aim === null) return
  playSfx('hookThrow')
  const speed =
    HOOK_MIN_THROW_SPEED + (HOOK_MAX_THROW_SPEED - HOOK_MIN_THROW_SPEED) * strength
  anchorEntity = createAnchorEntity()
  if (ropeEntity === null) ropeEntity = createRopeEntity()

  velocity = Vector3.create(aim.x * speed, aim.y * speed, aim.z * speed)
  elapsed = 0
  anchorPhase = 'flying'

  const transform = Transform.getMutable(anchorEntity)
  transform.position = Vector3.create(handPos.x, handPos.y, handPos.z)
  updateRopeBetween(ropeEntity, handPos, handPos)
}

function advanceAnchor(dt: number, handPos: Vector3): void {
  if (anchorEntity === null) return
  elapsed += dt

  const transform = Transform.getMutable(anchorEntity)
  const pos = transform.position
  const onRaft = isPlayerOnRaft()

  if (anchorPhase === 'flying') {
    velocity = Vector3.create(
      velocity.x,
      velocity.y - HOOK_GRAVITY * dt,
      velocity.z
    )
    const nextX = pos.x + velocity.x * dt
    const nextY = pos.y + velocity.y * dt
    const nextZ = pos.z + velocity.z * dt

    // Check for island hit at any point during flight
    const hitIsland = findIslandNearPoint(nextX, nextZ)
    if (hitIsland !== null && nextY <= WATER_LEVEL + ANCHOR_ON_ISLAND_Y_OFFSET + 2) {
      // Land on the island surface
      const islandY = Transform.get(hitIsland).position.y + ANCHOR_ON_ISLAND_Y_OFFSET
      transform.position = Vector3.create(nextX, islandY, nextZ)
      anchorPhase = 'anchored'
      velocity = Vector3.Zero()
      beginAnchor(hitIsland, nextX, nextZ)
    } else if (nextY <= WATER_LEVEL || elapsed > HOOK_MAX_FLIGHT_TIME_S) {
      // Missed — hit water, reel back
      const splashX = pos.x + velocity.x * dt
      const splashZ = pos.z + velocity.z * dt
      transform.position = Vector3.create(splashX, WATER_LEVEL, splashZ)
      anchorPhase = 'reeling'
      velocity = Vector3.Zero()
    } else {
      transform.position = Vector3.create(nextX, nextY, nextZ)
    }
  } else if (anchorPhase === 'reeling') {
    // Always reel toward the player's hand
    const dx = handPos.x - pos.x
    const dz = handPos.z - pos.z
    const distXZ = Math.sqrt(dx * dx + dz * dz)
    if (distXZ < ANCHOR_REEL_DESPAWN_RADIUS_XZ) {
      despawnAnchor()
      return
    }
    const step = Math.min(HOOK_REEL_SPEED * dt, distXZ)
    const nx = dx / distXZ
    const nz = dz / distXZ
    transform.position = Vector3.create(
      pos.x + nx * step,
      WATER_LEVEL,
      pos.z + nz * step
    )
  } else if (anchorPhase === 'anchored') {
    const anchorPos = getAnchorHookPos()
    if (anchorPos === null) {
      releaseAnchor()
      anchorPhase = 'reeling'
    } else {
      // Keep anchor on the island surface
      const island = getAnchoredIsland()
      const islandY = island ? Transform.get(island).position.y + ANCHOR_ON_ISLAND_Y_OFFSET : WATER_LEVEL
      transform.position = Vector3.create(anchorPos.x, islandY, anchorPos.z)
      // Only allow releasing the anchor while standing on the raft.
      // Releasing from the island would lose the raft connection.
      if (onRaft) {
        const mobile = isMobile()
        const justPressed = mobile
          ? actionButtonJustPressed()
          : inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)
        if (justPressed && isAnchored()) {
          releaseAnchor()
          anchorPhase = 'reeling'
        }
      }
    }
  }

  // Rope endpoint: hand while on raft, raft edge tie post while off raft.
  if (ropeEntity !== null && anchorEntity !== null) {
    const anchorPos = Transform.get(anchorEntity).position
    let ropeStart: Vector3
    if (onRaft) {
      ropeStart = handPos
      hideTiePost()
    } else {
      ropeStart = computeRaftTiePoint(anchorPos.x, anchorPos.z)
      showTiePostAt(ropeStart)
    }
    updateRopeBetween(ropeEntity, ropeStart, anchorPos)
    // Align the anchor model so its top points toward the rope origin
    alignAnchorToRope(anchorPos, ropeStart)
  }
}

function despawnAnchor(): void {
  if (isAnchored()) resetAnchorState()
  if (anchorEntity !== null) {
    engine.removeEntity(anchorEntity)
    anchorEntity = null
  }
  if (ropeEntity !== null) hideRope(ropeEntity)
  hideTiePost()
}

function ensureTiePost(): Entity {
  if (tiePostEntity === null) {
    tiePostEntity = engine.addEntity()
    Transform.create(tiePostEntity, {
      position: Vector3.Zero(),
      rotation: Quaternion.fromEulerDegrees(0, 0, 0),
      scale: TIE_POST_SCALE
    })
    GltfContainer.create(tiePostEntity, { src: TIE_POST_SRC })
    VisibilityComponent.create(tiePostEntity, { visible: false })
    tiePostVisible = false
  }
  return tiePostEntity
}

function showTiePostAt(pos: Vector3): void {
  const post = ensureTiePost()
  const t = Transform.getMutable(post)
  // Push the post 0.25m inward from the raft edge toward the raft center
  const ext = getPlatformExtent()
  const toCenterX = ext.cx - pos.x
  const toCenterZ = ext.cz - pos.z
  const dist = Math.sqrt(toCenterX * toCenterX + toCenterZ * toCenterZ)
  const inset = dist > 0.01 ? 0.5 : 0
  t.position = Vector3.create(
    pos.x + (toCenterX / dist) * inset,
    pos.y,
    pos.z + (toCenterZ / dist) * inset
  )
  // Rod model lies along its local X axis — rotate 90° on Z to stand it vertical
  t.rotation = Quaternion.fromEulerDegrees(0, 0, 90)
  if (!tiePostVisible) {
    VisibilityComponent.createOrReplace(post, { visible: true })
    tiePostVisible = true
  }
}

function hideTiePost(): void {
  if (tiePostEntity !== null && tiePostVisible) {
    VisibilityComponent.createOrReplace(tiePostEntity, { visible: false })
    tiePostVisible = false
  }
}

// Rotate the anchor so its forward axis (the rope attachment end) points
// toward the rope start position.
function alignAnchorToRope(anchorPos: Vector3, ropeStart: Vector3): void {
  if (anchorEntity === null) return
  const dx = anchorPos.x - ropeStart.x
  const dy = anchorPos.y - ropeStart.y
  const dz = anchorPos.z - ropeStart.z
  const horiz = Math.sqrt(dx * dx + dz * dz)
  const yawDeg = Math.atan2(dx, dz) * (180 / Math.PI)
  const pitchDeg = -Math.atan2(dy, horiz) * (180 / Math.PI)
  // The model's forward (rope end) is along +Z after ANCHOR_FORWARD_ROTATION
  // (-90° on X). Compose heading on top of the base rotation.
  const heading = Quaternion.fromEulerDegrees(pitchDeg, yawDeg, 0)
  Transform.getMutable(anchorEntity).rotation = Quaternion.multiply(
    heading,
    ANCHOR_FORWARD_ROTATION
  )
}

function findIslandNearPoint(x: number, z: number): Entity | null {
  for (const [entity] of engine.getEntitiesWith(FloatingIsland, Transform)) {
    // Pool slot: hidden islands still have Transform, so filter them out
    // before the hook can latch onto invisible geometry.
    if (!FloatingIsland.get(entity).active) continue
    const pos = Transform.get(entity).position
    const dx = x - pos.x
    const dz = z - pos.z
    if (dx * dx + dz * dz <= ISLAND_HIT_RADIUS_SQ) return entity
  }
  return null
}

// Aim direction with elevation bias for arc
const AIM_ELEVATION_BIAS = Math.sin(30 * Math.PI / 180)

function computeAimDir(): Vector3 | null {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (cam === null) return null
  const forward = Vector3.rotate(CAMERA_FORWARD, cam.rotation as Quaternion)
  const biased = Vector3.create(forward.x, forward.y + AIM_ELEVATION_BIAS, forward.z)
  const len = Math.sqrt(biased.x * biased.x + biased.y * biased.y + biased.z * biased.z)
  const aim = Vector3.create(biased.x / len, biased.y / len, biased.z / len)
  const MAX_UP_Y = Math.SQRT1_2
  if (aim.y <= MAX_UP_Y) return aim
  const horiz = Math.sqrt(aim.x * aim.x + aim.z * aim.z)
  if (horiz < 0.0001) {
    const player = Transform.getOrNull(engine.PlayerEntity)
    if (player === null) return null
    const playerFwd = Vector3.rotate(CAMERA_FORWARD, player.rotation as Quaternion)
    return Vector3.create(playerFwd.x * MAX_UP_Y, MAX_UP_Y, playerFwd.z * MAX_UP_Y)
  }
  const scale = MAX_UP_Y / horiz
  return Vector3.create(aim.x * scale, MAX_UP_Y, aim.z * scale)
}

function computeHandPos(): Vector3 | null {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (cam === null) return null
  const localOffset = Vector3.rotate(HAND_OFFSET_LOCAL, cam.rotation as Quaternion)
  return Vector3.create(
    cam.position.x + localOffset.x,
    cam.position.y + localOffset.y,
    cam.position.z + localOffset.z
  )
}
