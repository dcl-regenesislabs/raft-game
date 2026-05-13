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

// Marks a platform that has a placed construction (grill / water purifier)
// sitting on its deck. `kind` identifies the construction type so a
// future placement system can refuse stacking another of the same family
// — and the gameplay code can route behaviour by kind. `child` is the
// GLB visual entity parented to the platform so platform-removal
// callers can clean it up explicitly (SDK7 doesn't auto-remove
// orphaned children when their parent goes away).
export const PlatformConstruction = engine.defineComponent(
  'mystic-pond:platform-construction',
  {
    kind: Schemas.String,
    child: Schemas.Entity,
    // Optional auxiliary entity (e.g. the billboarded flame sprite on
    // grills). Stored so `destroyPlatformEntity` can clean it up — it
    // is NOT a Transform child of `child`, so SDK7 won't cascade.
    // Set to 0 (engine.RootEntity ID) when absent.
    aux: Schemas.Entity,
    // Yaw (degrees, around +Y) the construction was placed at. The
    // visual child's rotation already encodes this, but we keep it on
    // the component too so `cookSession` can spawn flame and food
    // sprites in grill-aligned positions without decomposing the
    // child Transform's quaternion.
    yawDeg: Schemas.Number
  }
)

// Number of slots in a placed storage's grid. Fixed at 25 (5x5) — matches
// the player's panel grid layout so the storage menu renders both surfaces
// at the same dimensions.
export const STORAGE_SLOT_COUNT = 25

// Per-slot stack cap inside a placed storage chest. Higher than the
// player's pocket cap (`PLAYER_STACK_CAP` in `ui/items.ts`) so chests
// remain a strict capacity upgrade — the whole reason to build them.
export const STORAGE_MAX_STACK = 99

// Per-storage contents attached to the platform entity carrying a
// PlatformConstruction with kind === 'storage'. Indexed by slot (0 is
// top-left, row-major). Empty slots use id === '' and count 0; stackable
// occupants store their id + count, non-stackables (knife, cup variants,
// tools) store id + count: 1.
export const StorageContents = engine.defineComponent(
  'mystic-pond:storage-contents',
  {
    slots: Schemas.Array(
      Schemas.Map({
        id: Schemas.String,
        count: Schemas.Int
      })
    )
  }
)

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
// them directly. See `SharkAttackPhase` for the phase encoding.
export const SharkAttack = engine.defineComponent('mystic-pond:shark-attack', {
  target: Schemas.Entity,
  phase: Schemas.Int,
  elapsed: Schemas.Number
})

// Phase encoding for `SharkAttack.phase`. Stored as Int so the schema can
// network-serialise; the enum keeps call sites readable. Re-spacing after
// the attack is handled by the orbit system itself, so there's no
// dedicated resync phase here — at the end of RETURN we simply delete
// SharkAttack and the formation reflows naturally.
export const enum SharkAttackPhase {
  // Approaching the target (lerp orbit pos → platform pos).
  Approach = 0,
  // Biting (held above platform, plays bite clip, pulses tint).
  Bite = 1,
  // Returning (lerp current pos → freshly-recentered orbit slot).
  Return = 2
}

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

// Tags the single thrown-hook entity. See `HookPhase` for the phase
// encoding. `velocity` is metres/second; only meaningful while flying.
export const Hook = engine.defineComponent('mystic-pond:hook', {
  phase: Schemas.Int,
  elapsed: Schemas.Number,
  velocity: Schemas.Vector3
})

// Phase encoding for `Hook.phase`. Stored as Int for serialisation; this
// enum keeps call sites readable.
export const enum HookPhase {
  // Ballistic — velocity integrated with gravity each frame.
  Flying = 0,
  // Touched water — pulled back toward the player along XZ.
  Floating = 1,
  // Hook stuck in a floating island — world is shifting toward the raft.
  Anchored = 2
}

// Tags the single thrown fishing-line entity. Mirrors `Hook` but the
// floating phase is sticky (waits for player input) and adds a Biting
// reaction window before the catch resolves. `nextBiteIn` is the random
// idle duration before the next bite fires; `idleElapsed` accumulates
// while in `Idle`. `reactElapsed` is the seconds-into-the-bite window
// (capped at the configured react duration). `velocity` is m/s,
// only meaningful while flying.
export const FishingLine = engine.defineComponent('mystic-pond:fishing-line', {
  phase: Schemas.Int,
  elapsed: Schemas.Number,
  velocity: Schemas.Vector3,
  idleElapsed: Schemas.Number,
  nextBiteIn: Schemas.Number,
  reactElapsed: Schemas.Number
})

// Phase encoding for `FishingLine.phase`. Stored as Int for
// serialisation; this enum keeps call sites readable.
export const enum FishingPhase {
  // Ballistic — velocity integrated with gravity each frame.
  Flying = 0,
  // Floating on water; waiting for a bite or a retract press.
  Idle = 1,
  // Fish is biting — player has FISH_REACT_WINDOW_S to press to catch.
  Biting = 2,
  // Reeling back home (after retract / catch / forced cancel).
  Reeling = 3
}

// Floating debris (wood / barrel / plants / plastic / metal) drifting past
// the rafts along the sea-flow direction. Spawned in groups by
// `systems/garbageSpawner.ts`, advanced + despawned by `systems/floatingGarbage.ts`.
// Velocity is stored per-entity (not derived) so the spawner can perturb
// individual items in a group without recomputing the global flow vector.
export const FloatingGarbage = engine.defineComponent('mystic-pond:floating-garbage', {
  // Which debris type this is (matches GarbageKind in factories/floatingGarbage).
  // Kept on the component so the hook collector can credit the right slot
  // without parsing the GLB src.
  kind: Schemas.String,
  velocityX: Schemas.Number,
  velocityZ: Schemas.Number,
  // Mean Y the bob oscillates around. Set at spawn to ~water surface.
  baseY: Schemas.Number,
  bobPhase: Schemas.Number,
  bobAmplitude: Schemas.Number,
  // Initial yaw in degrees. The drift system rebuilds rotation from euler
  // every frame (yaw drift + pitch/roll wobble), so we need to remember the
  // starting yaw rather than mutating the quaternion incrementally.
  baseYawDeg: Schemas.Number,
  // Yaw rate in rad/s. Sign sets direction; small values give a gentle tumble.
  spinSpeed: Schemas.Number,
  // Pitch/roll oscillation amplitude in degrees. Drives the "rocking on
  // waves" feel — barrels use a big value, flat debris (plants) almost zero.
  rollAmplitude: Schemas.Number,
  // Seconds since spawn. The drift system removes the entity once this
  // exceeds maxLifetime, OR when it leaves the scene parcels (whichever
  // comes first) — keeps despawn cheap (no centroid recompute per item).
  lifetime: Schemas.Number,
  maxLifetime: Schemas.Number
})

export const FloatingIsland = engine.defineComponent('mystic-pond:floating-island', {
  velocityX: Schemas.Number,
  velocityZ: Schemas.Number,
  // Original velocity stored for restoring after anchor release
  baseVelocityX: Schemas.Number,
  baseVelocityZ: Schemas.Number,
  lifetime: Schemas.Number,
  maxLifetime: Schemas.Number,
  // True while the island is being nudged away from the raft
  deflecting: Schemas.Boolean
})

// Per-grill flame-sprite animation state. Drives `systems/grillFire.ts`
// which advances the UV window on the entity's plane mesh through the
// 11-frame fire spritesheet (3 cols × 4 rows, last cell empty). Each
// grill carries its own `frameTimer` (seconds since last advance) and
// `currentFrame` so neighbouring grills don't tick in lockstep.
export const GrillFire = engine.defineComponent('mystic-pond:grill-fire', {
  frameTimer: Schemas.Number,
  currentFrame: Schemas.Int
})

// Place-and-wait cook session attached to a grill PLATFORM entity. The
// player builds a recipe in the cook menu, presses COOK, and this
// component is created on the targeted grill — the HUD does NOT lock,
// so the player can roam while the food cooks. Status progresses on a
// real-time clock:
//   - Cooking (0–60s): ingredient sprites lie above the flame.
//   - Ready   (60–120s): ingredient sprites are replaced by the
//     cooked-plate sprite. Click the grill to grab.
//   - Burned  (120s+): plate sprite swaps to coal, flame turns off.
//     Click the grill to grab the coal.
//
// `fireSprite` and `foodSprites` are TOP-LEVEL entities (not Transform
// children of the grill GLB) so non-uniform parent scale doesn't break
// their orientation. SDK7 won't cascade-remove them when the platform
// is destroyed, so `destroyPlatformEntity` and `cookGrab` clean them up
// explicitly. `fireSprite` is set to engine.RootEntity (id 0) once the
// flame is despawned at the burn transition.
export const ActiveCook = engine.defineComponent('mystic-pond:active-cook', {
  recipeId: Schemas.String,
  elapsedSec: Schemas.Number,
  status: Schemas.Int,
  fireSprite: Schemas.Entity,
  foodSprites: Schemas.Array(Schemas.Entity),
  bobPhase: Schemas.Number
})

export const enum CookStatus {
  Cooking = 0,
  Ready = 1,
  Burned = 2
}

// Marker tag attached to every entity that belongs to the lobby world
// (rafts, bridges, water, walls, decor, portals). The lobby teardown
// sweeps over all entities carrying this tag and removes them in one
// pass so the game-world build can run on a clean scene.
export const LobbyTag = engine.defineComponent('mystic-pond:lobby-tag', {})

// Identifies a clickable button on the lobby's information panel.
// `kind` selects the deferred action to run after the gate's exit fade
// ('NEW' | 'LOAD' | 'DEBUG'). Stored as a plain string so we don't
// depend on enum schema support; the lobby interact system normalises
// it via a switch.
export const LobbyButton = engine.defineComponent('mystic-pond:lobby-button', {
  kind: Schemas.String
})

// Marker on the single cross-realm portal that sits in the demo lobby
// and offers a jump to the FULL game (raft.dcl.eth). Triggered by
// proximity OR click; the SDK's `changeRealm` call surfaces its own
// confirmation dialog, so this marker just identifies the trigger
// entity — no per-instance fields needed.
export const LobbyTeleport = engine.defineComponent('mystic-pond:lobby-teleport', {})

// Drives a slow sin-based color cycle on the lobby portal's interior
// plane so the gateway reads as living energy rather than a static
// emissive sheet. The system in `systems/portalPulse.ts` reads
// `elapsed` (seconds since spawn), advances it by dt, and writes a
// fresh `emissiveColor` + `emissiveIntensity` onto the entity's PBR
// material every frame. `speed` is radians/second of the cycle;
// `pulseAmp` is the +/- range applied to the base intensity.
export const PortalPulse = engine.defineComponent('mystic-pond:portal-pulse', {
  elapsed: Schemas.Number,
  speed: Schemas.Number,
  baseIntensity: Schemas.Number,
  pulseAmp: Schemas.Number
})

// Combined UV scroll + rotation. Drives the lobby portal interior so
// the texture drifts AND swirls each frame. Kept distinct from
// `WaterScroll` so the water-floor system stays a pure scroll
// without branching for an unused rotation field. `rotation` is the
// accumulated angle in radians; `rotSpeed` is rad/second.
export const PortalUvSwirl = engine.defineComponent('mystic-pond:portal-uv-swirl', {
  speedU: Schemas.Number,
  speedV: Schemas.Number,
  offsetU: Schemas.Number,
  offsetV: Schemas.Number,
  rotSpeed: Schemas.Number,
  rotation: Schemas.Number,
  tileCount: Schemas.Number
})

// Per-button hover state for the lobby panel. Stores the click-target
// plate's base scale (so the system can return to it on hover-leave),
// the linked visual + text entities (both zoom in lockstep with the
// click plate), and the lerp pair `targetMul` (snapped on hover
// events) / `currentMul` (smoothed toward target). The hover system in
// `systems/lobbyButtonHover.ts` owns updates; the factory just seeds
// these to the at-rest values.
//
// The click plate (entity carrying this component) is intentionally
// bigger than the visible plane so steep-angle aim rays still land —
// `visualEntity` is the child showing the texture at the smaller
// "real" button size.
export const LobbyButtonHover = engine.defineComponent('mystic-pond:lobby-button-hover', {
  visualEntity: Schemas.Entity,
  textEntity: Schemas.Entity,
  // At-rest local scale of the visual child relative to its click-plate
  // parent. Multiplied by `currentMul` each frame so the visible plate
  // zooms while the click plate (the parent) stays fixed — this keeps
  // the trigger area independent of the hover animation.
  visualLocalX: Schemas.Number,
  visualLocalY: Schemas.Number,
  targetMul: Schemas.Number,
  currentMul: Schemas.Number
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
