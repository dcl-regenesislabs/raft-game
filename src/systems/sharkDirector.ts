import { Animator, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  MainPlatform,
  Platform,
  PlatformUnderAttack,
  SharkAttack,
  SharkAttackPhase,
  SharkOrbit
} from '../components'
import {
  SHARK_APPROACH_DURATION_S,
  SHARK_ATTACK_INTERVAL_S,
  SHARK_BITE_DURATION_S,
  SHARK_BITE_PITCH_DEG,
  SHARK_BITE_SHAKE_AMP_DEG,
  SHARK_BITE_SHAKE_HZ,
  SHARK_BITE_Y_OFFSET,
  SHARK_CENTER_LERP_K,
  SHARK_MAX_COUNT,
  SHARK_MIN_COUNT,
  SHARK_PULSE_HZ,
  SHARK_RADIUS_MARGIN,
  SHARK_RADIUS_MIN,
  SHARK_RESIZE_HYSTERESIS,
  SHARK_RETURN_DURATION_S,
  SHARK_TARGET_ARC_PER_SHARK
} from '../config/gameConfig'
import {
  PLATFORM_SIZE_X,
  PLATFORM_SIZE_Z,
  destroyPlatformEntity,
  tintPlatform
} from '../factories/platform'
import { WATER_LEVEL } from '../factories/sceneLevels'
import { spawnRingShark } from '../factories/shark'
import { addCollected } from '../ui/inventoryState'
import { notifyItemReceived } from '../ui/itemReceivedNotification'
import {
  RAD_TO_DEG,
  TAU,
  clamp01,
  easeOutCubic,
  smoothingAlpha,
  wrapAngle
} from '../utils/math'
import { isStartupGateActive } from '../ui/startupGate'
import { resetSharkHits } from './sharkAttack'

// Director responsibilities (per frame):
//   1. Recompute the centroid + extent of the platform set, smooth every
//      shark's orbit center/radius toward it. The orbit system reads those
//      fields each frame, so the patrol re-centers automatically.
//   2. Cancel any in-flight attack whose target was destroyed externally
//      (e.g. player used the destroy tool mid-bite).
//   3. Schedule a new attack at most every SHARK_ATTACK_INTERVAL_S, only when no
//      shark is currently attacking and at least one destructible platform
//      is still standing.
//   4. Drive the attacker's transform through the approach → bite → return
//      cycle. The orbit system early-returns on attackers so we have full
//      control of their position and yaw during the cycle.

// 4-connected grid neighbours, used to score how "exposed" a destructible
// platform is. Tips of the raft (1 neighbour) get attacked first.
const NEIGHBOUR_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
]

// Per-attacker cache for the start-of-phase position. Keeping it module-local
// keeps the SharkAttack schema minimal (just phase + elapsed + target ref).
type AttackCache = {
  startPos: Vector3
  approachTarget?: Vector3
  // Platform centre (XZ) at water level — used to face the shark inward
  // during the bite so the model bites onto the deck.
  platformCenter?: Vector3
  // Quaternions captured at phase transitions so we can slerp instead of
  // snapping orientation: approach blends start→bite, return blends
  // bite→swim-along-motion.
  approachStartRot?: Quaternion
  biteRot?: Quaternion
  returnStartRot?: Quaternion
}
const attackCache = new Map<Entity, AttackCache>()

// Time since the last attack started (or since system load).
let timeSinceLastAttack = 0

// External freeze on starting NEW attacks. Set by the boat-chef director
// while the visitor event is in progress so the cinematic moment isn't
// undercut by a bite. We deliberately do NOT zero `timeSinceLastAttack`
// while suppressed — the schedule clock keeps accumulating so an attack
// can fire as soon as suppression lifts (mirrors the user-facing intent
// "don't reset the timer, just ignore"). Mid-attack sharks are not
// interrupted; only the trigger that begins new bites checks this flag.
let attacksSuppressed = false

export function setSharkAttacksSuppressed(value: boolean): void {
  attacksSuppressed = value
}

export function sharkDirectorSystem(dt: number): void {
  // Lobby is up — there's no game world for the director to grow a
  // shark population around. Without this gate the director sees the
  // 6×6 lobby raft island, treats it as the player's run-state raft,
  // and spawns sharks orbiting it (visible flying past the island
  // because the lobby sits 4m below the game's WATER_LEVEL).
  if (isStartupGateActive()) return

  const target = computePlatformTarget()

  if (target !== null) {
    // Resize the patrol population *before* smoothing so a freshly-spawned
    // shark gets its centre/radius nudged toward the target on the same
    // frame and never starts off mid-air at the world origin.
    resizeSharkPopulation(target)

    const alpha = smoothingAlpha(SHARK_CENTER_LERP_K, dt)
    for (const [entity] of engine.getEntitiesWith(SharkOrbit)) {
      const orbit = SharkOrbit.getMutable(entity)
      orbit.centerX += (target.cx - orbit.centerX) * alpha
      orbit.centerZ += (target.cz - orbit.centerZ) * alpha
      orbit.radius += (target.radius - orbit.radius) * alpha
    }
  }

  cancelStaleAttacks()

  // Freeze the schedule clock while the player has only the starter raft —
  // there's nothing attackable, so the 5-minute countdown shouldn't tick.
  if (hasAttackablePlatform()) {
    timeSinceLastAttack += dt
  } else {
    timeSinceLastAttack = 0
  }
  if (
    timeSinceLastAttack >= SHARK_ATTACK_INTERVAL_S &&
    !anySharkAttacking() &&
    !attacksSuppressed
  ) {
    const choice = selectAttack()
    if (choice !== null) {
      beginAttack(choice.attacker, choice.target)
      timeSinceLastAttack = 0
    }
  }

  for (const [entity] of engine.getEntitiesWith(SharkAttack)) {
    advanceAttack(entity, dt)
  }
}

// --- centroid + radius ---

type PlatformTarget = { cx: number; cz: number; radius: number }

function computePlatformTarget(): PlatformTarget | null {
  // Single pass: snapshot positions while accumulating the centroid sums,
  // then compute max-distance against the cached snapshot. Avoids walking
  // the platform set twice and avoids re-paying the ECS query cost.
  const positions: { x: number; z: number }[] = []
  let sumX = 0
  let sumZ = 0
  for (const [entity] of engine.getEntitiesWith(Platform, Transform)) {
    const p = Transform.get(entity).position
    positions.push({ x: p.x, z: p.z })
    sumX += p.x
    sumZ += p.z
  }
  if (positions.length === 0) return null
  const cx = sumX / positions.length
  const cz = sumZ / positions.length

  let maxDistSq = 0
  for (const p of positions) {
    const dx = p.x - cx
    const dz = p.z - cz
    const d2 = dx * dx + dz * dz
    if (d2 > maxDistSq) maxDistSq = d2
  }
  const maxDist = Math.sqrt(maxDistSq)
  return {
    cx,
    cz,
    radius: Math.max(SHARK_RADIUS_MIN, maxDist + SHARK_RADIUS_MARGIN)
  }
}

// --- population manager ---
//
// Each frame we compare the current shark count to an "ideal" count derived
// from the current patrol-ring circumference, and add or remove at most one
// shark per frame. Newcomers are placed at the largest current angular gap;
// removals pull from the orbiter with the smallest forward gap so the
// formation barely notices. Sharks mid-attack are never removed (and don't
// count toward the angular-gap math, just like in the orbit spacing rule),
// so the patrol population can grow even while a bite is in progress.
//
// The orbit system's adaptive spacing then re-distributes phases smoothly
// over the next few frames — we don't need to renumber anyone here.
function resizeSharkPopulation(target: PlatformTarget): void {
  type Snap = { entity: Entity; phase: number; attacking: boolean }
  const all: Snap[] = []
  for (const [entity] of engine.getEntitiesWith(SharkOrbit)) {
    all.push({
      entity,
      phase: wrapAngle(SharkOrbit.get(entity).phase),
      attacking: SharkAttack.getOrNull(entity) !== null
    })
  }
  const currentCount = all.length
  const ideal = (TAU * target.radius) / SHARK_TARGET_ARC_PER_SHARK

  if (
    ideal > currentCount + SHARK_RESIZE_HYSTERESIS &&
    currentCount < SHARK_MAX_COUNT
  ) {
    addSharkAtLargestGap(all, target)
    return
  }

  if (
    ideal < currentCount - SHARK_RESIZE_HYSTERESIS &&
    currentCount > SHARK_MIN_COUNT
  ) {
    removeSharkAtSmallestGap(all)
  }
}

function addSharkAtLargestGap(
  all: { entity: Entity; phase: number; attacking: boolean }[],
  target: PlatformTarget
): void {
  // Only orbiting sharks contribute to angular gaps — a mid-attack shark is
  // off the ring at the moment, so spawning at its phase would actually
  // help fill the void it left.
  const phases = all
    .filter(s => !s.attacking)
    .map(s => s.phase)
    .sort((a, b) => a - b)

  let spawnPhase = 0
  if (phases.length === 1) {
    spawnPhase = wrapAngle(phases[0] + Math.PI)
  } else if (phases.length >= 2) {
    let bestGap = -1
    for (let i = 0; i < phases.length; i++) {
      const next = phases[(i + 1) % phases.length]
      let gap = next - phases[i]
      if (gap <= 0) gap += TAU
      if (gap > bestGap) {
        bestGap = gap
        spawnPhase = wrapAngle(phases[i] + gap / 2)
      }
    }
  }

  spawnRingShark({
    centerX: target.cx,
    centerZ: target.cz,
    radius: target.radius,
    phase: spawnPhase
  })
}

function removeSharkAtSmallestGap(
  all: { entity: Entity; phase: number; attacking: boolean }[]
): void {
  // Only consider non-attacking sharks. Pulling an attacker off-ring would
  // strand its in-flight transform, leak its SharkAttack cache, and skip
  // the PlatformUnderAttack cleanup. Wait until it returns to the ring.
  const orbiting = all
    .filter(s => !s.attacking)
    .sort((a, b) => a.phase - b.phase)
  if (orbiting.length === 0) return
  if (orbiting.length === 1) {
    engine.removeEntity(orbiting[0].entity)
    return
  }

  let victimIdx = 0
  let smallestGap = Infinity
  for (let i = 0; i < orbiting.length; i++) {
    const next = orbiting[(i + 1) % orbiting.length]
    let gap = next.phase - orbiting[i].phase
    if (gap <= 0) gap += TAU
    if (gap < smallestGap) {
      smallestGap = gap
      victimIdx = i
    }
  }
  engine.removeEntity(orbiting[victimIdx].entity)
}

// --- selection ---

// True when at least one destructible platform (built by the player) exists.
// The starter raft carries the MainPlatform tag and is excluded.
function hasAttackablePlatform(): boolean {
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    if (MainPlatform.getOrNull(entity) === null) return true
  }
  return false
}

// Only approach + bite count as "actively attacking" for scheduling. Sharks
// in return/resync have already done their damage and shouldn't block the
// next bite from being queued.
function anySharkAttacking(): boolean {
  for (const [entity] of engine.getEntitiesWith(SharkAttack)) {
    const a = SharkAttack.get(entity)
    if (a.phase === SharkAttackPhase.Approach || a.phase === SharkAttackPhase.Bite) return true
  }
  return false
}

type Candidate = {
  entity: Entity
  pos: Vector3
  neighbours: number
}

function selectAttack(): { target: Entity; attacker: Entity } | null {
  // Build the occupancy set so we can score neighbour counts.
  const occupied = new Set<string>()
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    const p = Platform.get(entity)
    occupied.add(`${p.gridX},${p.gridZ}`)
  }

  // Destructible candidates only; an already-attacked platform is ignored
  // (defensive — we also gate on anySharkAttacking() above).
  const candidates: Candidate[] = []
  for (const [entity] of engine.getEntitiesWith(Platform, Transform)) {
    if (MainPlatform.getOrNull(entity) !== null) continue
    if (PlatformUnderAttack.getOrNull(entity) !== null) continue
    const p = Platform.get(entity)
    let n = 0
    for (const [dx, dz] of NEIGHBOUR_DELTAS) {
      if (occupied.has(`${p.gridX + dx},${p.gridZ + dz}`)) n++
    }
    const pos = Transform.get(entity).position
    candidates.push({
      entity,
      pos: Vector3.create(pos.x, pos.y, pos.z),
      neighbours: n
    })
  }
  if (candidates.length === 0) return null

  // Filter to the most exposed tier (fewest neighbours).
  let minN = Infinity
  for (const c of candidates) if (c.neighbours < minN) minN = c.neighbours
  const exposed = candidates.filter(c => c.neighbours === minN)

  // Snapshot positions of sharks that are eligible to attack (not already
  // mid-cycle in any phase).
  const sharks: { entity: Entity; pos: Vector3 }[] = []
  for (const [entity] of engine.getEntitiesWith(SharkOrbit, Transform)) {
    if (SharkAttack.getOrNull(entity) !== null) continue
    const p = Transform.get(entity).position
    sharks.push({ entity, pos: Vector3.create(p.x, p.y, p.z) })
  }
  if (sharks.length === 0) return null

  // Pick the exposed candidate whose nearest shark is closest. Attacker is
  // that nearest shark. Entity-id tie-break keeps the choice deterministic.
  let bestTarget: Entity | null = null
  let bestAttacker: Entity | null = null
  let bestDist = Infinity
  for (const c of exposed) {
    let nearestShark: Entity | null = null
    let nearestDist = Infinity
    for (const s of sharks) {
      const dx = s.pos.x - c.pos.x
      const dz = s.pos.z - c.pos.z
      const d = Math.sqrt(dx * dx + dz * dz)
      if (
        d < nearestDist ||
        (d === nearestDist &&
          nearestShark !== null &&
          (s.entity as number) < (nearestShark as number))
      ) {
        nearestDist = d
        nearestShark = s.entity
      }
    }
    if (nearestShark === null) continue
    if (
      nearestDist < bestDist ||
      (nearestDist === bestDist &&
        bestTarget !== null &&
        (c.entity as number) < (bestTarget as number))
    ) {
      bestDist = nearestDist
      bestTarget = c.entity
      bestAttacker = nearestShark
    }
  }
  if (bestTarget === null || bestAttacker === null) return null
  return { target: bestTarget, attacker: bestAttacker }
}

// --- attack lifecycle ---

function beginAttack(attacker: Entity, target: Entity): void {
  const tr = Transform.get(attacker)
  const startV = Vector3.create(tr.position.x, tr.position.y, tr.position.z)
  const approachTarget = biteAnchorFor(target, startV)
  const platformCenter = platformCenterPos(target)
  const biteYaw = yawDegFromTo(approachTarget, platformCenter, attacker)
  const biteRot = Quaternion.fromEulerDegrees(SHARK_BITE_PITCH_DEG, biteYaw, 0)
  attackCache.set(attacker, {
    startPos: startV,
    approachTarget,
    platformCenter,
    approachStartRot: copyRotation(tr.rotation),
    biteRot
  })
  SharkAttack.create(attacker, {
    target,
    phase: SharkAttackPhase.Approach,
    elapsed: 0
  })
  PlatformUnderAttack.create(target)
  // Each new attack starts with a fresh hit counter so it always takes the
  // full N taps to repel.
  resetSharkHits(attacker)
}

// Player drove the shark off mid-bite — abandon the bite, free the target
// (so it survives), and short-circuit into the return phase from the
// current pose. Called from `systems/sharkAttack.ts`.
export function repelAttacker(entity: Entity): void {
  const attack = SharkAttack.getMutableOrNull(entity)
  if (attack === null) return
  if (attack.phase !== SharkAttackPhase.Bite) return

  const target = attack.target
  if (PlatformUnderAttack.getOrNull(target) !== null) {
    PlatformUnderAttack.deleteFrom(target)
  }
  // Leave the saved raft in its base wood colour rather than the mid-pulse
  // tint we may have stamped this frame.
  if (Platform.getOrNull(target) !== null) {
    tintPlatform(target, 0)
  }

  stopBite(entity)

  // Successful repel — the player's hit drove the shark off mid-bite, so
  // the player gets shark meat for cooking. One per repel keeps the loot
  // proportional to the effort: each shark requires multiple hits to
  // reach this branch (see resetSharkHits in this file).
  addCollected('shark_meat', 1)
  notifyItemReceived('shark_meat', 1)

  const tr = Transform.get(entity)
  attackCache.set(entity, {
    startPos: Vector3.create(tr.position.x, tr.position.y, tr.position.z),
    returnStartRot: copyRotation(tr.rotation)
  })
  attack.phase = SharkAttackPhase.Return
  attack.elapsed = 0
}

function copyRotation(q: { x: number; y: number; z: number; w: number }): Quaternion {
  return Quaternion.create(q.x, q.y, q.z, q.w)
}

// The shark bites the platform's border on whichever side it approached
// from. Y is pinned to the water surface so the body straddles it — head
// over the deck, tail trailing in the water. The shark's nose then faces
// the platform centre, so the bite reads as "biting onto" the raft.
function biteAnchorFor(target: Entity, attackerStart: Vector3): Vector3 {
  const p = Transform.get(target).position
  const dx = attackerStart.x - p.x
  const dz = attackerStart.z - p.z
  const halfX = PLATFORM_SIZE_X / 2
  const halfZ = PLATFORM_SIZE_Z / 2
  // Pick the dominant approach axis so the shark lands on a face, not a corner.
  let edgeX = p.x
  let edgeZ = p.z
  if (Math.abs(dx) >= Math.abs(dz)) {
    edgeX = p.x + Math.sign(dx || 1) * halfX
  } else {
    edgeZ = p.z + Math.sign(dz || 1) * halfZ
  }
  return Vector3.create(edgeX, WATER_LEVEL + SHARK_BITE_Y_OFFSET, edgeZ)
}

function platformCenterPos(target: Entity): Vector3 {
  const p = Transform.get(target).position
  return Vector3.create(p.x, WATER_LEVEL + SHARK_BITE_Y_OFFSET, p.z)
}

function cancelStaleAttacks(): void {
  for (const [entity] of engine.getEntitiesWith(SharkAttack)) {
    const attack = SharkAttack.getMutable(entity)
    // Only approach + bite expect the target to still exist. Once we hit
    // return/resync the target has either been eaten by us (normal) or
    // already cleaned up; treating that as "stale" would loop the shark
    // back into return forever.
    if (attack.phase !== SharkAttackPhase.Approach && attack.phase !== SharkAttackPhase.Bite) continue
    if (Platform.getOrNull(attack.target) !== null) continue
    // Target was destroyed externally — abort to return phase from current
    // pose, slerping rotation back to a level swim during return.
    const tr = Transform.get(entity)
    attackCache.set(entity, {
      startPos: Vector3.create(tr.position.x, tr.position.y, tr.position.z),
      returnStartRot: copyRotation(tr.rotation)
    })
    attack.phase = SharkAttackPhase.Return
    attack.elapsed = 0
    stopBite(entity)
  }
}

function advanceAttack(entity: Entity, dt: number): void {
  const attack = SharkAttack.getMutable(entity)
  attack.elapsed += dt
  const cache = attackCache.get(entity)
  if (cache === undefined) {
    SharkAttack.deleteFrom(entity)
    return
  }

  if (attack.phase === SharkAttackPhase.Approach) {
    const dest = cache.approachTarget ?? cache.startPos
    const t = clamp01(attack.elapsed / SHARK_APPROACH_DURATION_S)
    const eased = easeOutCubic(t)
    setSharkPos(entity, lerpV3(cache.startPos, dest, eased))
    // Slerp orientation from the orbit pose toward the bite pose so the
    // pitch/yaw eases in continuously across the dive.
    if (cache.approachStartRot !== undefined && cache.biteRot !== undefined) {
      Transform.getMutable(entity).rotation = Quaternion.slerp(
        cache.approachStartRot,
        cache.biteRot,
        eased
      )
    }
    if (attack.elapsed >= SHARK_APPROACH_DURATION_S) {
      setSharkPos(entity, dest)
      if (cache.biteRot !== undefined) {
        Transform.getMutable(entity).rotation = cache.biteRot
      }
      attack.phase = SharkAttackPhase.Bite
      attack.elapsed = 0
      startBite(entity)
    }
    return
  }

  if (attack.phase === SharkAttackPhase.Bite) {
    const target = attack.target
    if (Platform.getOrNull(target) !== null) {
      const pulse = 0.5 + 0.5 * Math.sin(TAU * SHARK_PULSE_HZ * attack.elapsed)
      tintPlatform(target, pulse)
    }
    // Side-to-side yaw shake on top of the bite pose. Recomputing the base
    // yaw each frame is cheap and keeps it stable if the platform shifts.
    if (cache.approachTarget !== undefined && cache.platformCenter !== undefined) {
      const baseYaw = yawDegFromTo(cache.approachTarget, cache.platformCenter, entity)
      const shake = SHARK_BITE_SHAKE_AMP_DEG * Math.sin(TAU * SHARK_BITE_SHAKE_HZ * attack.elapsed)
      Transform.getMutable(entity).rotation = Quaternion.fromEulerDegrees(
        SHARK_BITE_PITCH_DEG,
        baseYaw + shake,
        0
      )
    }
    if (attack.elapsed >= SHARK_BITE_DURATION_S) {
      stopBite(entity)
      if (Platform.getOrNull(target) !== null) {
        destroyPlatformEntity(target)
      }
      const tr = Transform.get(entity)
      attackCache.set(entity, {
        startPos: Vector3.create(tr.position.x, tr.position.y, tr.position.z),
        returnStartRot: copyRotation(tr.rotation)
      })
      attack.phase = SharkAttackPhase.Return
      attack.elapsed = 0
    }
    return
  }

  if (attack.phase === SharkAttackPhase.Return) {
    // Lerp the shark back to its orbit slot, easing rotation to the
    // orbit-tangent pose so handoff to the orbit system is seamless.
    // The orbit system then re-spaces the formation via its forward/
    // backward-gap rule.
    const orbit = SharkOrbit.get(entity)
    const orbitPos = Vector3.create(
      orbit.centerX + orbit.radius * Math.cos(orbit.phase),
      orbit.y,
      orbit.centerZ + orbit.radius * Math.sin(orbit.phase)
    )
    const t = clamp01(attack.elapsed / SHARK_RETURN_DURATION_S)
    const eased = easeOutCubic(t)
    setSharkPos(entity, lerpV3(cache.startPos, orbitPos, eased))
    if (cache.returnStartRot !== undefined) {
      const orbitYawDeg =
        -orbit.phase * RAD_TO_DEG + orbit.headingOffsetDeg
      const targetRot = Quaternion.fromEulerDegrees(0, orbitYawDeg, 0)
      Transform.getMutable(entity).rotation = Quaternion.slerp(
        cache.returnStartRot,
        targetRot,
        eased
      )
    }
    if (attack.elapsed >= SHARK_RETURN_DURATION_S) {
      // Hand off to the orbit system — its spacing rule will smoothly
      // pull this shark back to its evenly-spaced slot at 0.7×/1.3×
      // speed without ever overtaking another shark.
      SharkAttack.deleteFrom(entity)
      attackCache.delete(entity)
    }
  }
}

// --- helpers ---

function setSharkPos(entity: Entity, pos: Vector3): void {
  Transform.getMutable(entity).position = pos
}

// Yaw (degrees) that aligns the shark's +Z forward with the from→to vector,
// accounting for the per-shark heading offset.
function yawDegFromTo(from: Vector3, to: Vector3, entity: Entity): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const orbit = SharkOrbit.get(entity)
  return Math.atan2(dx, dz) * RAD_TO_DEG + orbit.headingOffsetDeg
}

// Pause swim while bite plays. Both clips animate the same skeleton, so
// running them simultaneously at non-trivial weights produces a ghost-blend
// that looks like two sharks. Solo-playing each clip keeps the pose clean.
function startBite(entity: Entity): void {
  const anim = Animator.getMutableOrNull(entity)
  if (anim === null) return
  for (const state of anim.states) {
    if (state.clip === 'swim') state.playing = false
    if (state.clip === 'bite') {
      state.playing = true
      state.shouldReset = true
    }
  }
}

function stopBite(entity: Entity): void {
  const anim = Animator.getMutableOrNull(entity)
  if (anim === null) return
  for (const state of anim.states) {
    if (state.clip === 'bite') state.playing = false
    if (state.clip === 'swim') {
      state.playing = true
      state.shouldReset = true
    }
  }
}

function lerpV3(a: Vector3, b: Vector3, t: number): Vector3 {
  return Vector3.create(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t
  )
}
