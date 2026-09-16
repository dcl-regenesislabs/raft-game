import { getMobileLayout } from './mobileLayout'
let expanded = false
export const isObjectiveExpanded = () => expanded
export function toggleObjective(): void { expanded = !expanded }
export const objectiveBottom = () => getMobileLayout().height * 0.05 + (expanded ? 130 : 48) + 12
