import { Delta, PublicWorld, Snapshot } from './types'

// JSON escaping and UTF-8 can expand a UTF-16 unit by up to six bytes.
// 1,500 units leave ample room for binary message headers below the 13 KB transport ceiling.
export const CHUNK_UNITS = 1500
export const MAX_CHUNKS = 3000
export function checksum(text: string): string {
  let n = 2166136261
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619)
  return (n >>> 0).toString(16)
}
export type Chunk = { id: string; index: number; total: number; hash: string; body: string }
export function splitMessage(id: string, value: unknown): Chunk[] {
  const raw = JSON.stringify(value)
  const total = Math.ceil(raw.length / CHUNK_UNITS)
  if (total > MAX_CHUNKS) throw new Error('Snapshot exceeds transfer budget')
  const hash = checksum(raw)
  return Array.from({ length: total }, (_, index) => ({
    id,
    index,
    total,
    hash,
    body: raw.slice(index * CHUNK_UNITS, (index + 1) * CHUNK_UNITS)
  }))
}
export class Assembler {
  private transfers = new Map<string, { total: number; hash: string; parts: Map<number, string>; at: number }>()
  accept(chunk: Chunk, now: number): unknown | null {
    for (const [id, pending] of this.transfers) if (now - pending.at > 15000) this.transfers.delete(id)
    if (
      !Number.isInteger(chunk.total) ||
      chunk.total < 1 ||
      chunk.total > MAX_CHUNKS ||
      !Number.isInteger(chunk.index) ||
      chunk.index < 0 ||
      chunk.index >= chunk.total ||
      chunk.body.length > CHUNK_UNITS ||
      chunk.id.length > 120
    )
      throw new Error('Invalid chunk')
    let transfer = this.transfers.get(chunk.id)
    if (!transfer) {
      if (this.transfers.size >= 4) this.transfers.delete(this.transfers.keys().next().value!)
      transfer = { total: chunk.total, hash: chunk.hash, parts: new Map(), at: now }
      this.transfers.set(chunk.id, transfer)
    }
    if (transfer.hash !== chunk.hash || transfer.total !== chunk.total) throw new Error('Conflicting chunks')
    const previous = transfer.parts.get(chunk.index)
    if (previous !== undefined && previous !== chunk.body) throw new Error('Conflicting duplicate chunk')
    transfer.at = now
    transfer.parts.set(chunk.index, chunk.body)
    if (transfer.parts.size !== transfer.total) return null
    const raw = Array.from({ length: transfer.total }, (_, i) => transfer!.parts.get(i)!).join('')
    this.transfers.delete(chunk.id)
    if (checksum(raw) !== transfer.hash) throw new Error('Snapshot checksum mismatch')
    return JSON.parse(raw)
  }
  clear(): void {
    this.transfers.clear()
  }
}
function changes<T>(before: Record<string, T>, after: Record<string, T>): Record<string, T | null> {
  const result: Record<string, T | null> = {}
  for (const key of Object.keys(before)) if (!(key in after)) result[key] = null
  for (const [key, value] of Object.entries(after))
    if (JSON.stringify(value) !== JSON.stringify(before[key])) result[key] = value
  return result
}
export function makeDelta(before: PublicWorld, after: Snapshot): Delta {
  const w = after.world
  return {
    base: before.revision,
    revision: w.revision,
    generation: w.generation,
    tiles: changes(before.tiles, w.tiles),
    debris: changes(before.debris, w.debris),
    enemies: changes(before.enemies, w.enemies),
    progress: w.progress,
    events: w.events,
    seed: w.seed,
    nextId: w.nextId,
    player: after.player,
    session: after.session
  }
}
export function applyDelta(snapshot: Snapshot, delta: Delta): Snapshot {
  if (
    snapshot.world.generation !== delta.generation ||
    snapshot.world.revision !== delta.base ||
    delta.revision <= delta.base ||
    snapshot.session !== delta.session
  )
    throw new Error('Revision gap')
  // Preserve unchanged records so renderers can skip them without rebuilding or deep comparison.
  const next: Snapshot = {
    world: {
      ...snapshot.world,
      tiles: { ...snapshot.world.tiles },
      debris: { ...snapshot.world.debris },
      enemies: { ...snapshot.world.enemies }
    },
    player: delta.player,
    session: snapshot.session
  }
  for (const key of ['tiles', 'debris', 'enemies'] as const) {
    const records = next.world[key] as Record<string, unknown>
    for (const [id, value] of Object.entries(delta[key])) {
      if (value === null) delete records[id]
      else records[id] = value
    }
  }
  next.world.revision = delta.revision
  next.world.progress = delta.progress
  next.world.events = delta.events
  next.world.seed = delta.seed
  next.world.nextId = delta.nextId
  next.player = delta.player
  return next
}
