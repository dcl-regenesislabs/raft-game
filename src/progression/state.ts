import { requiredChapter, recipeAvailable } from './unlocks'
export { requiredChapter } from './unlocks'
import { isMultiplayer, isApplyingWorld } from '../client/multiplayerState'
import { DEBUG_MODE, TUTORIAL_ENABLED } from '../config/gameConfig'
import { CAMPAIGN, OPENING_SALVAGE, WORKSHOP_SALVAGE } from './config'
export type CampaignMode = 'campaign' | 'sandbox' | 'progression-test'
export type ProgressSnapshot = {
  version: 1; mode: CampaignMode; events: string[]; wins: number; seconds: number;
  recovery: number; salvage: number; seed: number; pending: Record<string, number>;
  metrics: Record<string, number>; milestones: number[]
}
let state: ProgressSnapshot
let revision = 0
export function resetProgress(mode: CampaignMode = DEBUG_MODE ? 'sandbox' : 'campaign'): void {
  state = { version: 1, mode, events: !TUTORIAL_ENABLED ? ['guidanceSkipped'] : [], wins: 0, seconds: 0, recovery: 0, salvage: 0,
    seed: CAMPAIGN.seed, pending: {}, metrics: {}, milestones: [0] }
  revision++
}
resetProgress()
export const campaignMode = () => state.mode
export const isSandbox = () => state.mode === 'sandbox'
export const hasProgress = (event: string) => state.events.includes(event)
export const storyWins = () => state.wins
export const progressRevision = () => revision
export function chapter(): number {
  if (state.wins >= 3) return 6
  if (state.wins === 2) return 5
  if (state.wins === 1) return 4
  if (hasProgress('plate')) return 3
  if (['expand', 'drink', 'cookedMeal'].every(hasProgress)) return 2
  return 1
}
export function metric(name: string, amount = 1): void { state.metrics[name] = (state.metrics[name] ?? 0) + amount }
export function recordProgress(event: string): void {
  if (isMultiplayer() && !isApplyingWorld()) return
  if (hasProgress(event)) return
  const before = chapter()
  state.events.push(event)
  if (chapter() !== before) {
    state.milestones[chapter() - 1] = state.seconds
    state.recovery = CAMPAIGN.recoverySeconds
    revision++
  }
}
export function completeStoryRaid(): void {
  if (state.wins >= 3) return
  state.wins++
  state.milestones[chapter() - 1] = state.seconds
  state.recovery = CAMPAIGN.recoverySeconds
  revision++
}
export function tickProgress(dt: number, menuOpen = false): void {
  state.seconds += dt
  state.recovery = Math.max(0, state.recovery - dt)
  metric(menuOpen ? 'menuSeconds' : 'activeSeconds', dt)
}
export const recoverySeconds = () => state.recovery
export const ambientAllowed = () => isSandbox() || (chapter() >= 3 && state.recovery === 0 && !hasProgress('finaleStarted'))
export function raidGate(finale = false): string | null {
  if (isSandbox()) return null
  if (finale) return state.wins >= 3 ? null : 'Defeat the three story raids first.'
  if (state.recovery > 0) return `Recovery: ${Math.ceil(state.recovery)}s before the next raid.`
  if (chapter() < 3) return 'Make your first metal plate before starting a raid.'
  return null
}
// Skipping guidance is a persistent recipe bypass, not a combat/story victory.
export const investigationBypassed = () => isSandbox() || hasProgress('guidanceSkipped')
export function skipInvestigation(): void { recordProgress('guidanceSkipped'); revision++ }
export function recipeUnlocked(id: string): boolean {
  if (!Number.isFinite(requiredChapter(id))) return false
  if (isSandbox()) return true
  if (id === 'transmitterCore') return false
  if (investigationBypassed()) return true
  return recipeAvailable(chapter(), state.events, id)
}
export function guidedRecipe(): string | null {
  if (investigationBypassed()) return null
  if (chapter() === 1) {
    if (!hasProgress('collect') || !hasProgress('inventory')) return null
    if (!hasProgress('rope')) return 'rope'
    if (!hasProgress('hammer')) return 'hammer'
    if (!hasProgress('expand')) return null
    if (!hasProgress('purifier')) return hasProgress('crafted:purifier') ? null : 'purifier'
    if (!hasProgress('saltWater')) return hasProgress('crafted:cup') ? null : 'cup'
    if (!hasProgress('drink')) return null
    if (!hasProgress('grill')) return hasProgress('crafted:grill') ? null : 'grill'
  }
  if (chapter() === 2) return !hasProgress('crafted:workbench') ? 'workbench' : !hasProgress('crafted:smelter') ? 'smelter' : null
  return null
}
export const INVESTIGATIONS = [
  { title: 'Survival', level: 1, description: 'Follow the survival guide. Make rope, build a hammer, expand, purify water and cook a meal. Each lesson reveals its recipes.' },
  { title: 'A floating home', level: 2, description: 'Expand the raft, drink fresh water and eat a cooked meal. Discover the workbench, storage, crops and smelting.' },
  { title: 'Metalworking', level: 3, description: 'Produce your first metal plate in a smelter. Discover the armory, improved tools and boarding defenses.' },
  { title: 'Engineering', level: 4, description: 'Defeat the first boarding raid. Discover ballistas, navigation and larger structures.' },
  { title: 'Rescue technology', level: 5, description: 'Defeat the pirate raid. Discover research, power, heavy defenses and rescue equipment. Defeat the sea beasts to recover the transmitter core.' }
] as const

export function objective(): { title: string; detail: string } {
  const c = chapter()
  if (c === 1) {
    if (!hasProgress('collect')) return { title: 'Catch your first supplies', detail: 'Aim at nearby debris. Hold the main hook button (left-click on desktop), then release to cast. Grab close supplies directly if your hook breaks.' }
    if (!hasProgress('expand')) return { title: 'Expand your raft', detail: 'Craft rope and a hammer. Each tile costs 2 wood, 2 plastic and 1 rope.' }
    if (!hasProgress('drink')) return { title: 'Make fresh drinking water', detail: 'Build a purifier and cup. Add salt water and wood, then drink the fresh water.' }
    return { title: 'Cook and eat your first meal', detail: 'Build a grill and cook a potato with wood. Eat the cooked meal to unlock your workbench.' }
  }
  if (c === 2) return { title: 'Make your first metal plate', detail: 'Build a workbench, then a smelter. Load 2 scrap metal and add wood. Metalworking unlocks the armory.' }
  if (c === 3) return { title: 'Prepare for the first boarding raid', detail: 'Build the armory and alarm bell. A spear plus barricades or spikes can stop the first zombies. Ring the bell when ready.' }
  if (c === 4) return { title: 'Defend against pirates', detail: 'Build and load a ballista. Nearby ammunition storage reloads it automatically. Engineering improves salvage. Ring the bell when ready.' }
  if (c === 5) return { title: 'Defeat the sea beasts', detail: 'Harpoons defend the hull. Prepare ammunition and ring the bell. Research also unlocks automatic power and rescue equipment.' }
  return { title: 'Build the rescue radio and transmit', detail: 'Claim your core from the bell, install it in the radio, place an antenna within 12m and fueled power within 7m. Prepare defenses before starting the final broadcast.' }
}
export function queueReward(id: string, count: number): void { state.pending[id] = (state.pending[id] ?? 0) + count }
export function pendingRewards(): Record<string, number> { return { ...state.pending } }
export function claimRewards(grant: (id: string, count: number) => number): void {
  for (const [id, count] of Object.entries(state.pending)) {
    const given = Math.max(0, Math.min(count, grant(id, count)))
    state.pending[id] -= given
    if (!state.pending[id]) delete state.pending[id]
  }
}
export function nextSalvage(): typeof OPENING_SALVAGE[number] { const pool = chapter() >= 2 ? WORKSHOP_SALVAGE : OPENING_SALVAGE; return pool[state.salvage++ % pool.length] }
export function campaignRandom(): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0
  return state.seed / 4294967296
}
export function serializeProgress(): ProgressSnapshot { return JSON.parse(JSON.stringify(state)) }
export function hydrateProgress(saved: ProgressSnapshot): void {
  if (!saved || saved.version !== 1 || !Array.isArray(saved.events) || !Number.isInteger(saved.wins) || saved.wins < 0 || saved.wins > 3) return
  if (!['campaign', 'sandbox', 'progression-test'].includes(saved.mode)) return
  if (!saved.events.every(event => typeof event === 'string')) return
  if (![saved.seconds, saved.recovery, saved.salvage, saved.seed].every(n => Number.isFinite(n) && n >= 0)) return
  if (!Array.isArray(saved.milestones) || !saved.pending || !saved.metrics) return
  if (![saved.pending, saved.metrics].every(values => typeof values === 'object' && Object.values(values).every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0))) return
  state = JSON.parse(JSON.stringify(saved)); revision++
}

let assault = false
export const assaultActive = () => assault
export function setAssaultActive(value: boolean): void { assault = value }

export function beginRecovery(): void { state.recovery = CAMPAIGN.recoverySeconds }
