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
import { isPurifying } from './purifySession'

// Both platforms use a virtual canvas so the HUD scales with the viewport.
// Mobile uses 720×720 (square reference matches portrait/landscape phone
// proportions evenly); desktop uses 1920×1080 (1080p reference).
// See `.agents/skills/local/mobile-ui-scaling/SKILL.md`.
export function setupUi(): void {
  if (isMobile()) {
    ReactEcsRenderer.setUiRenderer(ui, { virtualWidth: 720, virtualHeight: 720 })
    return
  }
  ReactEcsRenderer.setUiRenderer(ui, { virtualWidth: 1920, virtualHeight: 1080 })
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
  // While a craft or purify is running every interactive HUD element
  // hides — the player can't act, only watch the progress bar fill.
  // The bar reuses the hook charge meter style for visual consistency.
  if (isCrafting() || isPurifying()) {
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
