import { Entity, GltfContainer, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { FloatingGarbage } from '../components'

// Debris kinds the player can collect. Add a kind here AND drop the
// matching GLB into `assets/scene/items/<kind>.glb` to extend the pool —
// or set `glbName` in KIND_CONFIG to reuse an existing GLB.
//
// `fish` is the fishing-rod food source: when banked, it rolls one of
// {sardines, squid, crab} (see hookThrower.bankGrabbedItem). It currently
// reuses the plants GLB until a dedicated fish model lands.
export const GARBAGE_KINDS = ['wood', 'barrel', 'plants', 'plastic', 'metal', 'fish'] as const
export type GarbageKind = (typeof GARBAGE_KINDS)[number]

type KindConfig = {
  // Uniform scale on the GLB. Per-kind because the source assets come from
  // very different baseline sizes (Meshy generations + manual exports).
  scale: number
  // Vertical bob amplitude in metres (peak). Bigger = more visible bobbing.
  bobAmplitude: number
  // Pitch/roll wobble amplitude in degrees. Sells the "rocking on waves"
  // feel — barrels rock noticeably, flat plants barely move.
  rollAmplitude: number
  // Y offset relative to the spawn baseY (water surface). Positive sits the
  // item higher out of the water — useful for buoyant kinds like barrels.
  yOffset: number
  // Half-range of yaw drift in rad/s; per-kind random ∈ [-r, r].
  spinSpeedRange: number
  // Override GLB filename. Defaults to `<kind>.glb` when omitted. Used by
  // the `fish` kind to reuse plants.glb until a fish model exists.
  glbName?: string
}

const KIND_CONFIG: Record<GarbageKind, KindConfig> = {
  // Big floating logs.
  wood: { scale: 1.5, bobAmplitude: 0.10, rollAmplitude: 4, yOffset: -0.05, spinSpeedRange: 0.3 },
  // Buoyant — sits higher, rocks on waves, spins faster.
  barrel: { scale: 1.0, bobAmplitude: 0.15, rollAmplitude: 12, yOffset: 0.10, spinSpeedRange: 0.6 },
  // Flat seaweed mat — barely moves.
  plants: { scale: 1.0, bobAmplitude: 0.06, rollAmplitude: 2, yOffset: -0.05, spinSpeedRange: 0.2 },
  // Tiny plastic bottle.
  plastic: { scale: 0.6, bobAmplitude: 0.10, rollAmplitude: 5, yOffset: -0.05, spinSpeedRange: 0.5 },
  // Heavy scrap metal — large but settled.
  metal: { scale: 1.5, bobAmplitude: 0.08, rollAmplitude: 3, yOffset: -0.05, spinSpeedRange: 0.3 },
  // Lively surface critter — temporarily reuses the plants GLB.
  fish: { scale: 0.7, bobAmplitude: 0.12, rollAmplitude: 6, yOffset: -0.02, spinSpeedRange: 0.7, glbName: 'plants' }
}

export interface FloatingGarbageParams {
  kind: GarbageKind
  // Spawn position. The factory applies the per-kind yOffset on top of this
  // Y so callers can pass WATER_LEVEL directly without per-kind awareness.
  position: Vector3
  // World-space drift velocity (m/s). Y component is ignored — bobbing is
  // handled by the system.
  velocity: Vector3
  // Seconds before the entity self-removes. The drift system also removes
  // it earlier if it leaves the scene parcels.
  maxLifetime: number
}

export function createFloatingGarbage(params: FloatingGarbageParams): Entity {
  const { kind, position, velocity, maxLifetime } = params
  const config = KIND_CONFIG[kind]

  const entity = engine.addEntity()
  const baseYawDeg = Math.random() * 360
  const spinSpeed = (Math.random() * 2 - 1) * config.spinSpeedRange

  Transform.create(entity, {
    position: Vector3.create(position.x, position.y + config.yOffset, position.z),
    rotation: Quaternion.fromEulerDegrees(0, baseYawDeg, 0),
    scale: Vector3.create(config.scale, config.scale, config.scale)
  })

  // No collider: items pass freely past the raft. Pickup will be a future
  // pointer-event hookup (out of scope for this system).
  GltfContainer.create(entity, {
    src: `assets/scene/items/${config.glbName ?? kind}.glb`
  })

  FloatingGarbage.create(entity, {
    kind,
    velocityX: velocity.x,
    velocityZ: velocity.z,
    baseY: position.y + config.yOffset,
    bobPhase: Math.random() * Math.PI * 2,
    bobAmplitude: config.bobAmplitude,
    baseYawDeg,
    spinSpeed,
    rollAmplitude: config.rollAmplitude,
    lifetime: 0,
    maxLifetime
  })

  return entity
}
