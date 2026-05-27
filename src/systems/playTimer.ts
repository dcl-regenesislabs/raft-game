import { isStartupGateActive } from '../ui/startupGate'

let playTimeS = 0
let running = false

export function getPlayTimeS(): number {
  return playTimeS
}

export function setPlayTimeS(seconds: number): void {
  playTimeS = seconds
}

export function startPlayTimer(): void {
  running = true
}

export function stopPlayTimer(): void {
  running = false
}

export function resetPlayTimer(): void {
  playTimeS = 0
  running = false
}

export function playTimerSystem(dt: number): void {
  if (!running || isStartupGateActive()) return
  playTimeS += dt
}
