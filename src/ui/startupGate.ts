// Boot-time "title" overlay. Sits on top of the HUD on every scene load
// and forces the player to choose NEW WORLD or LOAD WORLD before any
// gameplay happens. The probe state lets the LOAD button render dimmed
// when the server hasn't reported back yet, or when no save exists.
//
// Pressing a button starts an exit fade — the screen is still rendered
// while its opacity ramps from 1 → 0; when the fade finishes the
// captured action runs and the gate is dismissed. Deferring the action
// until after the fade keeps the scene reveal clean (no pop-in of
// loaded state or debug-seed platforms during the fade).
//
// The gate is dismissed exactly once per session; reload to bring it
// back. Movement is locked while the gate is up via the same
// InputModifier pattern the death screen uses.

import { InputModifier, engine } from '@dcl/sdk/ecs'

const EXIT_FADE_DURATION_S = 0.6

let active = true
let probeCompleted = false
let savedGameAvailable = false
let lastModifierApplied: boolean | null = null

let exiting = false
let exitElapsed = 0
let exitAction: (() => void) | null = null

export function isStartupGateActive(): boolean {
  return active
}

export function isStartupGateExiting(): boolean {
  return exiting
}

// Immediate dismiss without a fade — kept as a safety hatch in case a
// caller needs to skip the exit transition entirely. Player-facing
// flows go through `startStartupGateExit` so the screen fades out.
export function dismissStartupGate(): void {
  exiting = false
  exitElapsed = 0
  exitAction = null
  active = false
}

// Bring the gate back up after it has already been dismissed. Used by
// the BACK TO LOBBY flow so the player lands in the lobby with the
// title overlay covering the HUD, just like a fresh boot.
export function reopenStartupGate(): void {
  exiting = false
  exitElapsed = 0
  exitAction = null
  active = true
}

// 1 = fully opaque (visible state), 0 = fully faded out. Used by the
// StartupScreen renderer to fade the backdrop, logo, and buttons in
// lockstep during the exit transition.
export function getStartupGateOpacity(): number {
  if (!exiting) return 1
  const t = exitElapsed / EXIT_FADE_DURATION_S
  return t >= 1 ? 0 : 1 - t
}

// Begin the fade-out. The screen stays mounted at decreasing opacity;
// when the fade completes the system tick fires the captured action
// (load / debug seed / nothing) and flips `active` to false so the UI
// unmounts the overlay.
export function startStartupGateExit(action: () => void): void {
  if (exiting || !active) return
  exiting = true
  exitElapsed = 0
  exitAction = action
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

// Drives the exit fade and the input-lock modifier.
//
// Three input states:
//   - `exiting`: the player has committed to a portal and the screen is
//     fading out. Full lock so they can't drift off the raft as the
//     world swaps underneath.
//   - `active && !exiting`: the lobby is walkable, but we still
//     disable double-jump and gliding so the player can't pop above
//     or drift over the blocker walls while choosing a portal.
//   - `!active`: gameplay. We release our locomotion lock once and stop
//     writing so peer systems (inventory, gameOver) can drive the
//     modifier. Double-jump and gliding remain disabled scene-wide.
//
// While the gate is `active` we re-apply the modifier every frame —
// peer systems also write to it on their own state changes (e.g.
// inventory close → walk-unlocked), and that would otherwise clobber
// the double-jump and gliding blocks.
export function startupGateInputLockSystem(dt: number): void {
  if (exiting) {
    exitElapsed += dt
    if (exitElapsed >= EXIT_FADE_DURATION_S) {
      const action = exitAction
      exiting = false
      exitAction = null
      active = false
      // Run the deferred action after the fade — load request, debug
      // seed, etc. Done before the input modifier flip below so any
      // movePlayerTo issued by the action races the lock release in
      // a predictable order.
      action?.()
    }
  }
  if (active) {
    InputModifier.createOrReplace(engine.PlayerEntity, {
      mode: InputModifier.Mode.Standard({
        disableWalk: exiting,
        disableJog: exiting,
        // Run is disabled scene-wide — players are limited to walk
        // and jog so they can't sprint off the raft.
        disableRun: true,
        disableJump: exiting,
        disableDoubleJump: true,
        disableGliding: true
      })
    })
    lastModifierApplied = true
    return
  }
  if (lastModifierApplied !== false) {
    lastModifierApplied = false
    InputModifier.createOrReplace(engine.PlayerEntity, {
      mode: InputModifier.Mode.Standard({
        disableWalk: false,
        disableJog: false,
        disableRun: true,
        disableJump: false,
        disableDoubleJump: true,
        disableGliding: true
      })
    })
  }
}
