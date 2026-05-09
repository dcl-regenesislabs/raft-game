// Catalog of items the player can craft. Each entry binds the recipe (which
// materials and how many) to the metadata the craft panel needs to display
// it: name, flavor description, and an icon texture.
//
// `materialId` strings must match keys in the material catalog (see
// `items.ts`), so the cost rows can resolve material textures and counts
// against the player's collected tally.

export interface MaterialCost {
  materialId: string
  amount: number
}

export interface CraftableItem {
  id: string
  name: string
  description: string
  texture: string
  cost: readonly MaterialCost[]
  // Optional per-item craft duration in seconds. When omitted the craft
  // session falls back to the default duration. Used to make foundational
  // build pieces craft faster than tools/utility items.
  craftSec?: number
}

export const CRAFTABLE_ITEMS: readonly CraftableItem[] = [
  {
    id: 'rope',
    name: 'ROPE',
    description:
      'Two handfuls of seaweed twisted into a length of rope. The backbone of every tool you\'ll build.',
    texture: 'images/hud/items/rope.png',
    cost: [
      { materialId: 'plants', amount: 2 }
    ],
    craftSec: 1
  },
  {
    id: 'hammer',
    name: 'HAMMER',
    description:
      'A sturdy building hammer for raising platforms and lashing your raft together.',
    texture: 'images/hud/items/hammer.png',
    cost: [
      { materialId: 'wood', amount: 4 },
      { materialId: 'rope', amount: 2 }
    ]
  },
  {
    id: 'platform',
    name: 'PLATFORM',
    description:
      'A wooden raft tile. Place it next to an existing platform to expand your raft.',
    texture: 'images/hud/items/raft_v2.png',
    cost: [
      { materialId: 'wood', amount: 2 },
      { materialId: 'plastic', amount: 2 },
      { materialId: 'rope', amount: 1 }
    ],
    craftSec: 1
  },
  {
    id: 'spear',
    name: 'WOODEN SPEAR',
    description:
      'A pointed wooden shaft for warding off circling sharks at close range.',
    texture: 'images/hud/items/spear.png',
    cost: [
      { materialId: 'wood', amount: 8 },
      { materialId: 'rope', amount: 3 }
    ]
  },
  {
    id: 'purifier',
    name: 'WATER PURIFIER',
    description:
      'Boils sea water through layers of rope-woven mesh and salvaged plastic to make it drinkable.',
    texture: 'images/hud/items/water-purifier.png',
    cost: [
      { materialId: 'wood', amount: 6 },
      { materialId: 'rope', amount: 5 },
      { materialId: 'plastic', amount: 4 },
      { materialId: 'metal', amount: 2 }
    ]
  },
  {
    id: 'grill',
    name: 'GRILL',
    description:
      'A scrap-metal cooking station. Char fish and meat into proper meals.',
    texture: 'images/hud/items/grill.png',
    cost: [
      { materialId: 'metal', amount: 3 },
      { materialId: 'wood', amount: 6 },
      { materialId: 'rope', amount: 3 }
    ]
  },
  {
    id: 'fishingRod',
    name: 'FISHING ROD',
    description:
      'A real rod with a long line. Casts further than the throw hook and pulls in larger fish.',
    texture: 'images/hud/items/fishing-rod.png',
    cost: [
      { materialId: 'wood', amount: 6 },
      { materialId: 'rope', amount: 8 }
    ]
  },
  {
    id: 'knife',
    name: 'KNIFE',
    description:
      'A honed metal blade for gutting fish, butchering meat, and cutting rope.',
    texture: 'images/hud/items/knife.png',
    cost: [
      { materialId: 'wood', amount: 2 },
      { materialId: 'metal', amount: 8 }
    ]
  },
  {
    id: 'cup',
    name: 'CUP',
    description:
      'A simple vessel carved from wood and lined with plastic. Holds water and other liquids.',
    texture: 'images/hud/items/cup.png',
    cost: [
      { materialId: 'wood', amount: 2 },
      { materialId: 'plastic', amount: 2 }
    ]
  },
  {
    id: 'storage',
    name: 'STORAGE',
    description:
      'A scrap-and-iron chest. Stash supplies on board so your inventory stays clear for tools and food.',
    texture: 'images/hud/items/storage.png',
    cost: [
      { materialId: 'wood', amount: 8 },
      { materialId: 'metal', amount: 4 },
      { materialId: 'rope', amount: 4 }
    ]
  }
]

export function getCraftableById(id: string): CraftableItem | null {
  return CRAFTABLE_ITEMS.find((c) => c.id === id) ?? null
}

// Set of every material id that appears as an input in any recipe. Used by
// the craft menu's filtered inventory view to show only items the player
// can actually spend on a craft (wood, rope, plastic, plants, metal at
// time of writing — coal is excluded because it's a cook byproduct, never
// a craft input).
const CRAFT_MATERIAL_IDS: ReadonlySet<string> = new Set(
  CRAFTABLE_ITEMS.flatMap((item) => item.cost.map((c) => c.materialId))
)

export function isCraftMaterial(itemId: string): boolean {
  return CRAFT_MATERIAL_IDS.has(itemId)
}
