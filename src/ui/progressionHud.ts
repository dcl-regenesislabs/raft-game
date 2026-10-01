import { isMobile } from '@dcl/sdk/platform'
import { getMobileLayout } from './mobileLayout'

// Desktop aligns with the HUD's small top margin; mobile keeps it at 5%.
export const objectiveTop = () => (isMobile() ? getMobileLayout().height * 0.05 : getMobileLayout().top)
export const objectiveBottom = () => objectiveTop() + 48 + 12

// Horizontal band the top-centre overlays (objective, notifications) centre in:
// the interactable area on desktop so they line up clear of the explorer chrome,
// the full canvas on mobile.
export function topOverlayBand(): { left: number; width: number | '100%' } {
  if (isMobile()) return { left: 0, width: '100%' }
  const area = getMobileLayout()
  return { left: area.left, width: area.width }
}
