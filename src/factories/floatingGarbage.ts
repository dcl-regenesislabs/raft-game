import {
  ColliderLayer,
  Entity,
  GltfContainer,
  InputAction,
  MeshCollider,
  PointerEventType,
  PointerEvents,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { FloatingGarbage } from '../components'

// Pickup reach for floating debris. Used by both the PointerEvents
// hover prompt and the look-at classification — keep them in lockstep
// so the on-screen prompt and the action button visibility resolve
// together.
export const GRAB_MAX_DISTANCE = 5

// Debris kinds the player can collect. Add a kind here AND drop the
// matching GLB into `assets/scene/items/<kind>.glb` to extend the pool —
// or set `glbName` in KIND_CONFIG to reuse an existing GLB.
//
// Raw fish are no longer surface debris — the fishing rod is the only
// source so the rod craft is a real progression milestone. See
// `systems/fishingRod.ts` for the catch pool.
export const GARBAGE_KINDS = ['wood', 'barrel', 'plants', 'plastic', 'metal'] as const
export type GarbageKind = (typeof GARBAGE_KINDS)[number]

// Sampling weights for `pickWeightedKind`. Wood/plants/plastic dominate
// (most-used materials); metal is the rarer mid-tier; barrel is the
// jackpot — already capped at one per spawn group in the spawner so a
// low weight keeps it occasional even within a single wave.
const KIND_WEIGHTS: Record<GarbageKind, number> = {
  wood: 30,
  plants: 22,
  plastic: 20,
  metal: 10,
  barrel: 9
}

// Weighted random pick over a subset of kinds. The spawner passes a
// filtered pool (e.g. without `barrel` once the per-group cap is spent)
// so weights renormalise against whatever remains.
export function pickWeightedKind(pool: readonly GarbageKind[]): GarbageKind {
  let total = 0
  for (const k of pool) total += KIND_WEIGHTS[k]
  if (total <= 0) return pool[0]
  let r = Math.random() * total
  for (const k of pool) {
    r -= KIND_WEIGHTS[k]
    if (r <= 0) return k
  }
  return pool[pool.length - 1]
}

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
  // Local euler rotation (degrees) applied to the visual child. Compensates
  // for GLBs authored with a different up-axis convention than DCL's Y-up.
  visualRotationDeg?: { x?: number; y?: number; z?: number }
}

// Optional per-kind collider footprint override (world metres on each
// axis). When unset the collider matches the visual size (config.scale
// cubed). Barrel uses a raft-sized X/Z so the player can click/hover it
// from anywhere within a full deck-cell, which is also forgiving for
// the look-grab raycast classification.
const COLLIDER_OVERRIDE_BY_KIND: Partial<Record<GarbageKind, { x: number; y: number; z: number }>> = {
  barrel: { x: 3, y: 1.5, z: 3 }
}

const KIND_CONFIG: Record<GarbageKind, KindConfig> = {
  // Big floating logs.
  wood: { scale: 1.5, bobAmplitude: 0.10, rollAmplitude: 4, yOffset: -0.05, spinSpeedRange: 0.3 },
  // Buoyant — sits higher, rocks on waves, spins faster.
  barrel: { scale: 1.0, bobAmplitude: 0.15, rollAmplitude: 12, yOffset: 0.10, spinSpeedRange: 0.6 },
  // Flat seaweed mat — barely moves. GLB authored with Z-up; pitch -90°
  // on the visual lays it flat on the water surface.
  plants: { scale: 1.0, bobAmplitude: 0.06, rollAmplitude: 2, yOffset: -0.05, spinSpeedRange: 0.2, visualRotationDeg: { x: -90 } },
  // Tiny plastic bottle.
  plastic: { scale: 0.6, bobAmplitude: 0.10, rollAmplitude: 5, yOffset: -0.05, spinSpeedRange: 0.5 },
  // Heavy scrap metal — settled, mid-sized.
  metal: { scale: 1.0, bobAmplitude: 0.08, rollAmplitude: 3, yOffset: -0.05, spinSpeedRange: 0.3 }
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
  const collider = COLLIDER_OVERRIDE_BY_KIND[kind] ?? {
    x: config.scale,
    y: config.scale,
    z: config.scale
  }

  const entity = engine.addEntity()
  const baseYawDeg = Math.random() * 360
  const spinSpeed = (Math.random() * 2 - 1) * config.spinSpeedRange

  // Parent entity owns the collider + pointer events + drift logic.
  // Transform.scale here sizes the MeshCollider box because
  // MeshCollider.setBox uses a unit cube scaled by the entity's
  // Transform. For barrels this is raft-sized (3 × 1.5 × 3); for all
  // other kinds it matches the visual footprint, so behaviour matches
  // the pre-split single-entity layout.
  Transform.create(entity, {
    position: Vector3.create(position.x, position.y + config.yOffset, position.z),
    rotation: Quaternion.fromEulerDegrees(0, baseYawDeg, 0),
    scale: Vector3.create(collider.x, collider.y, collider.z)
  })

  // CL_POINTER-only box collider so the camera raycast (cookFill /
  // lookAtTarget) and SDK pointer-input layer can target the entity,
  // while player physics (CL_PHYSICS) still passes through — the
  // floating item isn't supposed to block the avatar from walking
  // across the deck.
  MeshCollider.setBox(entity, ColliderLayer.CL_POINTER)

  // SDK-native hover prompt + entity-targeted IA_PRIMARY (E) trigger.
  // The hover prompt shows "E GRAB" on desktop within maxDistance —
  // mobile shows just the text. `systems/garbageGrab.ts` reads the
  // entity-targeted trigger to bank the item.
  PointerEvents.create(entity, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_PRIMARY,
          hoverText: 'GRAB',
          maxDistance: GRAB_MAX_DISTANCE,
          showFeedback: true
        }
      }
    ]
  })

  // Visual child renders the GLB at the original per-kind size.
  // Local scale cancels the parent's collider scale and re-applies
  // config.scale — net world scale = parent × child = config.scale on
  // every axis. Rotation inherits from the parent so the visual still
  // yaws/wobbles in sync with the drift system's per-frame quaternion.
  const visual = engine.addEntity()
  Transform.create(visual, {
    parent: entity,
    rotation: Quaternion.fromEulerDegrees(
      config.visualRotationDeg?.x ?? 0,
      config.visualRotationDeg?.y ?? 0,
      config.visualRotationDeg?.z ?? 0
    ),
    scale: Vector3.create(
      config.scale / collider.x,
      config.scale / collider.y,
      config.scale / collider.z
    )
  })
  GltfContainer.create(visual, {
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
    maxLifetime,
    visual
  })

  return entity
}

// Removes the floating garbage parent AND its visual child. SDK7 does
// NOT cascade child removal when a parent entity is removed, so calling
// `engine.removeEntity(parent)` alone leaves the GLB child orphaned.
// Every despawn / pickup / hook-collect path that destroys a floating
// garbage entity MUST route through this helper.
export function destroyFloatingGarbage(entity: Entity): void {
  const data = FloatingGarbage.getOrNull(entity)
  if (data !== null && data.visual !== engine.RootEntity) {
    engine.removeEntity(data.visual)
  }
  engine.removeEntity(entity)
}
