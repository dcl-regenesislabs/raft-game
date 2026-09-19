import type { Entity } from '@dcl/sdk/ecs'
const ids = new Map<Entity, string>()
export function worldEntityId(entity: Entity | null): string {
  return entity === null ? '' : (ids.get(entity) ?? '')
}
export function identifyWorldEntity(entity: Entity, id: string): void {
  ids.set(entity, id)
}
export function forgetWorldEntity(entity: Entity): void {
  const id = ids.get(entity)
  for (const [key, value] of ids) if (value === id) ids.delete(key)
}
