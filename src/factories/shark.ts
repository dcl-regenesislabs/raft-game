import {
  Animator,
  ColliderLayer,
  Entity,
  GltfContainer,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { SharkHittable, SharkOrbit } from '../components'
import { SEABED_Y } from './sceneLevels'

const SHARK_MODEL = 'assets/scene/sharks/shark.glb'

// Defaults shared by the initial spawn in index.ts and the director's
// population manager. Centralising them here keeps the two callsites in
// lockstep — adding a knob (e.g. a different speed) only needs to be done
// once.
export const SHARK_Y = SEABED_Y + 1.5
// Linear swim speed in metres/second. The orbit system divides by the
// current ring radius to get the angular velocity each frame, so the
// shark's apparent speed stays constant as the raft (and ring) grows.
export const SHARK_DEFAULT_SPEED = 4.2
export const SHARK_DEFAULT_SCALE = 0.8
export const SHARK_DEFAULT_HEADING_OFFSET_DEG = 0

// Hover text variants. The actual hit registration happens in the spear
// animation system — these strings exist purely to telegraph what the
// player needs to do.
export const SHARK_HOVER_HIT = 'HIT SHARK'
export const SHARK_HOVER_NEEDS_SPEAR = 'EQUIP SPEAR'
// Max camera→shark distance for the hover prompt. The pointer-events
// system also gates by an in-range check at this same radius before
// attaching the component, so this is just a safety net for the SDK's
// own hover-feedback culling.
export const SHARK_HOVER_MAX_DISTANCE = 4

export interface SharkParams {
  center: Vector3
  // Horizontal radius of the orbit.
  radius: number
  // Starting angle in radians. Stagger this across sharks to spread them out.
  phase: number
  // World Y of the orbit (constant).
  y: number
  // Angular velocity in radians/second (sign = direction).
  speed: number
  // Uniform scale applied to the GLB.
  scale?: number
  // Yaw offset (degrees) if the model's default forward axis isn't +Z.
  headingOffsetDeg?: number
}

export function createShark(params: SharkParams): Entity {
  const {
    center,
    radius,
    phase,
    y,
    speed,
    scale = 1,
    headingOffsetDeg = 0
  } = params

  const entity = engine.addEntity()

  Transform.create(entity, {
    position: Vector3.create(
      center.x + radius * Math.cos(phase),
      y,
      center.z + radius * Math.sin(phase)
    ),
    scale: Vector3.create(scale, scale, scale)
  })

  // visibleMeshesCollisionMask makes the GLB's own visible geometry act as
  // a CL_POINTER collider, so the player can click the shark directly —
  // no overlay collision box needed.
  GltfContainer.create(entity, {
    src: SHARK_MODEL,
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER
  })

  // The model ships with two clips: `swim` (body+tail loop) and `bite` (jaw
  // snap). They animate different bones so they blend without fighting.
  // Both are configured at full weight; `bite` is toggled via its `playing`
  // flag by the shark director when an attack reaches the bite phase.
  Animator.create(entity, {
    states: [
      { clip: 'swim', playing: true, loop: true, weight: 1, speed: 1 },
      { clip: 'bite', playing: false, loop: true, weight: 1, speed: 1 }
    ]
  })

  SharkOrbit.create(entity, {
    centerX: center.x,
    centerZ: center.z,
    y,
    radius,
    speed,
    phase,
    headingOffsetDeg
  })

  // PointerEvents are attached/removed dynamically by sharkPointerEvents
  // system based on bite phase + player proximity, so resting orbiters
  // don't show a hover prompt and unreachable biters don't either.
  SharkHittable.create(entity, {
    hits: 0,
    cooldown: 0,
    flashTimer: 0
  })

  return entity
}

// Convenience wrapper used wherever a shark needs to be spawned onto the
// patrol ring with the scene-wide defaults (Y, speed, scale, heading).
// Both the initial population in `main()` and the director's resize loop
// go through this so they stay in lockstep.
export function spawnRingShark(params: {
  centerX: number
  centerZ: number
  radius: number
  phase: number
}): Entity {
  return createShark({
    center: Vector3.create(params.centerX, SHARK_Y, params.centerZ),
    radius: params.radius,
    phase: params.phase,
    y: SHARK_Y,
    speed: SHARK_DEFAULT_SPEED,
    scale: SHARK_DEFAULT_SCALE,
    headingOffsetDeg: SHARK_DEFAULT_HEADING_OFFSET_DEG
  })
}
