import { isMobile } from '@dcl/sdk/platform'
import ReactEcs, { ReactEcsRenderer, SafeAreaContainer, UiEntity } from '@dcl/sdk/react-ecs'

import { ActionButton } from './components/ActionButton'
import { BottomBar } from './components/BottomBar'
import { ChargeReticle } from './components/ChargeReticle'
import { CookMenu } from './components/CookMenu'
import { CraftButton } from './components/CraftButton'
import { CraftDoubleMenu } from './components/CraftMenu'
import { CraftProgressBar } from './components/CraftProgressBar'
import { DeathScreen } from './components/DeathScreen'
import { DestroyBanner } from './components/DestroyBanner'
import { InventoryButton } from './components/InventoryButton'
import { InventoryPanel } from './components/InventoryPanel'
import { NotificationOverlay } from './components/Notification'
import { StatsBars } from './components/StatsBars'
import { isCooking } from './cookSession'
import { isCookOpen } from './cookToggle'
import { isCrafting } from './craftSession'
import { isCraftOpen } from './craftToggle'
import { isGameOver } from './gameOver'
import { pressBackground } from './inventoryDrag'
import { isInventoryOpen } from './inventoryToggle'
import { isPurifying } from './purifySession'

// Both platforms use the same 1366×768 virtual canvas (entry-level
// laptop reference) so a single set of pixel constants in `theme.ts`
// lays out the HUD on every aspect ratio — proportional scaling fills
// the viewport in both directions.
// See `.agents/skills/local/mobile-ui-scaling/SKILL.md`.
export function setupUi(): void {
  ReactEcsRenderer.setUiRenderer(ui, { virtualWidth: 1366, virtualHeight: 768 })
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
  // Death overlay sits OUTSIDE the safe area so its dark backdrop covers
  // the full viewport (notch / home-indicator strips included). All
  // regular HUD elements suppress while dead.
  if (isGameOver()) {
    return (
      <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
        <DeathScreen />
      </UiEntity>
    )
  }
  // While a craft, cook or purify is running every interactive HUD
  // element hides — the player can't act, only watch the progress bar
  // fill. The bar reuses the hook charge meter style for visual
  // consistency.
  if (isCrafting() || isPurifying() || isCooking()) {
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
        uiTransform={{ width: '100%', height: '100%' }}
        // Any click that doesn't land on a slot (or on the slot's parents
        // forwarding the press) cancels the current swap selection. Slot
        // handlers set `interactionThisFrame` so this background handler
        // skips when a slot was the actual click target this frame.
        onMouseDown={pressBackground}
      >
        <DestroyBanner />
        {/* Standalone hot-bar hides while a panel is up — the inventory
            panel and the craft menu both render their own bar attached
            under the inventory grid via <InventoryWithBar/>. */}
        {!isInventoryOpen() && !isCraftOpen() && !isCookOpen() && <BottomBar />}
        {!isCookOpen() && <StatsBars />}
        {!isCookOpen() && <ActionButton />}
        {!isCookOpen() && <InventoryButton />}
        {!isCookOpen() && <CraftButton />}
        <InventoryPanel />
        <CraftDoubleMenu />
        <CookMenu />
        <ChargeReticle />
        <NotificationOverlay />
      </UiEntity>
    </SafeArea>
  )
}
