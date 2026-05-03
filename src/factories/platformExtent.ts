import { Transform, engine } from '@dcl/sdk/ecs'

import { Platform } from '../components'
import { GRID_ORIGIN } from './platform'

// Floor for the spawn ring — keeps floating debris at a comfortable
// throwing distance even when only the base raft exists. Sharks compute
// their own larger patrol radius in `systems/sharkDirector.ts` and don't
// go through this helper.
const MIN_RADIUS = 7

export type PlatformExtent = {
  // Centroid of all Platform entities on the XZ plane.
  cx: number
  cz: number
  // Distance from the centroid to the farthest platform, clamped to MIN_RADIUS.
  // This is the "platform footprint radius" — anything strictly outside is
  // off the raft.
  radius: number
}

// Single source of truth for "where are the rafts and how big a circle do
// they fit inside?". The shark director computes its own variant inline
// (with a tunable margin); we keep a margin-free version here so callers
// can add their own clearance.
//
// Falls back to GRID_ORIGIN with MIN_RADIUS when no platforms are present
// yet — important on the very first frame, before the main raft has been
// added.
export function getPlatformExtent(): PlatformExtent {
  let count = 0
  let sumX = 0
  let sumZ = 0
  for (const [entity] of engine.getEntitiesWith(Platform, Transform)) {
    const p = Transform.get(entity).position
    sumX += p.x
    sumZ += p.z
    count++
  }
  if (count === 0) {
    return { cx: GRID_ORIGIN.x, cz: GRID_ORIGIN.z, radius: MIN_RADIUS }
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
  return { cx, cz, radius: Math.max(MIN_RADIUS, maxDist) }
}
