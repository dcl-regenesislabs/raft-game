// Save-system snapshot of the player-built raft: every non-main platform
// plus whatever construction (grill / purifier / storage) sits on it,
// including chest contents. The main platform is implicit (always
// re-created at scene boot) so it is never serialized.
//
// On hydrate we destroy every existing non-main platform and recreate
// each one from the snapshot. This keeps the apply path symmetric with
// `playAgain()` (which already calls destroyNonMainPlatforms) and avoids
// the bookkeeping headache of trying to reconcile in place.

import { Entity, engine } from '@dcl/sdk/ecs'

import {
  MainPlatform,
  Platform,
  PlatformConstruction,
  STORAGE_SLOT_COUNT,
  StorageContents
} from '../components'
import {
  ConstructionKind,
  createConstruction
} from '../factories/construction'
import {
  createPlatform,
  destroyPlatformEntity,
  gridCellToWorld
} from '../factories/platform'

export interface ChestSlotSnapshot {
  id: string
  count: number
}

export interface ConstructionSnapshot {
  kind: ConstructionKind
  yawDeg: number
  // Present only when kind === 'storage'. Length is normalized to
  // STORAGE_SLOT_COUNT on serialize so the hydrate path can stop
  // null-guarding length for every read.
  contents?: ChestSlotSnapshot[]
}

export interface PlatformSnapshot {
  gridX: number
  gridZ: number
  construction: ConstructionSnapshot | null
}

const VALID_KINDS: ReadonlySet<string> = new Set(['grill', 'purifier', 'storage'])

export function serializeRaft(): PlatformSnapshot[] {
  const out: PlatformSnapshot[] = []
  for (const [entity, platform] of engine.getEntitiesWith(Platform)) {
    if (MainPlatform.getOrNull(entity) !== null) continue
    out.push({
      gridX: platform.gridX,
      gridZ: platform.gridZ,
      construction: snapshotConstruction(entity)
    })
  }
  return out
}

function snapshotConstruction(entity: Entity): ConstructionSnapshot | null {
  const c = PlatformConstruction.getOrNull(entity)
  if (c === null) return null
  if (!VALID_KINDS.has(c.kind)) return null
  const snapshot: ConstructionSnapshot = {
    kind: c.kind as ConstructionKind,
    yawDeg: c.yawDeg
  }
  if (c.kind === 'storage') {
    const contents = StorageContents.getOrNull(entity)
    snapshot.contents = []
    if (contents !== null) {
      for (let i = 0; i < STORAGE_SLOT_COUNT; i++) {
        const slot = contents.slots[i]
        if (slot === undefined) {
          snapshot.contents.push({ id: '', count: 0 })
        } else {
          snapshot.contents.push({ id: slot.id, count: slot.count })
        }
      }
    } else {
      for (let i = 0; i < STORAGE_SLOT_COUNT; i++) {
        snapshot.contents.push({ id: '', count: 0 })
      }
    }
  }
  return snapshot
}

export function hydrateRaft(snapshots: ReadonlyArray<PlatformSnapshot>): void {
  destroyNonMainPlatforms()
  const placed = new Set<string>()
  for (const snap of snapshots) {
    const key = `${snap.gridX},${snap.gridZ}`
    // Guard against accidentally placing two platforms on the same
    // grid cell — only the first wins. The main platform at (0,0) is
    // pre-marked so a saved entry there is skipped.
    if (placed.has(key)) continue
    if (snap.gridX === 0 && snap.gridZ === 0) continue
    placed.add(key)
    const platform = createPlatform(
      gridCellToWorld(snap.gridX, snap.gridZ),
      { gridX: snap.gridX, gridZ: snap.gridZ }
    )
    const construction = snap.construction
    if (construction === null) continue
    if (!VALID_KINDS.has(construction.kind)) continue
    createConstruction(platform, construction.kind, construction.yawDeg)
    if (construction.kind === 'storage' && construction.contents !== undefined) {
      restoreStorageContents(platform, construction.contents)
    }
  }
}

function restoreStorageContents(
  entity: Entity,
  contents: ReadonlyArray<ChestSlotSnapshot>
): void {
  const mut = StorageContents.getMutable(entity)
  for (let i = 0; i < mut.slots.length; i++) {
    const saved = contents[i]
    if (saved === undefined) {
      mut.slots[i] = { id: '', count: 0 }
      continue
    }
    mut.slots[i] = { id: saved.id, count: saved.count }
  }
}

function destroyNonMainPlatforms(): void {
  // Snapshot first; destroyPlatformEntity removes the entity which would
  // invalidate the iterator if we deleted while looping.
  const victims: Entity[] = []
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    if (MainPlatform.getOrNull(entity) !== null) continue
    victims.push(entity)
  }
  for (const entity of victims) destroyPlatformEntity(entity)
}
