import { DurableStorage, WorldRepository } from '../multiplayer/persistence'
import { Release, handoffKey, releaseNamespace, readReleaseDescriptor } from '../multiplayer/releases'
import { freshWorld } from '../multiplayer/world'
import { WorldState } from '../multiplayer/types'

// Every deployed build owns a different manifest namespace. Retired versions may
// finish an old write, but cannot overwrite the replacement authority's state.
export async function inheritReleaseWorld(
  storage: DurableStorage,
  release: Release,
  allowBackupFallback: boolean,
  predecessor: (hash: string) => Promise<Release> = readReleaseDescriptor
): Promise<{ waiting: boolean; world: WorldState | null }> {
  if (release.id === 'dev') return { waiting: false, world: null }
  let cursor = release
  let namespace = releaseNamespace(cursor.previous)
  let manifest = await storage.read(namespace + ':manifest')
  // A deployment with no visitors has no checkpoint. Follow immutable release descriptors
  // back to the most recent running world, rather than mistaking that for a new game.
  for (let depth = 0; manifest.kind === 'missing'; depth++) {
    if (cursor.previous === 'legacy') return { waiting: false, world: null }
    if (depth >= 32 || !cursor.previousDescriptor) throw Error('Cannot locate predecessor world safely')
    const prior = await predecessor(cursor.previousDescriptor)
    if (prior.id !== cursor.previous || prior.sequence >= cursor.sequence) throw Error('Invalid predecessor chain')
    cursor = prior
    namespace = releaseNamespace(cursor.previous)
    manifest = await storage.read(namespace + ':manifest')
  }
  const raw = manifest.value as { generation?: number; revision?: number }
  if (
    !raw ||
    !Number.isSafeInteger(raw.generation) ||
    raw.generation! < 1 ||
    !Number.isSafeInteger(raw.revision) ||
    raw.revision! < 0
  )
    throw Error('Invalid predecessor manifest')
  if (cursor.previous !== 'legacy' && !allowBackupFallback) {
    const ack = await storage.read(handoffKey(cursor.previous, release.id))
    const value = ack.kind === 'found' ? (ack.value as { from?: string; to?: string; revision?: number }) : null
    if (!value || value.from !== cursor.previous || value.to !== release.id || value.revision !== raw.revision)
      return { waiting: true, world: null }
  }
  if (release.compatibility !== cursor.previousCompatibility) {
    const world = freshWorld(raw.generation! + 1)
    world.revision = raw.revision! + 1
    return { waiting: false, world }
  }
  const world = await new WorldRepository(storage, 'inherit-read-only', namespace).load()
  return { waiting: false, world }
}
