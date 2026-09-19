import { MULTIPLAYER_MAX_WORLD_BYTES } from '../config/gameConfig'
import { WorldState, WORLD_VERSION } from './types'
import { freshWorld, freshPlayer } from './world'
import { checksum } from './transport'
import { getCatalogItem } from '../ui/items'

export type ReadResult = { kind: 'missing' } | { kind: 'found'; value: unknown }
export interface DurableStorage {
  read(key: string): Promise<ReadResult>
  write(key: string, value: unknown): Promise<boolean>
  remove(key: string): Promise<boolean>
}
const PART_SIZE = 48000
export type Manifest = {
  version: number
  commit: string
  generation: number
  revision: number
  chunks: string[]
  hash: string
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function shape(value: unknown, template: unknown, path: string): void {
  if (template === null) return
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) throw new Error('Invalid ' + path)
    return
  }
  if (record(template)) {
    if (!record(value)) throw new Error('Invalid ' + path)
    for (const [key, expected] of Object.entries(template)) shape(value[key], expected, path + '.' + key)
  } else if (typeof value !== typeof template || (typeof value === 'number' && !Number.isFinite(value)))
    throw new Error('Invalid ' + path)
}
export function validateWorld(value: unknown): WorldState {
  const baseline = freshWorld()
  shape(value, { ...baseline, tiles: {}, debris: {}, enemies: {}, players: {} }, 'world')
  const w = value as WorldState
  if (
    w.version !== WORLD_VERSION ||
    !Number.isSafeInteger(w.generation) ||
    w.generation < 1 ||
    !Number.isSafeInteger(w.revision) ||
    w.revision < 0 ||
    !w.tiles['0,0']
  )
    throw new Error('Incompatible or incomplete world')
  const slotCheck = (slots: unknown) => {
    if (!Array.isArray(slots) || slots.length > 25) throw new Error('Invalid inventory')
    for (const s of slots)
      if (
        !record(s) ||
        typeof s.id !== 'string' ||
        (s.id && !getCatalogItem(s.id)) ||
        !Number.isSafeInteger(s.count) ||
        (s.count as number) < 0 ||
        (s.count as number) > 99 ||
        typeof s.durability !== 'number' ||
        !Number.isFinite(s.durability) ||
        s.durability < 0 ||
        !!s.id !== (s.count as number) > 0
      )
        throw new Error('Invalid inventory slot')
  }
  const strings = (v: unknown) => {
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error('Invalid string list')
  }
  strings(w.progress.events)
  strings(w.progress.recipes)
  strings(w.events.chefClaimed)
  for (const t of Object.values(w.tiles)) {
    shape(t, baseline.tiles['0,0'], 'tile')
    if (!Number.isInteger(t.x) || !Number.isInteger(t.z) || t.id !== `${t.x},${t.z}` || w.tiles[t.id] !== t)
      throw new Error('Invalid tile')
    if (t.instance !== undefined && (!Number.isSafeInteger(t.instance) || t.instance < 0))
      throw new Error('Invalid object identity')
    if (t.device !== null) {
      const d = t.device
      if (!record(d) || !getCatalogItem(d.kind)) throw new Error('Invalid device')
      for (const key of [
        'yawDeg',
        'health',
        'maxHealth',
        'fuel',
        'progress',
        'stock',
        'queued',
        'ammo',
        'saltAmount',
        'freshAmount',
        'cookElapsed',
        'cookStatus'
      ] as const)
        if (typeof d[key] !== 'number' || !Number.isFinite(d[key]) || d[key] < 0)
          throw new Error('Invalid device state')
      if (typeof d.active !== 'boolean' || typeof d.installed !== 'boolean' || typeof d.recipeId !== 'string')
        throw new Error('Invalid device state')
      slotCheck(d.contents)
    }
  }
  for (const [address, p] of Object.entries(w.players)) {
    if (!/^0x[0-9a-f]{40}$/.test(address) || p.address !== address) throw new Error('Invalid player identity')
    shape(p, freshPlayer(address), 'player')
    if (
      p.slots.length !== 25 ||
      p.life < 0 ||
      p.life > 1 ||
      p.hunger < 0 ||
      p.hunger > 2 ||
      p.thirst < 0 ||
      p.thirst > 1
    )
      throw new Error('Invalid player state')
    if (
      p.retiredSessionBefore !== undefined &&
      (!Number.isSafeInteger(p.retiredSessionBefore) || p.retiredSessionBefore < 0)
    )
      throw new Error('Invalid retired session boundary')
    slotCheck(p.slots)
    for (const [id, s] of Object.entries(p.sessions))
      if (
        !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
        !Number.isSafeInteger(s.sequence) ||
        typeof s.ok !== 'boolean' ||
        typeof s.error !== 'string'
      )
        throw new Error('Invalid session')
    if (p.fishing) shape(p.fishing, { readyAt: 0, expiresAt: 0, slot: 0 }, 'fishing')
  }
  for (const [id, d] of Object.entries(w.debris)) {
    shape(
      d,
      { id: '', kind: '', position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, remaining: 0 },
      'debris'
    )
    if (id !== d.id || !['wood', 'barrel', 'plastic', 'plants', 'metal'].includes(d.kind))
      throw new Error('Invalid debris')
  }
  for (const [id, e] of Object.entries(w.enemies)) {
    shape(
      e,
      {
        id: '',
        kind: '',
        position: { x: 0, y: 0, z: 0 },
        hp: 0,
        cooldown: 0,
        slow: 0,
        boarding: false,
        shots: 0,
        target: ''
      },
      'enemy'
    )
    if (id !== e.id || !['shark', 'zombie', 'pirate', 'beast'].includes(e.kind)) throw new Error('Invalid enemy')
  }
  if (
    !Number.isSafeInteger(w.nextId) ||
    w.nextId < 1 ||
    !Number.isSafeInteger(w.seed) ||
    w.seed < 0 ||
    !Number.isInteger(w.progress.wins) ||
    w.progress.wins < 0 ||
    w.progress.wins > 3 ||
    !Number.isInteger(w.events.heading) ||
    w.events.heading < 0 ||
    w.events.heading > 2 ||
    !Number.isInteger(w.events.finaleGroup) ||
    w.events.finaleGroup < -1 ||
    w.events.finaleGroup > 2
  )
    throw new Error('Invalid simulation state')
  for (const values of [w.progress.pending, w.progress.metrics])
    for (const n of Object.values(values))
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new Error('Invalid progression counters')
  for (const n of w.progress.milestones)
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new Error('Invalid milestone')
  if (w.tiles['0,0'].device !== null) throw new Error('Recovery platform is obstructed')
  slotCheck(w.events.islandLoot)
  if (w.events.islandPosition) shape(w.events.islandPosition, { x: 0, y: 0, z: 0 }, 'island')
  return w
}
export class WorldRepository {
  private manifest: Manifest | null = null
  private obsolete: string[][] = []
  constructor(
    private storage: DurableStorage,
    private writer: string,
    private namespace = 'cooperative:v1'
  ) {}
  async load(): Promise<WorldState | null> {
    const root = await this.storage.read(this.namespace + ':manifest')
    if (root.kind === 'missing') return null
    const m = root.value as Manifest
    if (
      !m ||
      m.version !== WORLD_VERSION ||
      typeof m.commit !== 'string' ||
      typeof m.hash !== 'string' ||
      !Array.isArray(m.chunks) ||
      !m.chunks.length ||
      m.chunks.length > 100 ||
      m.chunks.some((k) => typeof k !== 'string' || !k.startsWith(this.namespace + ':chunk:'))
    )
      throw new Error('Invalid world manifest')
    let raw = ''
    for (const key of m.chunks) {
      const part = await this.storage.read(key)
      if (part.kind !== 'found' || typeof part.value !== 'string') throw new Error('Missing committed world chunk')
      raw += part.value
      if (raw.length > MULTIPLAYER_MAX_WORLD_BYTES) throw new Error('World exceeds storage budget')
    }
    if (checksum(raw) !== m.hash) throw new Error('World checksum mismatch')
    const world = validateWorld(JSON.parse(raw))
    if (world.revision !== m.revision || world.generation !== m.generation)
      throw new Error('World manifest revision mismatch')
    this.manifest = m
    return world
  }
  async commit(world: WorldState): Promise<void> {
    const raw = JSON.stringify(world)
    if (raw.length * 2 > MULTIPLAYER_MAX_WORLD_BYTES) throw new Error('World storage capacity reached')
    const hash = checksum(raw)
    const commit = `${this.writer}:${world.generation}:${world.revision}:${hash}`
    const chunks = Array.from(
      { length: Math.ceil(raw.length / PART_SIZE) },
      (_, i) => `${this.namespace}:chunk:${commit}:${i}`
    )
    // Checking ownership detects an unexpected second writer; host deployment must still provide exclusive ownership.
    const current = await this.storage.read(this.namespace + ':manifest')
    const existing = current.kind === 'found' ? (current.value as Manifest) : null
    if (existing?.commit === commit) {
      this.manifest = existing
      return
    }
    if (existing?.commit !== this.manifest?.commit) throw new Error('Another server changed the world; writer stopped')
    for (let i = 0; i < chunks.length; i++)
      if (!(await this.storage.write(chunks[i], raw.slice(i * PART_SIZE, (i + 1) * PART_SIZE))))
        throw new Error('World chunk write pending')
    const next: Manifest = {
      version: WORLD_VERSION,
      commit,
      generation: world.generation,
      revision: world.revision,
      chunks,
      hash
    }
    if (!(await this.storage.write(this.namespace + ':manifest', next))) {
      const check = await this.storage.read(this.namespace + ':manifest')
      if (check.kind !== 'found' || (check.value as Manifest).commit !== commit) throw new Error('World commit pending')
    }
    if (this.manifest) this.obsolete.push(this.manifest.chunks)
    this.manifest = next
    // Retain two previous commits for diagnosis. Never silently roll back to them.
    if (this.obsolete.length > 2)
      for (const key of this.obsolete.shift()!) await this.storage.remove(key).catch(() => false)
  }
}
