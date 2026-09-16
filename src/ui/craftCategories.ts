import { recipeUnlocked } from '../progression/state'
import { getCraftContextKind } from './craftContext'
import { CRAFTABLE_ITEMS, type CraftableItem } from './craftableItems'

export const CRAFT_CATEGORIES = [
  { id: 'food-water', name: 'Food & Water' },
  { id: 'tools', name: 'Tools' },
  { id: 'weapons', name: 'Weapons & Gear' },
  { id: 'building', name: 'Building' },
  { id: 'stations', name: 'Storage & Stations' },
  { id: 'defenses', name: 'Defenses' },
  { id: 'resources', name: 'Resources' },
  { id: 'navigation', name: 'Navigation' },
  { id: 'power-radio', name: 'Power & Radio' }
] as const
export type CraftCategoryId = (typeof CRAFT_CATEGORIES)[number]['id']
export type CraftFilter = CraftCategoryId | 'investigation'

export function getContextCraftRecipes(): readonly CraftableItem[] {
  const context = getCraftContextKind()
  return CRAFTABLE_ITEMS.filter((item) => (item.station ?? null) === context && recipeUnlocked(item.id))
}

export function getCraftCategories(items: readonly CraftableItem[] = getContextCraftRecipes()) {
  return [
    { id: 'investigation' as CraftFilter, name: 'Investigation' },
    ...CRAFT_CATEGORIES.filter((category) => items.some((item) => item.category === category.id))
  ]
}

export function filterCraftRecipes(category: CraftFilter) {
  return getContextCraftRecipes().filter(
    (item) => item.category === category
  )
}

// A selection must always belong to the displayed results, including after a
// category or workplace changes.
export function resolveCraftSelection(items: readonly CraftableItem[], selected: string | null): string | null {
  return items.some((item) => item.id === selected) ? selected : (items[0]?.id ?? null)
}

export function getCraftCategoryIcon(id: CraftFilter): string {
  return 'images/hud/categories/' + id + '.png'
}
export const CRAFT_CATEGORY_ICONS = [
  getCraftCategoryIcon('investigation'),
  ...CRAFT_CATEGORIES.map((category) => getCraftCategoryIcon(category.id))
]
