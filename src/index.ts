import { mobileUiInputSystem } from './ui/mobileControlsState'
import { engine } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'
import { ambienceTickSystem } from './audio/ambience'
import { musicTickSystem, setMusicTrack } from './audio/music'
import { sfxTickSystem } from './audio/sfx'
// import { isServer } from '@dcl/sdk/network'

// import {
//   initSaveClient,
//   saveClientTickSystem
// } from './client/saveClient'
// import {
//   initRankingClient,
//   rankingClientTickSystem
// } from './client/rankingClient'
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
import { PARCEL_GRID } from './factories/sceneLevels'
import { bootstrapSceneFlow, startGameDirectly } from './runtime/sceneFlow'
import { constructionInteractSystem } from './systems/constructionInteract'
import { constructionPlacementSystem } from './systems/constructionPlacement'
import { cupFillSystem } from './systems/cupFill'
import { createFallRescueSystem } from './systems/fallRescue'
import { lobbyWaterRescueSystem } from './systems/lobbyWaterRescue'
import { firstPersonItemSwaySystem } from './systems/firstPersonItemSway'
import { fishingRodSystem } from './systems/fishingRod'
import { floatingGarbageSystem } from './systems/floatingGarbage'
import { foodEatSystem } from './systems/foodEat'
import { anchorThrowerSystem } from './systems/anchorThrower'
import { anchorInterpolationSystem } from './systems/anchorState'
import { createFloatingIslandPool } from './factories/floatingIsland'
import { floatingIslandSystem } from './systems/floatingIsland'
import { islandChestSystem } from './systems/islandChest'
import { eventSchedulerSystem } from './systems/eventScheduler'
import { garbageGrabSystem } from './systems/garbageGrab'
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
import { chefIdleStarterSystem } from './systems/chefIdleStarter'
import { chefDialogSystem } from './systems/chefDialog'
import { lobbyButtonHoverSystem } from './systems/lobbyButtonHover'
import { lobbyPortalSystem } from './systems/lobbyPortalSystem'
import { lookAtTargetSystem } from './systems/lookAtTarget'
import { initTouchControls, touchControlsSystem } from './systems/touchControls'
import { raftBuilderSystem } from './systems/raftBuilder'
import { sharkAttackSystem } from './systems/sharkAttack'
import { sharkDirectorSystem } from './systems/sharkDirector'
import { sharkOrbitSystem } from './systems/sharkOrbit'
import { sharkPointerEventsSystem } from './systems/sharkPointerEvents'
import { spearAttackSystem } from './systems/spearAttack'
import { survivalDrainSystem } from './systems/survivalDrain'
import { playTimerSystem } from './systems/playTimer'
import { rankingPanelRefreshSystem } from './systems/rankingPanelRefresh'
import { waterScrollSystem } from './systems/waterScroll'
import { setupUi } from './ui'
import { actionButtonResetSystem } from './ui/actionButton'
import { craftSessionTickSystem } from './ui/craftSession'
import { craftToggleResetSystem } from './ui/craftToggle'
import { gameOverInputLockSystem } from './ui/gameOver'
import { winScreenInputLockSystem } from './ui/winScreen'
import { dragResetSystem } from './ui/inventoryDrag'
import { inventoryToggleResetSystem } from './ui/inventoryToggle'
import { tickItemReceivedNotification } from './ui/itemReceivedNotification'
import { tickNotification } from './ui/notification'
import { preloadHudAssets } from './ui/hudPreload'
import { startupGateInputLockSystem } from './ui/startupGate'
import { storageToggleResetSystem } from './ui/storageToggle'
import { systemToggleTickSystem } from './ui/systemToggle'
import { pressPulseTickSystem } from './ui/pressPulse'
import { purifierFillSystem } from './systems/purifierFill'
import { purifierProcessSystem } from './systems/purifierProcess'
import { worldClickGateResetSystem } from './ui/worldClickGate'

export async function main(): Promise<void> {
  // TODO: re-enable server once @dcl/sdk/server is available
  // if (isServer()) {
  //   runServer()
  //   return
  // }
  // Use the same full-sized world in production and local previews.
  const parcelGrid = PARCEL_GRID
  configureGridOrigin(parcelGrid)

  // Kick off HUD texture preload as early as possible so the renderer
  // warms its cache while the startup gate is up. Fire-and-forget — no
  // gameplay system blocks on it.
  preloadHudAssets()

  // Baseline native touch-gamepad declutter (hide 1-4 / pointer / E / F)
  // so touch clients boot clean. Desktop clients ignore the component.
  initTouchControls()

  createFirstPersonArea(parcelGrid)
  createHeldItem('hook')
  // Stash the viewmodel until the player commits to a portal — the
  // lobby renders the startup overlay over the HUD and shouldn't show
  // any equipped tool through it.
  setHeldViewmodelHidden(true)
  engine.addSystem(sfxTickSystem)
  engine.addSystem(musicTickSystem)
  engine.addSystem(ambienceTickSystem)
  engine.addSystem(firstPersonItemSwaySystem)
  engine.addSystem(inventoryInputSystem)
  engine.addSystem(spearAttackSystem)
  engine.addSystem(hammerSwingSystem)
  // lookAtTargetSystem owns the camera-forward raycast that classifies
  // what the player is currently aiming at (water / purifier / grill).
  // Must run before `constructionInteract` and `cupFill` so they read a
  // fresh target this frame.
  engine.addSystem(lookAtTargetSystem)
  // Keeps the native touch buttons (E / F / pointer) in sync with what
  // the player can currently do. Mobile-only: the component is a no-op
  // on desktop, so skip the per-frame recompute there. Registered right
  // after lookAtTargetSystem to read the freshest classification.
  if (isMobile()) engine.addSystem(touchControlsSystem)
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
  engine.addSystem(lobbyButtonHoverSystem)
  // Director MUST run before chefDialogSystem — on the WAITING → INTERACTING
  // click frame it swaps the chef's dialog script and resets
  // `dialogLineIndex = -1`, so the dialog system's `(idx + 1) % stateCount`
  // on the same frame lands on 0 and shows the new script's first line.
  engine.addSystem(boatChefDirectorSystem)
  engine.addSystem(chefDialogSystem)
  engine.addSystem(chefAnimDebugSystem)
  engine.addSystem(chefIdleStarterSystem)
  // One-shot pool init: builds the (hidden) floating-island hierarchy so
  // the spawner/lifetime systems can flip visibility instead of creating
  // and destroying entities every cycle. Must happen before the systems
  // below run their first tick, but order vs. the lobby/game build is
  // irrelevant because the entity starts inactive.
  createFloatingIslandPool()
  // One scheduler decides which scripted event fires this frame —
  // sharks (fixed cadence), islands (fixed cadence), or chef (event
  // driven). Registered after the directors so the falling-edge
  // detector observes this-frame chef state and so the `armX`/`triggerX`
  // calls land before the directors re-run next frame.
  engine.addSystem(eventSchedulerSystem)
  engine.addSystem(floatingIslandSystem)
  engine.addSystem(islandChestSystem)
  engine.addSystem(anchorInterpolationSystem)
  engine.addSystem(anchorThrowerSystem)
  engine.addSystem(garbageSpawnerSystem)
  engine.addSystem(floatingGarbageSystem)
  // Direct grab — runs before the inventory hotkey reader so the slot-5
  // (E key) hotkey can suppress itself when this frame's press grabbed a
  // looked-at item. Order vs. floatingGarbageSystem doesn't matter; the
  // grab checks `FloatingGarbage.getOrNull` defensively.
  engine.addSystem(garbageGrabSystem)
  engine.addSystem(grillFireSystem)
  engine.addSystem(grillCookSystem)
  engine.addSystem(createFallRescueSystem(GRID_ORIGIN))
  engine.addSystem(lobbyWaterRescueSystem)
  engine.addSystem(survivalDrainSystem)
  engine.addSystem(raftBuilderSystem)
  engine.addSystem(constructionPlacementSystem)
  engine.addSystem(hookThrowerSystem)
  engine.addSystem(fishingRodSystem)
  engine.addSystem(craftSessionTickSystem)
  engine.addSystem(purifierProcessSystem)
  engine.addSystem(purifierFillSystem)
  engine.addSystem(mobileUiInputSystem)
  engine.addSystem(inventoryToggleResetSystem)
  engine.addSystem(craftToggleResetSystem)
  engine.addSystem(storageToggleResetSystem)
  engine.addSystem(systemToggleTickSystem)
  engine.addSystem(gameOverInputLockSystem)
  engine.addSystem(winScreenInputLockSystem)
  engine.addSystem(playTimerSystem)
  engine.addSystem(rankingPanelRefreshSystem)
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
  // initRankingClient()
  // engine.addSystem(rankingClientTickSystem)

  // Build the lobby world (water at y=0, raft island, bridges, portals)
  // and arm the portal-trigger handler via the scene-flow runtime. The
  // handler runs the gate's exit fade, then on fade completion swaps the
  // lobby for the actual game world and runs the kind-specific bootstrap
  // (load / debug / nothing). Bootstrap also caches parcelGrid so the
  // SystemMenu's BACK TO LOBBY can rebuild the same configuration.
  //
  // Direct entry starts a normal game. Keep the lobby configuration available
  // for the optional BACK TO LOBBY action.
  bootstrapSceneFlow(parcelGrid)
  if (SKIP_LOBBY) {
    startGameDirectly(parcelGrid)
  } else {
    createLobby(parcelGrid)
    setMusicTrack('lobby')
  }

  setupUi()
}
