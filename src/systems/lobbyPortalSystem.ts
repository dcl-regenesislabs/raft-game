import {
  InputAction,
  PointerEventType,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'

import { LobbyButton, LobbyButtonHover } from '../components'
import {
  LobbyButtonKind,
  applyLobbyButtonMaterial
} from '../factories/lobby'
import {
  hasSavedGame,
  isSaveProbeComplete,
  isStartupGateActive,
  isStartupGateExiting
} from '../ui/startupGate'

// Per-frame interact handler for the lobby buttons.
//
//   1. PANEL BUTTONS — each button entity carries `LobbyButton({ kind })`
//      and a PointerEvents wired to IA_POINTER PET_DOWN. On click, the
//      registered exit handler is invoked once with the chosen kind, then
//      the handler reference is cleared so a stutter-click on a second
//      button can't double-fire while the gate fade is still settling.
//
// All trigger logic gates on `isStartupGateActive()` so it goes silent
// the moment the player commits to entering the game world.

type ExitHandler = (kind: LobbyButtonKind) => void

let exitHandler: ExitHandler | null = null
// Last applied LOAD-button enabled state — null means we haven't
// touched the material yet, so the very first probe result will fire
// `applyLobbyButtonMaterial` even if the answer happens to match the
// factory's default.
let lastLoadEnabled: boolean | null = null

export function setLobbyExitHandler(fn: ExitHandler): void {
  exitHandler = fn
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
