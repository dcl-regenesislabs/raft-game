// Generic press-pulse animation. Mirrors the squared-ease scale-up pattern
// used by the inventory/action/craft toggle buttons: on `press()` the scale
// snaps to `1 + peakBonus` and decays back to `1` over `durationSec` with a
// quadratic ease-out (so the icon pops fast and settles slow).
//
// Each call to `createPressPulse` registers a clock that the global
// `pressPulseTickSystem` advances every frame — callers don't have to wire
// their own per-button system.

interface PulseState {
  elapsed: number
  duration: number
  peakBonus: number
}

const allPulses: PulseState[] = []

export interface PressPulse {
  press(): void
  getScale(): number
}

export function createPressPulse(
  durationSec: number = 0.32,
  peakBonus: number = 0.18
): PressPulse {
  const state: PulseState = {
    elapsed: durationSec + 1,
    duration: durationSec,
    peakBonus
  }
  allPulses.push(state)
  return {
    press(): void {
      state.elapsed = 0
    },
    getScale(): number {
      if (state.elapsed >= state.duration) return 1
      const linear = 1 - state.elapsed / state.duration
      const ease = linear * linear
      return 1 + state.peakBonus * ease
    }
  }
}

export function pressPulseTickSystem(dt: number): void {
  for (const p of allPulses) {
    if (p.elapsed <= p.duration) p.elapsed += dt
  }
}
