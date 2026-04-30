import {
  Entity,
  GltfNodeModifiers,
  MaterialTransparencyMode,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4 } from '@dcl/sdk/math'

import { SharkAttack, SharkHittable } from '../components'
import { repelAttacker } from './sharkDirector'

// Lets the player damage a shark while it is biting a raft. Two timed hits
// drive it off and save the platform — see `repelAttacker` in sharkDirector.
//
// Visual feedback uses GltfNodeModifiers to override the shark GLB's own
// PBR material with a saturated red tint for the duration of the flash.
// Because `path: ''` is a global modifier, it recolours every node in the
// model in one shot. Removing the component restores the baked materials.
//
// Per-frame work: tick the hit cooldown + flash timer; when the flash timer
// expires, strip the modifier so the shark goes back to its normal look.
// The actual hit registration happens in the pointer callback wired up by
// the shark factory, which calls `tryHitShark` below.

const HIT_COOLDOWN_S = 1
// Brief blink. GltfNodeModifiers can't *blend* a tint with the GLB's baked
// textures (it replaces the material outright), so we keep the duration
// short enough that the eye reads it as a flash rather than a flat repaint.
const FLASH_DURATION_S = 0.09
const HITS_TO_REPEL = 2

const PHASE_BITE = 1

export function sharkAttackSystem(dt: number): void {
  for (const [entity] of engine.getEntitiesWith(SharkHittable)) {
    const hit = SharkHittable.getMutable(entity)
    if (hit.cooldown > 0) {
      hit.cooldown = Math.max(0, hit.cooldown - dt)
    }
    if (hit.flashTimer > 0) {
      hit.flashTimer = Math.max(0, hit.flashTimer - dt)
      if (hit.flashTimer === 0) clearHitTint(entity)
    }
  }
}

// Called from the shark's onPointerDown callback. Records a hit only when
// the shark is in the bite phase and the per-shark cooldown has elapsed.
// On the second hit the shark is force-flipped into the return phase via
// `repelAttacker`, which strips PlatformUnderAttack from the target so the
// raft survives.
export function tryHitShark(entity: Entity): void {
  const attack = SharkAttack.getOrNull(entity)
  if (attack === null) return
  if (attack.phase !== PHASE_BITE) return

  const hit = SharkHittable.getMutableOrNull(entity)
  if (hit === null) return
  if (hit.cooldown > 0) return

  hit.hits += 1
  hit.cooldown = HIT_COOLDOWN_S
  hit.flashTimer = FLASH_DURATION_S
  applyHitTint(entity)

  if (hit.hits >= HITS_TO_REPEL) {
    repelAttacker(entity)
  }
}

// Called by the shark director when a new attack begins so each bite
// requires a fresh pair of hits to repel.
export function resetSharkHits(entity: Entity): void {
  const hit = SharkHittable.getMutableOrNull(entity)
  if (hit === null) return
  hit.hits = 0
  hit.cooldown = 0
  hit.flashTimer = 0
  clearHitTint(entity)
}

// Override every node of the GLB with a red PBR material. `path: ''` makes
// this a global modifier — no need to enumerate the shark's mesh nodes.
function applyHitTint(entity: Entity): void {
  if (GltfNodeModifiers.getOrNull(entity) !== null) {
    GltfNodeModifiers.deleteFrom(entity)
  }
  // Soft pink albedo (instead of saturated red) keeps the override from
  // looking like a flat colour wipe; a strong red emissive layered on top
  // adds the "ouch" punch. Combined with the short flash duration, the
  // overall read is a quick reddish blink rather than a recolour.
  GltfNodeModifiers.create(entity, {
    modifiers: [
      {
        path: '',
        material: {
          material: {
            $case: 'pbr',
            pbr: {
              albedoColor: Color4.create(1, 0.65, 0.65, 1),
              emissiveColor: Color3.create(1, 0.15, 0.15),
              emissiveIntensity: 2.5,
              transparencyMode: MaterialTransparencyMode.MTM_OPAQUE,
              metallic: 0,
              roughness: 1
            }
          }
        }
      }
    ]
  })
}

function clearHitTint(entity: Entity): void {
  if (GltfNodeModifiers.getOrNull(entity) === null) return
  GltfNodeModifiers.deleteFrom(entity)
}
