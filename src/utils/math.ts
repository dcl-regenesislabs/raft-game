// Shared scalar-math helpers used across systems. Kept in one module so the
// same primitives don't drift between systems (e.g. one easing curve here,
// another inline somewhere else) and so each is a one-liner at the call site.

export const TAU = Math.PI * 2
export const RAD_TO_DEG = 180 / Math.PI
export const DEG_TO_RAD = Math.PI / 180

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

// Cubic ease-out — fast at the start, gentle at the end. Used for shark
// approach/return arcs and any "slide into place" UI motion.
export function easeOutCubic(t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}

// Wraps an angle into [0, TAU). Handles negative inputs and arbitrary
// multiples of TAU; safe to call every frame on accumulating phases.
export function wrapAngle(value: number): number {
  return ((value % TAU) + TAU) % TAU
}

// Wraps a unit value into [0, 1). Useful for UV scrolls and any 0-1
// accumulator where the value would otherwise drift unbounded.
export function wrapUnit(value: number): number {
  return ((value % 1) + 1) % 1
}

// Frame-rate independent exponential smoothing factor. Pass to a
// `current += (target - current) * alpha` lerp to smooth toward a target at
// rate `k` (s⁻¹). Higher k = snappier.
export function smoothingAlpha(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt)
}

// Inclusive integer in [min, max].
export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}
