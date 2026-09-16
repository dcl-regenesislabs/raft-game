import { serializeExpansionSession, hydrateExpansionSession } from '../expansion/runtime'
import { serializeProgress, hydrateProgress, ProgressSnapshot } from '../progression/state'
import { serializeTutorial, hydrateTutorial, TutorialAction } from '../ui/tutorialState'
// SaveBlob — the JSON payload shipped to/from the server's
// Storage.player. The shape is purely client-managed; the server treats
// it as an opaque string. The `version` field gates future migrations:
// when the shape changes incompatibly, bump the constant and branch on
// the read side. Forward-compat reads accept the current version only;
// older blobs are dropped on load with a warning.

import { getPlayTimeS, setPlayTimeS } from '../systems/playTimer'
import {
  hydrateInventoryCounts,
  refreshHeldForSelectedSlot,
  hydrateSelectedSlot,
  serializeInventoryCounts,
  serializeSelectedSlot
} from '../ui/inventoryState'
import {
  hydrateInventoryDurabilities,
  hydrateInventoryLayout,
  serializeInventoryDurabilities,
  serializeInventoryLayout
} from '../ui/items'
import {
  hydrateLearnedRecipes,
  serializeLearnedRecipes
} from '../ui/learnedRecipes'
import {
  hydratePlayerPosition,
  serializePlayerPosition,
  type PositionSnapshot
} from '../ui/playerPosition'
import {
  hydrateRaft,
  serializeRaft,
  type PlatformSnapshot
} from '../ui/raftSnapshot'
import {
  hydrateVitals,
  serializeVitals,
  type VitalsSnapshot
} from '../ui/statsBars'

export const SAVE_BLOB_VERSION = 1

export interface SaveBlob {
  version: number
  savedAtMs: number
  inventory: {
    layout: string[]
    counts: Array<{ id: string; count: number }>
    selected: number
    // Per-slot remaining tool uses, parallel to `layout`. Optional so
    // saves written before the durability system existed still load —
    // the hydrate path seeds full durability for every tool in that
    // case (friendlier than surprise-broken tools on the next play).
    durabilities?: number[]
  }
  recipes: string[]
  vitals: VitalsSnapshot
  raft: PlatformSnapshot[]
  position?: PositionSnapshot
  playTimeS?: number
  expansion?: ReturnType<typeof serializeExpansionSession>
  progression?: ProgressSnapshot
  tutorial?: TutorialAction[]
}

export function buildSaveBlob(): SaveBlob {
  const position = serializePlayerPosition()
  return {
    version: SAVE_BLOB_VERSION,
    savedAtMs: Date.now(),
    inventory: {
      layout: serializeInventoryLayout(),
      counts: serializeInventoryCounts(),
      selected: serializeSelectedSlot(),
      durabilities: serializeInventoryDurabilities()
    },
    recipes: serializeLearnedRecipes(),
    vitals: serializeVitals(),
    raft: serializeRaft(),
    playTimeS: getPlayTimeS(),
    progression: serializeProgress(),
    expansion: serializeExpansionSession(),
    tutorial: serializeTutorial(),
    ...(position !== null ? { position } : {})
  }
}

// Apply a previously-saved blob in place. Order matters: the layout
// must hydrate before counts (counts assume the slot exists) and the
// raft must hydrate after the player inventory (otherwise a chest pickup
// would target an item id the layout doesn't yet know about).
export function applySaveBlob(blob: SaveBlob): void {
  if (blob.progression) hydrateProgress(blob.progression)
  if (blob.tutorial) hydrateTutorial(blob.tutorial)
  hydrateInventoryLayout(blob.inventory.layout)
  // Durabilities are parallel to the layout — hydrate them immediately
  // after the layout so each slot's tool-uses match the saved state
  // before any other system can read them. Older saves omit the field;
  // `hydrateInventoryLayout` has already seeded full durability for
  // every restored tool, so skipping this call is the right fallback.
  if (blob.inventory.durabilities !== undefined) {
    hydrateInventoryDurabilities(blob.inventory.durabilities)
  }
  hydrateInventoryCounts(blob.inventory.counts)
  hydrateSelectedSlot(blob.inventory.selected)
  hydrateLearnedRecipes(blob.recipes)
  hydrateVitals(blob.vitals)
  if (blob.expansion) hydrateExpansionSession(blob.expansion)
  hydrateRaft(blob.raft)
  setPlayTimeS(blob.playTimeS ?? 0)
  refreshHeldForSelectedSlot()
  if (blob.position !== undefined) hydratePlayerPosition(blob.position)
}

// Light validation — the server stores raw strings, so the client must
// be defensive on read. Returns the parsed blob or null if it doesn't
// match the expected shape / version.
export function parseSaveBlob(raw: string): SaveBlob | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const v = value as Partial<SaveBlob>
  if (v.version !== SAVE_BLOB_VERSION) return null
  if (typeof v.savedAtMs !== 'number') return null
  if (typeof v.inventory !== 'object' || v.inventory === null) return null
  if (!Array.isArray(v.inventory.layout)) return null
  if (!Array.isArray(v.inventory.counts)) return null
  if (typeof v.inventory.selected !== 'number') return null
  if (
    v.inventory.durabilities !== undefined &&
    !Array.isArray(v.inventory.durabilities)
  ) {
    // Tolerate a malformed durability field rather than dropping the
    // whole save — strip it and let the seed-on-hydrate fallback
    // restore every tool to full durability.
    v.inventory.durabilities = undefined
  }
  if (!Array.isArray(v.recipes)) return null
  if (typeof v.vitals !== 'object' || v.vitals === null) return null
  if (!Array.isArray(v.raft)) return null
  if (v.position !== undefined) {
    const p = v.position
    if (
      typeof p !== 'object' ||
      p === null ||
      typeof p.x !== 'number' ||
      typeof p.y !== 'number' ||
      typeof p.z !== 'number'
    ) {
      v.position = undefined
    }
  }
  if (v.playTimeS !== undefined && typeof v.playTimeS !== 'number') {
    v.playTimeS = undefined
  }
  if (v.tutorial !== undefined && !Array.isArray(v.tutorial)) v.tutorial = undefined
  if (v.expansion !== undefined && (typeof v.expansion !== 'object' || v.expansion === null)) v.expansion = undefined
  return v as SaveBlob
}
