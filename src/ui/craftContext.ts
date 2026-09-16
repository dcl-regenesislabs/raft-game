import { Entity, engine, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { ExpansionState, PlatformConstruction } from '../components'

let station: Entity | null = null
export function setCraftStation(entity: Entity | null): void {
  station = entity
}
export function getCraftStation(): Entity | null {
  return station
}
export function getCraftContextKind(): string | null {
  return station === null ? null : (PlatformConstruction.getOrNull(station)?.kind ?? 'unavailable')
}
export function isCraftStationAvailable(): boolean {
  if (station === null) return true
  const pc = PlatformConstruction.getOrNull(station)
  const player = Transform.getOrNull(engine.PlayerEntity)
  const target = Transform.getOrNull(station)
  if (!pc || !player || !target || Vector3.distance(player.position, target.position) > 5) return false
  return pc.kind !== 'researchTable' || !!ExpansionState.getOrNull(station)?.installed
}
export function recipeMatchesContext(requiredStation?: string): boolean {
  return (requiredStation ?? null) === getCraftContextKind() && isCraftStationAvailable()
}
