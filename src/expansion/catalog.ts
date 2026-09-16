import { AUTO_WIRE_RANGE_M } from './power'
import type { CraftCategoryId } from '../ui/craftCategories'

export type ExpansionItem = {
  id: string
  name: string
  category: CraftCategoryId
  description: string
  cost: readonly { materialId: string; amount: number }[]
  kind: 'structure' | 'tool' | 'resource'
  station?: string
  health?: number
}
// Exact workplaces, not globally unlocked crafting. New specialties can add a
// station and assign recipes here without growing the basic menu.
export const CRAFT_STATION_NAMES: Record<string, string> = {
  workbench: 'Workbench',
  smelter: 'Smelter',
  armoryBench: 'Armory',
  engineeringBench: 'Engineering bench',
  researchTable: 'Research table'
}
const specialties: Record<string, string[]> = {
  workbench: [
    'rainCollector',
    'cropBed',
    'waterTank',
    'improvedGrill',
    'metalHook',
    'salvageAxe',
    'wall',
    'gate',
    'stairs',
    'upperFloor',
    'railing',
    'armoredFoundation',
    'towerPlatform',
    'ammoCrate',
    'smelter',
    'researchTable',
    'armoryBench',
    'engineeringBench',
    'nails',
    'gears',
    'wire'
  ],
  armoryBench: [
    'bow',
    'arrows',
    'boardingShield',
    'scrapArmor',
    'ropeBarricade',
    'spikeStrip',
    'netLauncher',
    'ballista',
    'harpoonTower',
    'deckCannon',
    'nets',
    'bolts',
    'harpoons',
    'cannonballs',
    'alarmBell'
  ],
  engineeringBench: ['lookoutPost', 'sail', 'steeringWheel', 'engine', 'generator', 'batteryBank', 'powerRelay'],
  researchTable: ['circuitBoard', 'antennaMast', 'rescueRadio', 'transmitterCore'],
  smelter: ['metalPlate']
}
const cost = (values: Record<string, number>) =>
  Object.entries(values).map(([materialId, amount]) => ({ materialId, amount }))
function item(
  id: string,
  name: string,
  category: CraftCategoryId,
  kind: ExpansionItem['kind'],
  description: string,
  materials: Record<string, number>,
  station?: string,
  health = 100
): ExpansionItem {
  const workplace = Object.keys(specialties).find((key) => specialties[key].includes(id))
  return { id, name, category, kind, description, cost: cost(materials), station: workplace ?? station, health }
}
export const EXPANSION_ITEMS: readonly ExpansionItem[] = [
  item(
    'repairKit',
    'Repair kit',
    'tools',
    'tool',
    'Use near a damaged raft tile to restore 50 health. Consumed only when a repair succeeds.',
    { wood: 2, rope: 1 }
  ),
  item(
    'bandage',
    'Bandage',
    'weapons',
    'tool',
    'Restores health gradually over ten seconds. Damage interrupts healing.',
    { plants: 4, rope: 1 }
  ),
  item(
    'workbench',
    'Workbench',
    'stations',
    'structure',
    'Use this bench to craft building parts, survival equipment and specialized worktables.',
    { wood: 6, metal: 2, rope: 2 }
  ),
  item(
    'armoryBench',
    'Armory',
    'stations',
    'structure',
    'Use this bench to craft weapons, defenses and their ammunition.',
    { wood: 6, metalPlate: 2, nails: 2 },
    'workbench'
  ),
  item(
    'engineeringBench',
    'Engineering bench',
    'stations',
    'structure',
    'Use this bench to craft navigation machines and power equipment.',
    { wood: 6, gears: 2, wire: 2 },
    'workbench'
  ),
  item(
    'smelter',
    'Smelter',
    'stations',
    'structure',
    'Fuel with wood and load scrap metal to produce metal plates.',
    { metal: 6, wood: 4 },
    'workbench'
  ),
  item(
    'researchTable',
    'Research table',
    'stations',
    'structure',
    'Supply plates and wire, then use this table to craft electronics and rescue equipment.',
    { wood: 6, metalPlate: 3 },
    'workbench'
  ),
  item('nails', 'Nails', 'resources', 'resource', 'Fasteners for reinforced construction.', { metal: 1 }, 'workbench'),
  item(
    'metalPlate',
    'Metal plate',
    'resources',
    'resource',
    'Structural metal produced only by loading and fueling a smelter.',
    { metal: 2, wood: 1 },
    'smelter'
  ),
  item(
    'gears',
    'Gears',
    'resources',
    'resource',
    'Mechanical transmission parts for towers and engines.',
    { metalPlate: 2 },
    'workbench'
  ),
  item(
    'wire',
    'Wire',
    'resources',
    'resource',
    'Crafting material for electrical equipment. Placed machines connect automatically.',
    { metal: 2, plastic: 1 },
    'workbench'
  ),
  item(
    'circuitBoard',
    'Circuit board',
    'resources',
    'resource',
    'Control electronics for rescue equipment.',
    { wire: 2, plastic: 2, metalPlate: 1 },
    'researchTable'
  ),
  item(
    'rainCollector',
    'Rain collector',
    'food-water',
    'structure',
    'Collects drinking water during periodic rain. Stores up to four drinks.',
    { wood: 4, plastic: 4, rope: 2 }
  ),
  item(
    'cropBed',
    'Crop bed',
    'food-water',
    'structure',
    'Plant a potato and water it with a fresh-water cup. Harvest three potatoes after a minute.',
    { wood: 4, rope: 2 }
  ),
  item(
    'waterTank',
    'Water tank',
    'food-water',
    'structure',
    'Stores eight fresh-water cups. Fill from your cup, then drink or refill an empty cup.',
    { metalPlate: 3, plastic: 6 },
    'workbench'
  ),
  item(
    'improvedGrill',
    'Improved grill',
    'food-water',
    'structure',
    'Fuel with wood and load potatoes. Cooks three portions per batch.',
    { metalPlate: 4, wood: 4, rope: 2 },
    'smelter'
  ),
  item(
    'metalHook',
    'Metal hook',
    'tools',
    'tool',
    'A reinforced salvage hook with twice the durability of the wooden hook.',
    { metalPlate: 2, rope: 2 },
    'workbench'
  ),
  item(
    'salvageAxe',
    'Salvage axe',
    'tools',
    'tool',
    'Recover scrap from wreck debris at close range.',
    { metalPlate: 2, wood: 2 },
    'workbench'
  ),
  item(
    'bow',
    'Bow',
    'weapons',
    'tool',
    'Aim and fire arrows at raiders. Requires arrows in your backpack.',
    { wood: 4, rope: 3 },
    'workbench'
  ),
  item('arrows', 'Arrows', 'weapons', 'resource', 'Ammunition for the bow.', { wood: 1, metal: 1 }),
  item(
    'boardingShield',
    'Boarding shield',
    'weapons',
    'tool',
    'Hold the action button to block frontal raider attacks. Cannot attack while guarding.',
    { wood: 4, metalPlate: 1 },
    'workbench'
  ),
  item(
    'scrapArmor',
    'Scrap armor',
    'weapons',
    'tool',
    'Use to wear armor that absorbs half of incoming raider damage until its protection runs out.',
    { metalPlate: 4, rope: 2 },
    'workbench'
  ),
  item(
    'wall',
    'Wall',
    'building',
    'structure',
    'A solid defensive barrier. Raiders must break through it.',
    { wood: 4, rope: 1 },
    undefined,
    180
  ),
  item(
    'gate',
    'Gate',
    'building',
    'structure',
    'An openable barrier. Close it to block boarders.',
    { wood: 5, nails: 2 },
    'workbench',
    150
  ),
  item(
    'stairs',
    'Stairs',
    'building',
    'structure',
    'A walkable staircase to an elevated firing position.',
    { wood: 6, nails: 2 },
    'workbench',
    150
  ),
  item(
    'upperFloor',
    'Upper floor',
    'building',
    'structure',
    'A raised deck with supporting columns. Place adjacent stairs to reach it.',
    { wood: 6, nails: 2 },
    'workbench',
    160
  ),
  item(
    'railing',
    'Railing',
    'building',
    'structure',
    'A low perimeter barrier that keeps crew on the deck.',
    { wood: 3, rope: 1 },
    undefined,
    100
  ),
  item(
    'armoredFoundation',
    'Armored foundation',
    'building',
    'structure',
    'Reinforces a raft tile against hull attacks.',
    { metalPlate: 4, nails: 2 },
    'workbench',
    400
  ),
  item(
    'towerPlatform',
    'Tower platform',
    'building',
    'structure',
    'An elevated defensive emplacement. Equip a heavy tower and place it on this platform for reinforced health.',
    { wood: 6, metalPlate: 3 },
    'workbench',
    250
  ),
  item(
    'ammoCrate',
    'Ammo crate',
    'stations',
    'structure',
    'Load ammunition from your backpack to resupply nearby towers.',
    { wood: 4, metalPlate: 2 },
    'workbench'
  ),
  item(
    'ropeBarricade',
    'Rope barricade',
    'defenses',
    'structure',
    'A cheap obstacle that delays boarding enemies.',
    { wood: 3, rope: 3 },
    undefined,
    120
  ),
  item(
    'spikeStrip',
    'Spike strip',
    'defenses',
    'structure',
    'Damages boarders crossing this tile. Wears down with each hit.',
    { wood: 3, metal: 3 },
    'workbench',
    80
  ),
  item(
    'netLauncher',
    'Net launcher',
    'defenses',
    'structure',
    'Consumes nets to slow nearby boarders. Little direct damage.',
    { gears: 2, wood: 4, rope: 3 },
    'workbench',
    140
  ),
  item(
    'ballista',
    'Ballista tower',
    'defenses',
    'structure',
    'Fires bolts at incoming raiders within its forward arc. Requires ammunition.',
    { gears: 2, metalPlate: 3, wood: 6 },
    'workbench',
    180
  ),
  item(
    'harpoonTower',
    'Harpoon tower',
    'defenses',
    'structure',
    'Automatically repels nearby sea beasts using harpoons.',
    { gears: 3, metalPlate: 5, rope: 3 },
    'researchTable',
    220
  ),
  item(
    'deckCannon',
    'Deck cannon',
    'defenses',
    'structure',
    'Slow, powerful cannon against pirate boats. Consumes cannonballs.',
    { gears: 3, metalPlate: 6, wood: 4 },
    'researchTable',
    220
  ),
  item('nets', 'Nets', 'resources', 'resource', 'Ammunition for a net launcher.', { rope: 2 }),
  item('bolts', 'Ballista bolts', 'resources', 'resource', 'Ammunition for a ballista.', { wood: 1, metal: 1 }),
  item(
    'harpoons',
    'Harpoons',
    'resources',
    'resource',
    'Ammunition for a harpoon tower.',
    { metalPlate: 1, rope: 1 },
    'workbench'
  ),
  item(
    'cannonballs',
    'Cannonballs',
    'resources',
    'resource',
    'Heavy ammunition for a deck cannon.',
    { metalPlate: 2, coal: 1 },
    'smelter'
  ),
  item(
    'alarmBell',
    'Alarm bell',
    'defenses',
    'structure',
    'Ring to announce and start a raid when you are ready. Successful raids yield salvage.',
    { metal: 3, rope: 1 }
  ),
  item(
    'lookoutPost',
    'Lookout post',
    'navigation',
    'structure',
    'Inspect to identify the next raid before ringing the alarm bell.',
    { wood: 5, rope: 3 },
    'workbench'
  ),
  item(
    'sail',
    'Sail',
    'navigation',
    'structure',
    'Catch the wind to increase drifting salvage arrivals. Toggle the sail when placed.',
    { wood: 4, plants: 8, rope: 4 },
    'workbench'
  ),
  item(
    'steeringWheel',
    'Steering wheel',
    'navigation',
    'structure',
    'Choose a salvage heading: wood, metal or plastic.',
    { wood: 4, gears: 2 },
    'workbench'
  ),
  item(
    'engine',
    'Engine',
    'navigation',
    'structure',
    'Burns wood for powered salvage travel. Steering selects the resource route.',
    { gears: 4, metalPlate: 4 },
    'researchTable'
  ),
  item(
    'generator',
    'Generator',
    'power-radio',
    'structure',
    `Burns wood and automatically powers devices within ${AUTO_WIRE_RANGE_M} meters. No cables needed.`,
    { gears: 3, metalPlate: 4, wire: 3 },
    'researchTable'
  ),
  item(
    'batteryBank',
    'Battery bank',
    'power-radio',
    'structure',
    `Automatically connects within ${AUTO_WIRE_RANGE_M} meters. Stores power and keeps the radio running when fuel runs out.`,
    { metalPlate: 3, wire: 4, plastic: 3 },
    'researchTable'
  ),
  item(
    'powerRelay',
    'Power relay',
    'power-radio',
    'structure',
    `Automatically extends nearby power by ${AUTO_WIRE_RANGE_M} meters. Just place it; no cables needed.`,
    { wire: 3, metalPlate: 1 },
    'workbench'
  ),
  item(
    'antennaMast',
    'Antenna mast',
    'power-radio',
    'structure',
    'Required beside the rescue radio to broadcast a signal.',
    { metalPlate: 5, wire: 4, rope: 3 },
    'researchTable',
    160
  ),
  item(
    'rescueRadio',
    'Rescue radio',
    'power-radio',
    'structure',
    'Install a transmitter core and place near power and an antenna. Power connects automatically. Defend the broadcast to win.',
    { circuitBoard: 3, wire: 4, metalPlate: 4 },
    'researchTable'
  ),
  item(
    'transmitterCore',
    'Transmitter core',
    'power-radio',
    'resource',
    'Earned after the sea-beast raid. Claim a replacement at the alarm bell if your core is lost.',
    { circuitBoard: 6, gears: 4, metalPlate: 6 },
    'researchTable'
  )
]
export function getExpansionItem(id: string): ExpansionItem | undefined {
  return EXPANSION_ITEMS.find((item) => item.id === id)
}
export const EXPANSION_STRUCTURES = EXPANSION_ITEMS.filter((item) => item.kind === 'structure')
export function expansionIcon(item: ExpansionItem): string {
  return 'images/hud/expansion/' + item.id + '.png'
}
