// Single global oscillator used by every shaking inventory slot during
// swap-mode. Each slot reads the same offset so they sway as a group
// rather than each judderring on its own phase.

const SHAKE_FREQ_HZ = 5
const SHAKE_AMP_PX = 1.5
const SHAKE_OMEGA = 2 * Math.PI * SHAKE_FREQ_HZ

export interface ShakeOffset {
  x: number
  y: number
}

// y at quarter-period offset from x → tiny circular sway rather than
// a pure horizontal shimmy. Both axes share the same global time.
export function shakeOffset(timeSec: number): ShakeOffset {
  return {
    x: Math.round(SHAKE_AMP_PX * Math.sin(SHAKE_OMEGA * timeSec)),
    y: Math.round(SHAKE_AMP_PX * Math.sin(SHAKE_OMEGA * timeSec + Math.PI / 2))
  }
}
