import { RAIN_CYCLE_S, RAIN_DURATION_S, RAIN_CLOUD_TRANSITION_S } from '../config/gameConfig'

export function isRainingAt(seconds: number): boolean {
  return Math.max(0, seconds) % RAIN_CYCLE_S >= RAIN_CYCLE_S - RAIN_DURATION_S
}

// The cloud arrives before collection starts and leaves after it stops.
export function rainCloudPass(seconds: number): { visible: boolean; progress: number; scale: number } {
  const start = RAIN_CYCLE_S - RAIN_DURATION_S - RAIN_CLOUD_TRANSITION_S
  const age = (Math.max(0, seconds) - start + RAIN_CYCLE_S) % RAIN_CYCLE_S
  const duration = RAIN_DURATION_S + 2 * RAIN_CLOUD_TRANSITION_S
  const visible = seconds >= start && age < duration
  const edge = Math.max(0, Math.min(1, age / RAIN_CLOUD_TRANSITION_S, (duration - age) / RAIN_CLOUD_TRANSITION_S))
  return { visible, progress: age / duration, scale: edge * edge * (3 - 2 * edge) }
}
