import { Entity, Transform, engine } from '@dcl/sdk/ecs'

import { FloatingGarbage, FloatingIsland } from '../components'
import { getPlatformExtent } from '../factories/platformExtent'

// Interpolation duration for the pull / release shift
const ANCHOR_INTERP_DURATION = 3.0
// Distance between the island edge and the raft edge so the player can
// jump across but the island doesn't overlap the raft geometry.
const ANCHOR_GAP = 3

type AnchorPhase = 'idle' | 'pulling' | 'anchored' | 'releasing'

let phase: AnchorPhase = 'idle'
let anchoredIsland: Entity | null = null
// Total offset to apply (anchor point → raft center)
let targetOffsetX = 0
let targetOffsetZ = 0
// How much of the offset has been applied so far
let appliedOffsetX = 0
let appliedOffsetZ = 0
// Snapshot of appliedOffset at the start of the current interpolation
let startOffsetX = 0
let startOffsetZ = 0
// Snapshot of the target for the current interpolation
let endOffsetX = 0
let endOffsetZ = 0
let interpElapsed = 0
// Relative offset from the island center where the hook stuck
let hookRelX = 0
let hookRelZ = 0

export function isAnchored(): boolean {
  return phase === 'anchored'
}

export function getAnchorPhase(): AnchorPhase {
  return phase
}

export function getAnchoredIsland(): Entity | null {
  return anchoredIsland
}

// Returns the hook's world position on the anchored island (island center + relative offset)
export function getAnchorHookPos(): { x: number; z: number } | null {
  if (anchoredIsland === null) return null
  const pos = Transform.getOrNull(anchoredIsland)
  if (pos === null) return null
  return { x: pos.position.x + hookRelX, z: pos.position.z + hookRelZ }
}

export function beginAnchor(islandEntity: Entity, anchorX: number, anchorZ: number): void {
  if (phase !== 'idle') return
  anchoredIsland = islandEntity

  // Store hook's relative position on the island
  const islandPos = Transform.get(islandEntity).position
  hookRelX = anchorX - islandPos.x
  hookRelZ = anchorZ - islandPos.z

  // Compute target: shift the island toward the raft but keep a gap
  // so they don't overlap. The island stops with its edge near the
  // raft edge, separated by ANCHOR_GAP metres.
  const extent = getPlatformExtent()
  const dx = extent.cx - islandPos.x
  const dz = extent.cz - islandPos.z
  const dist = Math.sqrt(dx * dx + dz * dz)
  if (dist < 0.01) {
    targetOffsetX = 0
    targetOffsetZ = 0
  } else {
    // Direction from island center to raft center
    const nx = dx / dist
    const nz = dz / dist
    // How far to move: close the gap minus raft half-extent, island
    // radius, and the desired air gap between them.
    const islandRadius = 10
    const raftHalf = Math.max(
      (extent.maxX - extent.minX) / 2,
      (extent.maxZ - extent.minZ) / 2
    )
    const keepDist = raftHalf + islandRadius + ANCHOR_GAP
    const moveBy = Math.max(0, dist - keepDist)
    targetOffsetX = nx * moveBy
    targetOffsetZ = nz * moveBy
  }

  startOffsetX = appliedOffsetX
  startOffsetZ = appliedOffsetZ
  endOffsetX = targetOffsetX
  endOffsetZ = targetOffsetZ
  interpElapsed = 0
  phase = 'pulling'
}

export function releaseAnchor(): void {
  if (phase !== 'anchored') return
  startOffsetX = appliedOffsetX
  startOffsetZ = appliedOffsetZ
  endOffsetX = 0
  endOffsetZ = 0
  interpElapsed = 0
  phase = 'releasing'
}

export function resetAnchorState(): void {
  // Snap everything back instantly if mid-anchor
  if (appliedOffsetX !== 0 || appliedOffsetZ !== 0) {
    const dx = -appliedOffsetX
    const dz = -appliedOffsetZ
    applyDeltaToAll(dx, dz)
    restoreIslandVelocities()
  }
  phase = 'idle'
  anchoredIsland = null
  targetOffsetX = 0
  targetOffsetZ = 0
  appliedOffsetX = 0
  appliedOffsetZ = 0
  startOffsetX = 0
  startOffsetZ = 0
  endOffsetX = 0
  endOffsetZ = 0
  interpElapsed = 0
  hookRelX = 0
  hookRelZ = 0
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

export function anchorInterpolationSystem(dt: number): void {
  if (phase === 'idle' || phase === 'anchored') return

  // Guard: if the anchored island was removed mid-pull, abort
  if (phase === 'pulling' && anchoredIsland !== null) {
    if (Transform.getOrNull(anchoredIsland) === null) {
      resetAnchorState()
      return
    }
  }

  interpElapsed += dt
  const rawT = Math.min(1, interpElapsed / ANCHOR_INTERP_DURATION)
  const t = smoothstep(rawT)

  const newAppliedX = startOffsetX + (endOffsetX - startOffsetX) * t
  const newAppliedZ = startOffsetZ + (endOffsetZ - startOffsetZ) * t
  const dx = newAppliedX - appliedOffsetX
  const dz = newAppliedZ - appliedOffsetZ
  appliedOffsetX = newAppliedX
  appliedOffsetZ = newAppliedZ

  applyDeltaToAll(dx, dz)

  if (rawT >= 1) {
    if (phase === 'pulling') {
      freezeIslandVelocities()
      phase = 'anchored'
    } else if (phase === 'releasing') {
      restoreIslandVelocities()
      anchoredIsland = null
      phase = 'idle'
    }
  }
}

function applyDeltaToAll(dx: number, dz: number): void {
  if (dx === 0 && dz === 0) return

  for (const [entity] of engine.getEntitiesWith(FloatingIsland, Transform)) {
    const pos = Transform.getMutable(entity).position
    pos.x += dx
    pos.z += dz
  }

  for (const [entity] of engine.getEntitiesWith(FloatingGarbage, Transform)) {
    const pos = Transform.getMutable(entity).position
    pos.x += dx
    pos.z += dz
  }
}

function freezeIslandVelocities(): void {
  for (const [entity] of engine.getEntitiesWith(FloatingIsland)) {
    const island = FloatingIsland.getMutable(entity)
    island.velocityX = 0
    island.velocityZ = 0
  }
}

function restoreIslandVelocities(): void {
  for (const [entity] of engine.getEntitiesWith(FloatingIsland)) {
    const island = FloatingIsland.getMutable(entity)
    island.velocityX = island.baseVelocityX
    island.velocityZ = island.baseVelocityZ
  }
}
