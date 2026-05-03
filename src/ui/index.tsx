import { isMobile } from '@dcl/sdk/platform'
import ReactEcs, { ReactEcsRenderer, SafeAreaContainer, UiEntity } from '@dcl/sdk/react-ecs'

import { ActionButton } from './components/ActionButton'
import { BottomBar } from './components/BottomBar'
import { ChargeReticle } from './components/ChargeReticle'
import { CraftButton } from './components/CraftButton'
import { CraftDoubleMenu } from './components/CraftMenu'
import { CraftProgressBar } from './components/CraftProgressBar'
import { DestroyBanner } from './components/DestroyBanner'
import { InventoryButton } from './components/InventoryButton'
import { InventoryPanel } from './components/InventoryPanel'
import { NotificationOverlay } from './components/Notification'
import { StatsBars } from './components/StatsBars'
import { isCrafting } from './craftSession'
import { pressBackground } from './inventoryDrag'

// React-ECS render runs every frame; reading scene state directly here is
// the idiomatic pattern (no useState/useEffect).
// Virtual canvas size — react-ecs computes a scale factor of
// `min(canvasW / virtualW, canvasH / virtualH)` and multiplies it into every
// numeric uiTransform value and Label fontSize each frame. With a 1920x1080
// reference the HUD looks identical at 1080p, doubles at 4K, and shrinks at
// smaller windowed canvases. Percentage strings ('100%', '50%') are unaffected.
const UI_VIRTUAL_WIDTH = 1920
const UI_VIRTUAL_HEIGHT = 1080

export function setupUi(): void {
  ReactEcsRenderer.setUiRenderer(ui, {
    virtualWidth: UI_VIRTUAL_WIDTH,
    virtualHeight: UI_VIRTUAL_HEIGHT
  })
}

// Mobile is the only platform with hardware insets (notch / home indicator)
// that overlap the canvas, so it's the only platform where SafeAreaContainer
// adds value. On desktop the chat/minimap chrome is outside the UI canvas,
// and the extra wrapper would shrink the HUD for no reason.
function SafeArea({ children }: { children?: ReactEcs.JSX.ReactNode }): ReactEcs.JSX.Element {
  if (isMobile()) {
    return <SafeAreaContainer>{children}</SafeAreaContainer>
  }
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      {children}
    </UiEntity>
  )
}

function ui(): ReactEcs.JSX.Element {
  // While a craft is running every interactive HUD element hides — the
  // player can't act, only watch the progress bar fill. The bar reuses
  // the hook charge meter style for visual consistency.
  if (isCrafting()) {
    return (
      <SafeArea>
        <UiEntity
          uiTransform={{
            width: '100%',
            height: '100%'
          }}
        >
          <CraftProgressBar />
          <NotificationOverlay />
        </UiEntity>
      </SafeArea>
    )
  }

  return (
    <SafeArea>
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: { top: 80 }
        }}
        // Any click that doesn't land on a slot (or on the slot's parents
        // forwarding the press) cancels the current swap selection. Slot
        // handlers set `interactionThisFrame` so this background handler
        // skips when a slot was the actual click target this frame.
        onMouseDown={pressBackground}
      >
        <DestroyBanner />
        <BottomBar />
        <StatsBars />
        <ActionButton />
        <InventoryButton />
        <CraftButton />
        <InventoryPanel />
        <CraftDoubleMenu />
        <ChargeReticle />
        <NotificationOverlay />
      </UiEntity>
    </SafeArea>
  )
}
