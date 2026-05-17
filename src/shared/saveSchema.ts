// SaveBlob — the JSON payload shipped to/from the server's
// Storage.player. The shape is purely client-managed; the server treats
// it as an opaque string. The `version` field gates future migrations:
// when the shape changes incompatibly, bump the constant and branch on
// the read side. Forward-compat reads accept the current version only;
// older blobs are dropped on load with a warning.

import {
  setHeldCup,
  setHeldFood,
  setHeldItem,
  type HeldItemKind
} from '../factories/heldItem'
import {
  hydrateInventoryCounts,
  hydrateSelectedSlot,
  serializeInventoryCounts,
  serializeSelectedSlot
} from '../ui/inventoryState'
import {
  getInventorySlot,
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
import type { SceneMode } from '../runtime/sceneMode'

export const SAVE_BLOB_VERSION = 1

export interface SaveBlob {
  version: number
  mode: SceneMode
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
  // Optional so saves written before this field was added still load.
  // The `version` constant doesn't need to bump for purely-additive
  // fields; missing position just means "leave the player where they are".
  position?: PositionSnapshot
}

export function buildSaveBlob(mode: SceneMode): SaveBlob {
  const position = serializePlayerPosition()
  return {
    version: SAVE_BLOB_VERSION,
    mode,
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
    ...(position !== null ? { position } : {})
  }
}

// Apply a previously-saved blob in place. Order matters: the layout
// must hydrate before counts (counts assume the slot exists) and the
// raft must hydrate after the player inventory (otherwise a chest pickup
// would target an item id the layout doesn't yet know about).
export function applySaveBlob(blob: SaveBlob): void {
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
  hydrateRaft(blob.raft)
  refreshHeldItemFromSelection(blob.inventory.selected)
  if (blob.position !== undefined) hydratePlayerPosition(blob.position)
}

// After hydrating the layout + selection, the held viewmodel is still
// whatever the player had equipped before load. Re-equip the slot the
// blob restored so the camera sprite/GLB matches the inventory bar.
function refreshHeldItemFromSelection(selectedIndex: number): void {
  const def = getInventorySlot(selectedIndex)
  if (def === null) {
    setHeldItem('hook')
    return
  }
  if (def.heldKind === 'cup') {
    setHeldCup(def.id, def.texture)
    return
  }
  if (def.consumable) {
    setHeldFood(def.id, def.texture, def.glb)
    return
  }
  if (def.heldKind !== null) {
    setHeldItem(def.heldKind as HeldItemKind)
    return
  }
  setHeldItem('hook')
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
  if (typeof v.mode !== 'string') return null
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
      // Tolerate a malformed position field rather than dropping the
      // whole save — strip it and keep the rest.
      v.position = undefined
    }
  }
  return v as SaveBlob
}
