import { InputModifier, engine } from '@dcl/sdk/ecs'

import { disableChefAfterWin } from '../systems/boatChefDirector'
import { getPlayTimeS, stopPlayTimer } from '../systems/playTimer'
import { submitScore } from '../client/rankingClient'
import type { SceneMode } from '../runtime/sceneMode'

const FADE_BACKDROP_DURATION_S = 1.5
const FADE_PANEL_DELAY_S = 1.0
const FADE_PANEL_DURATION_S = 0.6

let won = false
let elapsedSec = 0
let finalTimeS = 0
let lastModifierApplied: boolean | null = null
let cachedMode: SceneMode | null = null

export function isWinActive(): boolean {
  return won
}

export function getWinBackdropFade(): number {
  if (!won) return 0
  return clamp01(elapsedSec / FADE_BACKDROP_DURATION_S)
}

export function getWinPanelFade(): number {
  if (!won) return 0
  return clamp01((elapsedSec - FADE_PANEL_DELAY_S) / FADE_PANEL_DURATION_S)
}

export function getWinTimeS(): number {
  return finalTimeS
}

export function triggerWin(mode: SceneMode): void {
  if (won) return
  stopPlayTimer()
  finalTimeS = getPlayTimeS()
  cachedMode = mode
  won = true
  elapsedSec = 0
  disableChefAfterWin()
  submitScore(mode, finalTimeS)
}

export function dismissWin(): void {
  won = false
  elapsedSec = 0
  lastModifierApplied = null
}

export function resetWinState(): void {
  won = false
  elapsedSec = 0
  finalTimeS = 0
  lastModifierApplied = null
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function winScreenInputLockSystem(dt: number): void {
  if (won) elapsedSec += dt
  if (won === lastModifierApplied) return
  lastModifierApplied = won
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableWalk: won,
      disableJog: won,
      disableRun: true,
      disableJump: won,
      disableDoubleJump: true,
      disableGliding: true
    })
  })
}
