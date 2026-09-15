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
let enabled = true
let expanded = false
export function isTutorialExpanded(): boolean {
  return expanded
}
export function recordTutorialAction(action: TutorialAction): void {
  completed.add(action)
}
export function hasTutorialAction(action: TutorialAction): boolean {
  return completed.has(action)
}
export function isTutorialEnabled(): boolean {
  return enabled
}
export function showTutorial(): void {
  enabled = true
  expanded = true
}
export function dismissTutorial(): void {
  enabled = false
}
export function restartTutorial(): void {
  completed.clear()
  enabled = true
  expanded = false
}
