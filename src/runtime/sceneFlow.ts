// Scene flow: portal exit handling + BACK TO LOBBY orchestration. Lifted
// out of `index.ts` so the SystemMenu can call `returnToLobby()` without
// pulling in a circular import on the entry module.
//
// The boot sequence in `index.ts` calls `bootstrapSceneFlow(mode, parcelGrid)`
// once, which:
//   1) caches the resolved deployment so the lobby can be rebuilt later
//   2) arms the lobby portal-trigger handler — picking a portal fades the
//      gate, tears the lobby down, builds the actual game world, and runs
//      the kind-specific bootstrap (load / debug / nothing)
//
// `returnToLobby()` is the inverse: sweep every game-world entity (keeping
// only the camera-attached viewmodel + first-person volume + reserved
// engine entities), drop module-level entity refs cached by tool/builder
// systems, rebuild the lobby, re-arm the portal handler, and re-show the
// startup gate so the HUD hides underneath while the player walks the
// island again.

import { Entity, Transform, engine } from '@dcl/sdk/ecs'
import { movePlayerTo } from '~system/RestrictedActions'

import { requestLoad } from '../client/saveClient'
import { SHARK_INITIAL_COUNT, SHARK_INITIAL_RADIUS } from '../config/gameConfig'
import {
  GRID_ORIGIN,
  createAvatarHideArea,
  createPlatform,
  createSeabed,
  createWaterFloorV2,
  spawnRingShark
} from '../factories'
import { getFirstPersonAreaEntity } from '../factories/firstPersonArea'
import {
  getHeldItemViewmodelEntities,
  setHeldViewmodelHidden
} from '../factories/heldItem'
import {
  LobbyButtonKind,
  createLobby,
  getLobbyArrivalPosition,
  teardownLobby
} from '../factories/lobby'
import { DEMO_PARCEL_GRID } from '../factories/sceneLevels'
import { setLobbyExitHandler } from '../systems/lobbyPortalSystem'
import {
  armBoatChefEvent,
  resetBoatChefEventState
} from '../systems/boatChefDirector'
import { armIslandEvent } from '../systems/islandSpawner'
import {
  resetConstructionPlacementState
} from '../systems/constructionPlacement'
import { resetFishingRodState } from '../systems/fishingRod'
import { resetAnchorState } from '../systems/anchorState'
import { resetAnchorThrowerState } from '../systems/anchorThrower'
import { resetHookThrowerState } from '../systems/hookThrower'
import { resetRaftBuilderState } from '../systems/raftBuilder'
import { setCookOpen } from '../ui/cookToggle'
import { setCraftOpen } from '../ui/craftToggle'
import { setInventoryOpen } from '../ui/inventoryToggle'
import {
  dismissStartupGate,
  reopenStartupGate,
  startStartupGateExit
} from '../ui/startupGate'
import { closeStorageMenu } from '../ui/storageToggle'
import { setSystemMenuOpen } from '../ui/systemSession'
import { applyDebugSeeds } from './debugSeeds'
import type { SceneMode } from './sceneMode'

let cachedSceneMode: SceneMode | null = null
let cachedParcelGrid = DEMO_PARCEL_GRID
let gameWorldBuilt = false

// One-time call from `main()` once the deployment mode + parcel grid are
// known. Captures both for the BACK TO LOBBY path (which has to be
// synchronous) and arms the portal-trigger handler.
export function bootstrapSceneFlow(mode: SceneMode, parcelGrid: number): void {
  cachedSceneMode = mode
  cachedParcelGrid = parcelGrid
  armLobbyExit()
}

// Arms (or re-arms) the lobby portal-trigger handler. Pulled out of
// bootstrap so the BACK TO LOBBY flow can call it again after rebuilding
// the lobby, without duplicating the exit-fade orchestration.
function armLobbyExit(): void {
  setLobbyExitHandler((kind) => {
    startStartupGateExit(() => {
      teardownLobby()
      // Restore the held viewmodel — gameplay starts now, so the
      // seeded tool (hook by default) should appear in hand.
      setHeldViewmodelHidden(false)
      buildGameWorld(cachedParcelGrid, { debug: kind === 'DEBUG' })
      // Drop the player onto the freshly-built main raft. Game spawn
      // mirrors the parcel-centre coords used in the demo's scene.json
      // spawn point; using movePlayerTo (not Transform mutation) is
      // the only way SDK7 will move the camera as well.
      void movePlayerTo({
        newRelativePosition: {
          x: GRID_ORIGIN.x,
          y: GRID_ORIGIN.y + 1,
          z: GRID_ORIGIN.z
        }
      })
      runPortalAction(kind)
    })
  })
}

// Dev-only fast-boot path. Bypasses lobby creation and the startup gate
// entirely, builds the game world, drops the player onto the main raft,
// and applies the DEBUG seed (inventory + 8-platform ring with grill,
// purifier, and stocked storage). Gated by SKIP_LOBBY in gameConfig.ts —
// force-disabled in production builds.
export function skipLobbyToDebug(parcelGrid: number): void {
  dismissStartupGate()
  setHeldViewmodelHidden(false)
  buildGameWorld(parcelGrid, { debug: true })
  void movePlayerTo({
    newRelativePosition: {
      x: GRID_ORIGIN.x,
      y: GRID_ORIGIN.y + 1,
      z: GRID_ORIGIN.z
    }
  })
  applyDebugSeeds()
}

// One-shot: builds the actual game world (seabed, animated water at
// WATER_LEVEL, the origin raft, sharks). Idempotency-guarded so a stray
// re-entry can't double-spawn — `returnToLobby` flips the flag back to
// false so the next portal entry rebuilds cleanly.
function buildGameWorld(parcelGrid: number, opts: { debug: boolean }): void {
  if (gameWorldBuilt) return
  gameWorldBuilt = true
  createSeabed(parcelGrid)
  createWaterFloorV2(parcelGrid)
  createPlatform(GRID_ORIGIN, { gridX: 0, gridZ: 0, isMain: true })
  // Hide every avatar (self + other players) for the duration of the game
  // session. Cleared by the BACK TO LOBBY sweep — entities with Transform
  // not in the keep-set are removed, taking the modifier area with them.
  createAvatarHideArea(parcelGrid)
  spawnSharks()
  // Recurring boat-chef visitor event. DEBUG fires it immediately so
  // the encounter is testable from any session start; non-debug paths
  // (NEW / LOAD via the lobby portal) start the 10 min visit timer
  // and the boat sails in on its own. The director is also responsible
  // for re-arming after each visit.
  armBoatChefEvent({ immediate: opts.debug })
  // Floating-island spawner. Same dev pattern as the boat chef: DEBUG
  // drops one in on the next tick so it's testable without waiting for
  // the SPAWN_INTERVAL timer. Non-debug paths leave the regular timer to
  // produce the first island.
  armIslandEvent({ immediate: opts.debug })
}

function spawnSharks(): void {
  const phaseStep = (Math.PI * 2) / SHARK_INITIAL_COUNT
  for (let i = 0; i < SHARK_INITIAL_COUNT; i++) {
    spawnRingShark({
      centerX: GRID_ORIGIN.x,
      centerZ: GRID_ORIGIN.z,
      radius: SHARK_INITIAL_RADIUS,
      phase: phaseStep * i
    })
  }
}

function runPortalAction(kind: LobbyButtonKind): void {
  switch (kind) {
    case 'NEW':
      // Fresh start — gameplay state is already at its module defaults.
      return
    case 'LOAD':
      void requestLoad(false)
      return
    case 'DEBUG':
      applyDebugSeeds()
      return
  }
}

// BACK TO LOBBY orchestrator. Triggered from the SYSTEM menu. Sweeps
// every game-world entity except the camera-attached viewmodel and the
// first-person CameraModeArea volume, rebuilds the lobby, re-arms the
// portal trigger, and brings the startup gate back up so the HUD hides
// underneath. Gameplay state (inventory, recipes, stats) intentionally
// persists — the player can SAVE before triggering this if they want a
// hard reset, and the lobby's LOAD WORLD portal still picks up the
// authoritative server save on re-entry.
export function returnToLobby(): void {
  // Close every HUD panel so the player isn't dropped back into the
  // lobby with stale "inventory open" / "system menu open" flags. The
  // startup gate itself hides the HUD, but those flags would re-show
  // panels the moment the player picks a portal again.
  setSystemMenuOpen(false)
  setInventoryOpen(false)
  setCraftOpen(false)
  setCookOpen(false)
  closeStorageMenu()

  const keep = new Set<Entity>()
  keep.add(engine.RootEntity)
  keep.add(engine.PlayerEntity)
  keep.add(engine.CameraEntity)
  for (const entity of getHeldItemViewmodelEntities()) {
    if (entity !== null) keep.add(entity)
  }
  const fpa = getFirstPersonAreaEntity()
  if (fpa !== null) keep.add(fpa)

  // Two-pass sweep: collect first, then remove. Iterating a live query
  // while removing entities mutates the very set being walked — same
  // shape as `teardownLobby`.
  const doomed: Entity[] = []
  for (const [entity] of engine.getEntitiesWith(Transform)) {
    if (keep.has(entity)) continue
    doomed.push(entity)
  }
  for (const entity of doomed) {
    engine.removeEntity(entity)
  }

  // Drop module-level entity refs cached by tool/builder systems —
  // the swept entities they were pointing at are gone, and the next
  // game-world re-entry must lazy-create fresh ones.
  resetAnchorState()
  resetAnchorThrowerState()
  resetHookThrowerState()
  resetFishingRodState()
  resetRaftBuilderState()
  resetConstructionPlacementState()
  resetBoatChefEventState()

  gameWorldBuilt = false
  reopenStartupGate()
  // Re-stash the viewmodel — the lobby overlay covers the HUD again
  // and any equipped tool should be hidden until the player commits
  // to a portal.
  setHeldViewmodelHidden(true)
  if (cachedSceneMode !== null) {
    createLobby(cachedParcelGrid, cachedSceneMode)
  }
  armLobbyExit()
  // Drop the player back at the lobby's bridge-tail spawn in both
  // modes — the bridge is now visible in DEMO and FULL. Lobby rafts
  // sit at LOBBY_RAFT_Y; +1 m gives a tiny drop onto the deck so the
  // player lands cleanly.
  const arrival = getLobbyArrivalPosition(GRID_ORIGIN.x, GRID_ORIGIN.z)
  void movePlayerTo({
    newRelativePosition: {
      x: arrival.x,
      y: GRID_ORIGIN.y + 1,
      z: arrival.z
    }
  })
}
