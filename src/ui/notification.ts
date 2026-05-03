// Single-slot mobile-style notification banner. There is at most one
// notification on screen — calling `showNotification` while one is already
// visible replaces it (the new message resets the timer and re-runs the
// slide-in animation, so the player notices the swap).
//
// Lifecycle: ENTER (slide down from offscreen) → HOLD (fully visible) →
// EXIT (slide back up). Driven by `tickNotification(dt)` registered as a
// system in `src/index.ts` so the UI renderer can read a derived progress
// value cheaply each frame.

const ENTER_DURATION = 0.35
const HOLD_DURATION = 3.0
const EXIT_DURATION = 0.45

interface NotificationState {
  message: string
  elapsed: number
}

let current: NotificationState | null = null

export function showNotification(message: string): void {
  current = { message, elapsed: 0 }
}

export function tickNotification(dt: number): void {
  if (current === null) return
  current.elapsed += dt
  const total = ENTER_DURATION + HOLD_DURATION + EXIT_DURATION
  if (current.elapsed >= total) current = null
}

export interface NotificationView {
  message: string
  // 0 = fully offscreen above, 1 = fully resting at its on-screen position.
  // Lets the renderer interpolate the `top` offset so the banner slides in
  // from above and back out the same way.
  slide: number
}

export function getNotification(): NotificationView | null {
  if (current === null) return null
  const e = current.elapsed
  let slide: number
  if (e < ENTER_DURATION) {
    // Cubic ease-out so the banner decelerates as it lands.
    const t = e / ENTER_DURATION
    const eased = 1 - Math.pow(1 - t, 3)
    slide = eased
  } else if (e < ENTER_DURATION + HOLD_DURATION) {
    slide = 1
  } else {
    // Cubic ease-in on the way out — accelerates as it leaves the screen.
    const t = (e - ENTER_DURATION - HOLD_DURATION) / EXIT_DURATION
    const eased = t * t * t
    slide = 1 - eased
  }
  return { message: current.message, slide }
}
