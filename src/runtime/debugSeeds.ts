// Optional seed pack. Pre-fills the player inventory with the crafted
// tools and spawns the 8-platform ring around the main raft (grill
// east, purifier west, fully-stocked storage chest north). Wired to
// the NEW GAME - DEBUG button on the lobby information panel, which
// is shown when `DEBUG_MODE` is true in `config/gameConfig.ts` —
// independent of IS_PRODUCTION, so playtesters can keep it on in
// production builds and turn it off for a clean public release.
//
// Pulled out of `main()` so the regular NEW GAME path leaves the player
// with a genuinely clean state in dev too: only the main platform, an
// empty inventory, and default vitals.

import { Entity } from '@dcl/sdk/ecs'

import { STORAGE_MAX_STACK, StorageContents } from '../components'
import {
  createConstruction,
  createPlatform,
  gridCellToWorld
} from '../factories'
import { addCollected } from '../ui/inventoryState'

export function applyDebugSeeds(): void {
  seedDebugInventory()
  seedDebugWorld()
}

// Pre-seeds the inventory with TOOLS only. Materials, placeables, and
// cooking ingredients live in the debug storage chest spawned by
// `seedDebugWorld` (ring tile 0,1) — pulling them out is the easiest
// way to exercise the storage flow without grinding pickups.
function seedDebugInventory(): void {
  // Crafted tools the player keeps on-hand. Unique items — one of
  // each, not a durability stack. hammer/spear are non-stackable and
  // already reserved in the default bottom-bar layout, so seeding
  // them here would just allocate duplicate slots.
  addCollected('fishingRod', 1)
  // Containers are non-stackable — each instance gets its own slot, so
  // the seed only adds one of each variant. The cup goes in too so the
  // player can test the empty-cup → fill flow without crafting first.
  addCollected('cup', 1)
  addCollected('saltWater', 1)
  addCollected('freshWater', 1)
}

// Stuffs the pre-placed storage chest with everything the player would
// otherwise have to grind for: full material/placeable stacks plus one
// of each cooking ingredient. Indexed top-left, row-major across the
// 5x5 grid; the StorageContents component was created with 25 empty
// slots in `createConstruction`, so we just overwrite the entries we
// care about.
function seedDebugStorage(entity: Entity): void {
  const items: ReadonlyArray<{ id: string; count: number }> = [
    // Materials
    { id: 'wood', count: STORAGE_MAX_STACK },
    { id: 'plants', count: STORAGE_MAX_STACK },
    { id: 'plastic', count: STORAGE_MAX_STACK },
    { id: 'rope', count: STORAGE_MAX_STACK },
    { id: 'metal', count: STORAGE_MAX_STACK },
    // Crafted placeables / building pieces
    { id: 'grill', count: STORAGE_MAX_STACK },
    { id: 'purifier', count: STORAGE_MAX_STACK },
    { id: 'storage', count: STORAGE_MAX_STACK },
    // Cooking ingredients (the 14 sources documented in COOKING.md)
    { id: 'sardines', count: STORAGE_MAX_STACK },
    { id: 'mussels', count: STORAGE_MAX_STACK },
    { id: 'clams', count: STORAGE_MAX_STACK },
    { id: 'squid', count: STORAGE_MAX_STACK },
    { id: 'shark_meat', count: STORAGE_MAX_STACK },
    { id: 'seaweed', count: STORAGE_MAX_STACK },
    { id: 'tomatoes', count: STORAGE_MAX_STACK },
    { id: 'garlic', count: STORAGE_MAX_STACK },
    { id: 'sea_salt', count: STORAGE_MAX_STACK },
    { id: 'olive_oil', count: STORAGE_MAX_STACK },
    { id: 'potato', count: STORAGE_MAX_STACK },
    { id: 'crab', count: STORAGE_MAX_STACK },
    { id: 'spaghetti', count: STORAGE_MAX_STACK },
    { id: 'fettuccine', count: STORAGE_MAX_STACK }
  ]
  const c = StorageContents.getMutable(entity)
  for (let i = 0; i < items.length && i < c.slots.length; i++) {
    c.slots[i] = { id: items[i].id, count: items[i].count }
  }
}

// Spawns the 8 platforms surrounding the main raft (the king-move ring
// around grid cell (0, 0)) and pre-places a grill on the east tile and
// a water purifier on the west tile so cooking / purification flows can
// be exercised without crafting first.
function seedDebugWorld(): void {
  const ringOffsets: ReadonlyArray<readonly [number, number]> = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1]
  ]
  for (const [gx, gz] of ringOffsets) {
    const platform = createPlatform(gridCellToWorld(gx, gz), {
      gridX: gx,
      gridZ: gz
    })
    if (gx === 1 && gz === 0) createConstruction(platform, 'grill', 90)
    else if (gx === -1 && gz === 0) createConstruction(platform, 'purifier', 90)
    else if (gx === 0 && gz === 1) {
      createConstruction(platform, 'storage', 180)
      seedDebugStorage(platform)
    }
  }
}
