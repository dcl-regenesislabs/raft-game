const starter = ['rope', 'hook', 'hammer', 'cup', 'purifier', 'grill', 'spear', 'fishingRod']
const home = ['workbench', 'storage', 'smelter', 'metalPlate', 'cropBed', 'rainCollector']
const defense = [
  'nails',
  'waterTank',
  'improvedGrill',
  'metalHook',
  'salvageAxe',
  'armoryBench',
  'bow',
  'arrows',
  'wall',
  'gate',
  'railing',
  'ropeBarricade',
  'spikeStrip',
  'alarmBell'
]
const engineering = [
  'wire',
  'gears',
  'engineeringBench',
  'ballista',
  'bolts',
  'ammoCrate',
  'lookoutPost',
  'sail',
  'steeringWheel',
  'engine',
  'anchor',
  'stairs',
  'upperFloor',
  'towerPlatform'
]
const advanced = [
  'researchTable',
  'netLauncher',
  'nets',
  'harpoonTower',
  'harpoons',
  'deckCannon',
  'cannonballs',
  'boardingShield',
  'scrapArmor',
  'armoredFoundation',
  'generator',
  'batteryBank',
  'powerRelay',
  'antennaMast',
  'rescueRadio',
  'circuitBoard'
]
// Items each chapter unlocks, in chapter order (index 0 = chapter 1).
export const CHAPTER_ITEMS: readonly (readonly string[])[] = [starter, home, defense, engineering, advanced, ['transmitterCore']]
export function requiredChapter(id: string): number {
  const index = CHAPTER_ITEMS.findIndex((items) => items.includes(id))
  return index < 0 ? Infinity : index + 1
}

export function recipeAvailable(stage: number, events: readonly string[], id: string): boolean {
  if (id === 'transmitterCore' || stage < requiredChapter(id)) return false
  if (stage > 1 || id === 'rope' || id === 'hook') return true
  if (id === 'hammer') return events.includes('rope')
  if (id === 'purifier' || id === 'cup') return events.includes('expand')
  if (id === 'grill' || id === 'fishingRod') return events.includes('drink')
  return events.includes('cookedMeal')
}
