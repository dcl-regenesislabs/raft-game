import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

// setupUi passes a 16:9 1920×1080 virtual screen; the SDK overrides 16:9 sizes
// with 1600×720 on mobile, so the active virtual size depends on the platform.
export function getVirtualSize(): { width: number; height: number } {
  return isMobile() ? { width: 1600, height: 720 } : { width: 1920, height: 1080 }
}

// Insets arrive in canvas pixels; results are in virtual pixels.
export function getMobileLayout(hardwareOnly = false) {
  const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
  const virtual = getVirtualSize()
  const scale = canvas ? Math.min(canvas.width / virtual.width, canvas.height / virtual.height) : 1
  const divisor = Math.max(scale, 0.01)
  const area = hardwareOnly ? canvas?.screenInsetArea : canvas?.interactableArea
  const top = (area?.top ?? 0) / divisor
  const left = (area?.left ?? 0) / divisor
  const right = (area?.right ?? 0) / divisor
  const bottom = (area?.bottom ?? 0) / divisor
  return {
    top, left, right, bottom,
    width: (canvas?.width ?? virtual.width) / divisor - left - right,
    height: (canvas?.height ?? virtual.height) / divisor - top - bottom
  }
}
