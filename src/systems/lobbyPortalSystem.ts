import {
  InputAction,
  PointerEventType,
  Transform,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { changeRealm } from '~system/RestrictedActions'

import { LobbyButton, LobbyButtonHover, LobbyTeleport } from '../components'
import {
  FULL_GAME_REALM,
  LobbyButtonKind,
  PORTAL_TRIGGER_RADIUS_SQ,
  applyLobbyButtonMaterial
} from '../factories/lobby'
import {
  hasSavedGame,
  isSaveProbeComplete,
  isStartupGateActive,
  isStartupGateExiting
} from '../ui/startupGate'

// Per-frame interact handler for the lobby. Two paths:
//
//   1. PANEL BUTTONS — each button entity carries `LobbyButton({ kind })`
//      and a PointerEvents wired to IA_POINTER PET_DOWN. On click, the
//      registered exit handler is invoked once with the chosen kind, then
//      the handler reference is cleared so a stutter-click on a second
//      button can't double-fire while the gate fade is still settling.
//
//   2. CROSS-REALM PORTAL — single entity tagged `LobbyTeleport`. Walking
//      into it (XZ proximity) OR clicking it asks the explorer to swap
//      realms via `changeRealm`. The SDK surfaces its own confirmation
//      dialog, so the scene just fires the request and lets the explorer
//      drive the user choice. A one-shot guard prevents the prompt from
//      being re-issued every frame the player overlaps the portal.
//
// All trigger logic gates on `isStartupGateActive()` so it goes silent
// the moment the player commits to entering the game world.

type ExitHandler = (kind: LobbyButtonKind) => void

let exitHandler: ExitHandler | null = null
// One-shot latch for the realm change. `changeRealm` is async and the
// explorer's confirmation can take seconds — without this, every frame
// the player overlaps the portal would re-issue the call and stack
// confirmations. Reset only once the player walks back out of the
// trigger ring.
let teleportArmed = true
// Last applied LOAD-button enabled state — null means we haven't
// touched the material yet, so the very first probe result will fire
// `applyLobbyButtonMaterial` even if the answer happens to match the
// factory's default.
let lastLoadEnabled: boolean | null = null

export function setLobbyExitHandler(fn: ExitHandler): void {
  exitHandler = fn
  teleportArmed = true
  // New session: reset the cached LOAD state so the first frame after a
  // re-entry (e.g. after BACK TO LOBBY) re-applies the material.
  lastLoadEnabled = null
}

export function lobbyPortalSystem(_dt: number): void {
  if (!isStartupGateActive()) return
  if (isStartupGateExiting()) return

  syncLoadButtonState()
  if (exitHandler !== null) {
    handleButtonClicks()
  }
  handleTeleport()
}

function isLoadAvailable(): boolean {
  return isSaveProbeComplete() && hasSavedGame()
}

// Re-skin the LOAD button when the save-probe verdict flips. Using the
// cached `lastLoadEnabled` keeps us from re-emitting the material every
// frame — only the transition (probing → no save → save found) writes.
// The material lives on the visual child (separate from the click
// plate that carries `LobbyButton`), so we hop through `LobbyButtonHover`
// to find which entity to re-skin.
function syncLoadButtonState(): void {
  const enabled = isLoadAvailable()
  if (enabled === lastLoadEnabled) return
  lastLoadEnabled = enabled
  for (const [entity, btn] of engine.getEntitiesWith(LobbyButton)) {
    if (btn.kind !== 'LOAD') continue
    const hover = LobbyButtonHover.getOrNull(entity)
    if (hover === null) continue
    applyLobbyButtonMaterial(hover.visualEntity, enabled)
  }
}

function handleButtonClicks(): void {
  for (const [entity, btn] of engine.getEntitiesWith(LobbyButton)) {
    const clicked = inputSystem.isTriggered(
      InputAction.IA_POINTER,
      PointerEventType.PET_DOWN,
      entity
    )
    if (!clicked) continue
    // Swallow LOAD clicks while no save is available so the player
    // can't fall into a load that won't restore anything. The visual
    // gray state cues this; the click guard backs it up.
    if (btn.kind === 'LOAD' && !isLoadAvailable()) return
    const handler = exitHandler
    if (handler === null) return
    // Clear before invoking so a re-entrant trigger (the handler
    // imports from this module) can't double-fire.
    exitHandler = null
    handler(btn.kind as LobbyButtonKind)
    return
  }
}

function handleTeleport(): void {
  const playerT = Transform.getOrNull(engine.PlayerEntity)
  if (playerT === null) return

  for (const [entity] of engine.getEntitiesWith(LobbyTeleport, Transform)) {
    const portalT = Transform.get(entity)
    const dx = portalT.position.x - playerT.position.x
    const dz = portalT.position.z - playerT.position.z
    const inside = dx * dx + dz * dz <= PORTAL_TRIGGER_RADIUS_SQ
    const clicked = inputSystem.isTriggered(
      InputAction.IA_POINTER,
      PointerEventType.PET_DOWN,
      entity
    )

    if (!inside && !clicked) {
      // Player has cleared the trigger ring — re-arm so a future
      // approach can fire another prompt (e.g. they cancelled the
      // explorer dialog and want to try again).
      teleportArmed = true
      continue
    }
    if (!teleportArmed) continue

    teleportArmed = false
    void changeRealm({
      realm: FULL_GAME_REALM,
      message: 'Travel to the FULL raft world?'
    })
    return
  }
}
