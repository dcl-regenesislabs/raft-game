import { SkyboxTime, engine } from '@dcl/sdk/ecs'
import { sfxTickSystem } from './audio/sfx'
// import { isServer } from '@dcl/sdk/network'

// import {
//   initSaveClient,
//   saveClientTickSystem
// } from './client/saveClient'
// import { runServer } from './server/server'

import {
  GRID_ORIGIN,
  configureGridOrigin,
  createFirstPersonArea,
  createHeldItem,
  setHeldViewmodelHidden
} from './factories'
import { SKIP_LOBBY } from './config/gameConfig'
import { createLobby } from './factories/lobby'
import { DEMO_PARCEL_GRID, FULL_PARCEL_GRID } from './factories/sceneLevels'
import { bootstrapSceneFlow, skipLobbyToDebug } from './runtime/sceneFlow'
import { getSceneMode } from './runtime/sceneMode'
import { constructionInteractSystem } from './systems/constructionInteract'
import { constructionPlacementSystem } from './systems/constructionPlacement'
import { cupFillSystem } from './systems/cupFill'
import { createFallRescueSystem } from './systems/fallRescue'
import { firstPersonItemSwaySystem } from './systems/firstPersonItemSway'
import { fishingRodSystem } from './systems/fishingRod'
import { floatingGarbageSystem } from './systems/floatingGarbage'
import { foodEatSystem } from './systems/foodEat'
import { garbageSpawnerSystem } from './systems/garbageSpawner'
import { grillCookSystem } from './systems/grillCook'
import { grillFireSystem } from './systems/grillFire'
import { hammerSwingSystem } from './systems/hammerSwing'
import { hookThrowAnimSystem } from './systems/hookThrowAnim'
import { hookThrowerSystem } from './systems/hookThrower'
import { rodHookSwingSystem } from './systems/rodHookSwing'
import { inventoryInputSystem } from './systems/inventoryInput'
import { boatChefDirectorSystem } from './systems/boatChefDirector'
import { chefAnimDebugSystem } from './systems/chefAnimDebug'
import { chefDialogSystem } from './systems/chefDialog'
import { lobbyButtonHoverSystem } from './systems/lobbyButtonHover'
import { lobbyPortalSystem } from './systems/lobbyPortalSystem'
import { portalPulseSystem } from './systems/portalPulse'
import { portalUvSwirlSystem } from './systems/portalUvSwirl'
import { lookAtTargetSystem } from './systems/lookAtTarget'
import { raftBuilderSystem } from './systems/raftBuilder'
import { sharkAttackSystem } from './systems/sharkAttack'
import { sharkDirectorSystem } from './systems/sharkDirector'
import { sharkOrbitSystem } from './systems/sharkOrbit'
import { sharkPointerEventsSystem } from './systems/sharkPointerEvents'
import { spearAttackSystem } from './systems/spearAttack'
import { survivalDrainSystem } from './systems/survivalDrain'
import { waterScrollSystem } from './systems/waterScroll'
import { setupUi } from './ui'
import { actionButtonResetSystem } from './ui/actionButton'
import { craftSessionTickSystem } from './ui/craftSession'
import { craftToggleResetSystem } from './ui/craftToggle'
import { gameOverInputLockSystem } from './ui/gameOver'
import { dragResetSystem } from './ui/inventoryDrag'
import { inventoryToggleResetSystem } from './ui/inventoryToggle'
import { tickItemReceivedNotification } from './ui/itemReceivedNotification'
import { tickNotification } from './ui/notification'
import { preloadHudAssets } from './ui/hudPreload'
import { startupGateInputLockSystem } from './ui/startupGate'
import { storageToggleResetSystem } from './ui/storageToggle'
import { systemToggleTickSystem } from './ui/systemToggle'
import { pressPulseTickSystem } from './ui/pressPulse'
import { purifySessionTickSystem } from './ui/purifySession'
import { worldClickGateResetSystem } from './ui/worldClickGate'

export async function main(): Promise<void> {
  // TODO: re-enable server once @dcl/sdk/server is available
  // if (isServer()) {
  //   runServer()
  //   return
  // }
  // Detect which deployment we're running in. raft.dcl.eth is the FULL
  // 50x50 game; everything else (italy2026 demo, local preview) gets the
  // 5x5 demo layout. configureGridOrigin must run before any factory below
  // because gridCellToWorld and the raft-builder system read GRID_ORIGIN.
  const mode = await getSceneMode()
  const parcelGrid = mode === 'full' ? FULL_PARCEL_GRID : DEMO_PARCEL_GRID
  configureGridOrigin(parcelGrid)

  // Lock the world skybox to midday (12:00 = 43200 s into the day) so
  // lighting stays consistent across long play sessions and screenshots.
  // Works in both local preview and Worlds deployments.
  SkyboxTime.create(engine.RootEntity, { fixedTime: 43200 })

  // Kick off HUD texture preload as early as possible so the renderer
  // warms its cache while the startup gate is up. Fire-and-forget — no
  // gameplay system blocks on it.
  preloadHudAssets()

  createFirstPersonArea(parcelGrid)
  createHeldItem('hook')
  // Stash the viewmodel until the player commits to a portal — the
  // lobby renders the startup overlay over the HUD and shouldn't show
  // any equipped tool through it.
  setHeldViewmodelHidden(true)
  engine.addSystem(sfxTickSystem)
  engine.addSystem(firstPersonItemSwaySystem)
  engine.addSystem(spearAttackSystem)
  engine.addSystem(hammerSwingSystem)
  // lookAtTargetSystem owns the camera-forward raycast that classifies
  // what the player is currently aiming at (water / purifier / grill).
  // Must run before `constructionInteract` and `cupFill` so they read a
  // fresh target this frame.
  engine.addSystem(lookAtTargetSystem)
  // Construction + cup-fill must run BEFORE foodEat so they can mark
  // this frame's click as consumed (via worldClickGate) — otherwise a
  // tap on the purifier with salt water held would also drain the cup.
  engine.addSystem(constructionInteractSystem)
  engine.addSystem(cupFillSystem)
  engine.addSystem(foodEatSystem)
  engine.addSystem(hookThrowAnimSystem)
  engine.addSystem(rodHookSwingSystem)
  // Game-world geometry (seabed, the y=4 water plane, the main raft,
  // and the sharks) is intentionally deferred to `buildGameWorld`
  // below — only the lobby exists at boot. Systems below stay
  // registered because their queries no-op on empty entity sets.
  engine.addSystem(waterScrollSystem)
  engine.addSystem(sharkOrbitSystem)
  engine.addSystem(sharkDirectorSystem)
  engine.addSystem(sharkAttackSystem)
  engine.addSystem(sharkPointerEventsSystem)
  engine.addSystem(lobbyPortalSystem)
  engine.addSystem(portalPulseSystem)
  engine.addSystem(portalUvSwirlSystem)
  engine.addSystem(lobbyButtonHoverSystem)
  // Director MUST run before chefDialogSystem — on the WAITING → INTERACTING
  // click frame it swaps the chef's dialog script and resets
  // `dialogLineIndex = -1`, so the dialog system's `(idx + 1) % stateCount`
  // on the same frame lands on 0 and shows the new script's first line.
  engine.addSystem(boatChefDirectorSystem)
  engine.addSystem(chefDialogSystem)
  engine.addSystem(chefAnimDebugSystem)
  engine.addSystem(garbageSpawnerSystem)
  engine.addSystem(floatingGarbageSystem)
  engine.addSystem(grillFireSystem)
  engine.addSystem(grillCookSystem)
  engine.addSystem(createFallRescueSystem(GRID_ORIGIN))
  engine.addSystem(survivalDrainSystem)
  engine.addSystem(raftBuilderSystem)
  engine.addSystem(constructionPlacementSystem)
  engine.addSystem(hookThrowerSystem)
  engine.addSystem(fishingRodSystem)
  engine.addSystem(inventoryInputSystem)
  engine.addSystem(craftSessionTickSystem)
  engine.addSystem(purifySessionTickSystem)
  engine.addSystem(inventoryToggleResetSystem)
  engine.addSystem(craftToggleResetSystem)
  engine.addSystem(storageToggleResetSystem)
  engine.addSystem(systemToggleTickSystem)
  engine.addSystem(gameOverInputLockSystem)
  engine.addSystem(startupGateInputLockSystem)
  engine.addSystem(pressPulseTickSystem)
  engine.addSystem(tickNotification)
  engine.addSystem(tickItemReceivedNotification)
  engine.addSystem(dragResetSystem)
  // These two end-of-frame resets must be the last systems registered
  // so every consumer above sees the action-button edge flag and the
  // world-click-consumed flag for the current frame before they're
  // cleared. Order between them doesn't matter — they touch
  // independent state.
  engine.addSystem(actionButtonResetSystem)
  engine.addSystem(worldClickGateResetSystem)
  // Save-system networking: register room listeners once, then run the
  // tick system that watches for state-sync and auto-loads on the rising
  // edge. Must come after the gameplay state modules above because the
  // auto-load mutates them on first sync.
  // TODO: re-enable once @dcl/sdk/network is available
  // initSaveClient()
  // engine.addSystem(saveClientTickSystem)

  // Build the lobby world (water at y=0, raft island, bridges, portals)
  // and arm the portal-trigger handler via the scene-flow runtime. The
  // handler runs the gate's exit fade, then on fade completion swaps the
  // lobby for the actual game world and runs the kind-specific bootstrap
  // (load / debug / nothing). Bootstrap also caches mode/parcelGrid so the
  // SystemMenu's BACK TO LOBBY can rebuild the same configuration.
  //
  // SKIP_LOBBY (dev-only, force-disabled in production) jumps straight
  // into the DEBUG-seeded game world. Bootstrap still runs so a later
  // BACK TO LOBBY from the system menu can rebuild the lobby cleanly.
  bootstrapSceneFlow(mode, parcelGrid)
  if (SKIP_LOBBY) {
    skipLobbyToDebug(parcelGrid)
  } else {
    createLobby(parcelGrid, mode)
  }

  setupUi()
}
