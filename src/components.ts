import { Schemas, engine } from '@dcl/sdk/ecs'

// Custom components for the scene live here.

// Drives a slow UV drift on a tiled plane so a still water texture looks like
// flowing water. Attached to the water-floor entity in `factories/water.ts`,
// consumed by `systems/waterScroll.ts`.
export const WaterScroll = engine.defineComponent('water-scroll', {
  // UV units per second on each axis. Different values per axis give the
  // surface a more natural drift.
  speedU: Schemas.Number,
  speedV: Schemas.Number,
  // Accumulated offsets (kept in [0, 1)).
  offsetU: Schemas.Number,
  offsetV: Schemas.Number,
  // Cached so the system can rebuild UVs without external knowledge.
  tileCount: Schemas.Number
})

// Tags every raft entity with its grid coordinates. Cell (0,0) is the main
// platform; neighbours are at ±1 on either axis. Consumed by `systems/raftBuilder.ts`
// to enumerate occupied cells and spawn placement markers around the perimeter.
export const Platform = engine.defineComponent('mystic-pond:platform', {
  gridX: Schemas.Int,
  gridZ: Schemas.Int
})

// Empty marker on the origin raft. Destruction skips entities carrying this tag.
export const MainPlatform = engine.defineComponent('mystic-pond:main-platform', {})

// Tags small green disc click-targets shown around existing rafts in PLACING
// mode. The system removes every entity carrying this tag when leaving the
// mode.
export const PlacementMarker = engine.defineComponent('mystic-pond:placement-marker', {
  gridX: Schemas.Int,
  gridZ: Schemas.Int
})

// Per-shark attack state. Present only while a shark is in the attack cycle
// (approach → bite → return). Drives `systems/sharkDirector.ts`; the orbit
// system early-returns on entities carrying this so the director can move
// them directly.
//
// `phase` encodes the cycle step:
//   0 = approaching the target (lerp orbit pos → platform pos)
//   1 = biting (held above platform, plays bite clip, pulses tint)
//   2 = returning (lerp current pos → freshly-recentered orbit slot)
export const SharkAttack = engine.defineComponent('mystic-pond:shark-attack', {
  target: Schemas.Entity,
  phase: Schemas.Int,
  elapsed: Schemas.Number
})

// Tag on the platform currently being eaten. Lets target selection skip it
// and lets future systems (UI, FX) react to the attacked state.
export const PlatformUnderAttack = engine.defineComponent(
  'mystic-pond:platform-under-attack',
  {}
)

// Per-shark hit-while-biting state. Present on every shark; only meaningful
// during PHASE_BITE. `hits` is reset to 0 at the start of each new attack;
// once it reaches the repel threshold the shark abandons the bite. The
// brief red flash is driven by `systems/sharkAttack.ts` toggling
// `GltfNodeModifiers` on the shark — no overlay mesh.
export const SharkHittable = engine.defineComponent('mystic-pond:shark-hittable', {
  hits: Schemas.Int,
  cooldown: Schemas.Number,
  flashTimer: Schemas.Number
})

// Drives circular motion around a fixed point on the XZ plane. Used by sharks
// patrolling the platform. Consumed by `systems/sharkOrbit.ts`.
export const SharkOrbit = engine.defineComponent('shark-orbit', {
  // Circle center in world coords (Y is held constant by the system).
  centerX: Schemas.Number,
  centerZ: Schemas.Number,
  y: Schemas.Number,
  radius: Schemas.Number,
  // Linear swim speed in metres/second along the ring. The orbit system
  // converts to angular velocity (speed / radius) each frame, so apparent
  // speed stays constant as the radius grows. Sign sets direction.
  speed: Schemas.Number,
  // Current angle (radians); kept wrapped to [0, 2π).
  phase: Schemas.Number,
  // Yaw offset in degrees applied on top of the path tangent. Use to
  // compensate for a model whose default forward axis isn't +Z.
  headingOffsetDeg: Schemas.Number
})
