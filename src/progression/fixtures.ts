import { recordTutorialAction } from '../ui/tutorialState'
// Explicit debug fixtures are marked in telemetry; never use their times as balance evidence.
import { DEBUG_MODE } from '../config/gameConfig'
import { startTestMode } from '../ui/gameOver'
import { recordProgress, completeStoryRaid, serializeProgress, hydrateProgress, recipeUnlocked, chapter, metric } from './state'
import { createPlatform, gridCellToWorld } from '../factories/platform'
import { createConstruction, ConstructionKind } from '../factories/construction'
import { ExpansionState } from '../components'
import { addCollected } from '../ui/inventoryState'
import { captureCheckpoint } from './checkpoint'
import { setStat } from '../ui/statsBars'

export function startChapterFixture(target: number): void {
  if (!DEBUG_MODE || !Number.isInteger(target) || target < 2 || target > 6) return
  startTestMode('progression-test')
  for (const event of ['collect', 'expand', 'drink', 'cookedMeal']) recordProgress(event)
  if (target >= 3) recordProgress('plate')
  for (let i = 3; i < target; i++) completeStoryRaid()
  const state = serializeProgress()
  state.recovery = 0
  hydrateProgress(state)
  metric('fixtureChapter', target)
  if (chapter() !== target) throw new Error('Invalid chapter fixture')
  const structures: string[] = ['grill', 'purifier', 'workbench', 'smelter', 'storage']
  if (target >= 3) structures.push('armoryBench', 'alarmBell')
  if (target >= 4) structures.push('engineeringBench', 'ballista', 'ammoCrate')
  if (target >= 5) structures.push('researchTable', 'harpoonTower', 'generator', 'antennaMast', 'rescueRadio')
  if (target === 6) {
    for (const kind of ['generator', 'antennaMast', 'rescueRadio']) {
      structures.splice(structures.indexOf(kind), 1)
      structures.unshift(kind)
    }
  } else {
    structures.splice(structures.indexOf('smelter'), 1)
    structures.unshift('smelter')
  }
  const cells: [number, number][] = []
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++)
    if (x !== 0 || z !== 0) cells.push([x, z])
  cells.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]))
  let cursor = 0
  for (const [x, z] of cells) {
    const platform = createPlatform(gridCellToWorld(x, z), { gridX: x, gridZ: z })
    const kind = structures[cursor++]
    if (!kind) continue
    if (!recipeUnlocked(kind)) throw new Error('Fixture has a locked prerequisite: ' + kind)
    createConstruction(platform, kind as ConstructionKind, 0)
    const device = ExpansionState.getMutableOrNull(platform)
    if (device) {
      device.fuel = ['generator', 'smelter'].includes(kind) ? 90 : 0
      device.installed = kind === 'researchTable'
      device.ammo = ['ballista', 'harpoonTower'].includes(kind) ? 20 : 0
    }
  }
  for (const id of ['hammer', 'cup', 'spear']) addCollected(id, 1)
  for (const id of ['wood', 'metal', 'plastic', 'plants', 'rope']) addCollected(id, 20)
  if (target >= 3) addCollected('metalPlate', 10)
  if (target >= 4) addCollected('bolts', 20)
  if (target >= 5) addCollected('harpoons', 20)
  if (target === 6) addCollected('transmitterCore', 1)
  for (const stat of ['life', 'hunger', 'thirst'] as const) setStat(stat, 1)
  captureCheckpoint()
}

export function startTutorialCraftFixture(): void {
  if (!DEBUG_MODE) return
  startTestMode('progression-test')
  for (const [id, count] of [['plants', 20], ['wood', 20], ['plastic', 10], ['metal', 10]] as const) addCollected(id, count)
  recordTutorialAction('collect')
  recordTutorialAction('inventory')
  metric('fixtureTutorial', 1)
  captureCheckpoint()
}
