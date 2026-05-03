import { Transform, engine } from '@dcl/sdk/ecs'

import { Platform } from '../components'
import { GRID_ORIGIN, RAFT_SIZE } from './platform'

// Floor for the orbit-ring radius — keeps sharks at a sensible distance even
// when only the base raft exists. The AABB fields below stay tight against
// the actual platform footprint regardless.
const MIN_RADIUS = 7

// Half-size of the fallback (no-platforms) AABB. Matches a single virtual
// 1x1 raft at the grid origin so corner-based spawn logic has a sane shape
// to work against on the very first frame.
const FALLBACK_HALF = RAFT_SIZE / 2

export type PlatformExtent = {
  // Centroid of all Platform entities on the XZ plane.
  cx: number
  cz: number
  // Axis-aligned bounding box of the platform group on the XZ plane,
  // including each platform's RAFT_SIZE footprint. Use these corners — not
  // the radius — for spawn/despawn placement so the logic adapts to any
  // shape the player builds (1x1, 4x2, L-shape, …).
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  // Distance from the centroid to the farthest platform centre, clamped to
  // MIN_RADIUS. Kept for the shark director / orbit code, which thinks in
  // patrol-ring radii rather than corners.
  radius: number
}

// AABB half-extent along a unit direction (dirX, dirZ). Standard projection
// formula: |dirX|·halfX + |dirZ|·halfZ. Used to find the platform's
// footprint depth along an arbitrary axis (e.g. the sea-flow direction).
export function aabbHalfExtentAlong(
  extent: PlatformExtent,
  dirX: number,
  dirZ: number
): number {
  const halfX = (extent.maxX - extent.minX) / 2
  const halfZ = (extent.maxZ - extent.minZ) / 2
  return Math.abs(dirX) * halfX + Math.abs(dirZ) * halfZ
}

// Single source of truth for "where are the rafts and what AABB do they
// fit inside?". The shark director computes its own radius variant inline
// (with a tunable margin); we keep a margin-free version here so callers
// can add their own clearance.
//
// Falls back to a 1x1 AABB centred on GRID_ORIGIN with MIN_RADIUS when no
// platforms are present yet — important on the very first frame, before
// the main raft has been added.
export function getPlatformExtent(): PlatformExtent {
  let count = 0
  let sumX = 0
  let sumZ = 0
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  const half = RAFT_SIZE / 2
  for (const [entity] of engine.getEntitiesWith(Platform, Transform)) {
    const p = Transform.get(entity).position
    sumX += p.x
    sumZ += p.z
    count++
    if (p.x - half < minX) minX = p.x - half
    if (p.x + half > maxX) maxX = p.x + half
    if (p.z - half < minZ) minZ = p.z - half
    if (p.z + half > maxZ) maxZ = p.z + half
  }
  if (count === 0) {
    return {
      cx: GRID_ORIGIN.x,
      cz: GRID_ORIGIN.z,
      minX: GRID_ORIGIN.x - FALLBACK_HALF,
      maxX: GRID_ORIGIN.x + FALLBACK_HALF,
      minZ: GRID_ORIGIN.z - FALLBACK_HALF,
      maxZ: GRID_ORIGIN.z + FALLBACK_HALF,
      radius: MIN_RADIUS
    }
  }
  const cx = sumX / count
  const cz = sumZ / count
  let maxDist = 0
  for (const [entity] of engine.getEntitiesWith(Platform, Transform)) {
    const p = Transform.get(entity).position
    const dx = p.x - cx
    const dz = p.z - cz
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d > maxDist) maxDist = d
  }
  return {
    cx,
    cz,
    minX,
    maxX,
    minZ,
    maxZ,
    radius: Math.max(MIN_RADIUS, maxDist)
  }
}
