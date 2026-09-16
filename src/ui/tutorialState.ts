import { TUTORIAL_ENABLED } from '../config/gameConfig'
import { recordProgress, skipInvestigation, hasProgress } from '../progression/state'
import { beginUiTouch } from './mobileControlsState'
// Local onboarding progress. Gameplay reports successful actions so consuming
// an item or closing a menu cannot erase an already-completed objective.
export type TutorialAction =
  | 'collect'
  | 'inventory'
  | 'rope'
  | 'hammer'
  | 'expand'
  | 'purifier'
  | 'saltWater'
  | 'freshWater'
  | 'drink'
  | 'grill'
  | 'eat'
const completed = new Set<TutorialAction>()
let enabled = TUTORIAL_ENABLED
let expanded = false
export function isTutorialExpanded(): boolean {
  return expanded
}
export function recordTutorialAction(action: TutorialAction): void {
  completed.add(action)
  recordProgress(action)
}
export function hasTutorialAction(action: TutorialAction): boolean {
  return completed.has(action)
}
export function isTutorialEnabled(): boolean {
  return enabled
}
export function showTutorial(): void {
  beginUiTouch()
  enabled = true
  expanded = true
}
export function dismissTutorial(): void {
  beginUiTouch()
  enabled = false
  skipInvestigation()
}
// Finishing the guide keeps investigation progression active. Only an explicit
// skip unlocks the remaining recipes.
export function finishTutorial(): void {
  beginUiTouch()
  recordProgress('guideCompleted')
  enabled = false
  expanded = false
}
export function restartTutorial(): void {
  completed.clear()
  enabled = TUTORIAL_ENABLED
  expanded = false
}

export const serializeTutorial = () => [...completed]
export function hydrateTutorial(actions: TutorialAction[]): void { completed.clear(); actions.forEach(a => completed.add(a)); enabled = !hasProgress('guidanceSkipped') && !hasProgress('guideCompleted') }
