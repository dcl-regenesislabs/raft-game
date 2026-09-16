import { buildSaveBlob, applySaveBlob, SaveBlob } from '../shared/saveSchema'
import { GRID_ORIGIN } from '../factories/platform'
import { isSandbox, serializeProgress, metric } from './state'
let checkpoint: SaveBlob | null = null
export const hasCheckpoint = () => checkpoint !== null
export function clearCheckpoint(): void { checkpoint = null }
export function captureCheckpoint(): void {
  if (isSandbox()) return
  const saved = buildSaveBlob()
  // A restored chapter always starts on the indestructible starter tile.
  saved.position = { x: GRID_ORIGIN.x, y: GRID_ORIGIN.y + 1, z: GRID_ORIGIN.z }
  checkpoint = JSON.parse(JSON.stringify(saved))
}
export function restoreCheckpoint(): boolean {
  if (!checkpoint) return false
  const attempts = serializeProgress().metrics
  applySaveBlob(JSON.parse(JSON.stringify(checkpoint)))
  // Attempt counters are telemetry, never restored inventory or rewards.
  const restored = serializeProgress().metrics
  for (const key of ['deaths', 'retries']) metric(key, Math.max(0, (attempts[key] ?? 0) - (restored[key] ?? 0)))
  return true
}
