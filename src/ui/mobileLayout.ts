import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

// Virtual pixels: small desktop edge spacing, scaled once by React-ECS.
const DESKTOP_EDGE_PADDING = 12
const DESKTOP_CHROME_GAP = 24
// Native minimap clearance in canvas pixels; Bevy under-reports it in narrow windows.
const DESKTOP_MIN_CHROME_WIDTH = 220

// setupUi passes a 16:9 1600×900 virtual screen; the SDK overrides 16:9 sizes
// with 1600×720 on mobile, so the active virtual size depends on the platform.
export function getVirtualSize(): { width: number; height: number } {
  return isMobile() ? { width: 1600, height: 720 } : { width: 1600, height: 900 }
}

// Insets arrive in canvas pixels; results are in virtual pixels.
export function getMobileLayout(hardwareOnly = false) {
  const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
  const virtual = getVirtualSize()
  const scale = canvas ? Math.min(canvas.width / virtual.width, canvas.height / virtual.height) : 1
  const divisor = Math.max(scale, 0.01)
  const area = hardwareOnly ? canvas?.screenInsetArea : canvas?.interactableArea
  const desktopHud = !isMobile() && !hardwareOnly
  const hardware = canvas?.screenInsetArea
  // Bevy's interactable rectangle includes generous margins on otherwise empty
  // desktop edges. Keep its left-side chrome clearance, but anchor the other
  // edges just inside the hardware-safe canvas instead.
  const top = desktopHud ? (hardware?.top ?? 0) / divisor + DESKTOP_EDGE_PADDING : (area?.top ?? 0) / divisor
  const left = desktopHud
    ? Math.max(area?.left ?? 0, hardware?.left ?? 0, DESKTOP_MIN_CHROME_WIDTH) / divisor + DESKTOP_CHROME_GAP
    : (area?.left ?? 0) / divisor
  const right = desktopHud ? (hardware?.right ?? 0) / divisor + DESKTOP_EDGE_PADDING : (area?.right ?? 0) / divisor
  const bottom = desktopHud ? (hardware?.bottom ?? 0) / divisor + DESKTOP_EDGE_PADDING : (area?.bottom ?? 0) / divisor
  return {
    top, left, right, bottom,
    width: (canvas?.width ?? virtual.width) / divisor - left - right,
    height: (canvas?.height ?? virtual.height) / divisor - top - bottom
  }
}
