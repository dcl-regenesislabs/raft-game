// Boot-time "title" overlay. Sits on top of the HUD on every scene load
// and forces the player to choose NEW GAME or LOAD LAST GAME before any
// gameplay happens. The probe state lets the LOAD button render dimmed
// when the server hasn't reported back yet, or when no save exists.
//
// The gate is dismissed exactly once per session; reload to bring it
// back. Movement is locked while the gate is up via the same
// InputModifier pattern the death screen uses.

import { InputModifier, engine } from '@dcl/sdk/ecs'

let active = true
let probeCompleted = false
let savedGameAvailable = false
let lastModifierApplied: boolean | null = null

export function isStartupGateActive(): boolean {
  return active
}

export function dismissStartupGate(): void {
  active = false
}

export function isSaveProbeComplete(): boolean {
  return probeCompleted
}

export function hasSavedGame(): boolean {
  return savedGameAvailable
}

export function setSaveProbeResult(found: boolean): void {
  probeCompleted = true
  savedGameAvailable = found
}

// Same lock pattern as the death-screen / inventory-toggle locks —
// only writes the modifier when our state has changed, so the three
// locks compose without fighting each other on stable frames.
export function startupGateInputLockSystem(_dt: number): void {
  if (active === lastModifierApplied) return
  lastModifierApplied = active
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableWalk: active,
      disableJog: active,
      disableRun: active,
      disableJump: active,
      disableDoubleJump: active,
      disableGliding: active
    })
  })
}
