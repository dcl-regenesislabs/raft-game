import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'
import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'

import { ActionButton } from './components/ActionButton'
import { DebugPanel } from './components/DebugPanel'
import { BottomBar } from './components/BottomBar'
import { ChargeReticle } from './components/ChargeReticle'
import { CookMenu } from './components/CookMenu'
import { CraftButton } from './components/CraftButton'
import { CraftDoubleMenu } from './components/CraftMenu'
import { CraftProgressBar } from './components/CraftProgressBar'
import { DeathScreen } from './components/DeathScreen'
import { WinScreen } from './components/WinScreen'
import { DestroyBanner } from './components/DestroyBanner'
import { LobbyMusicButton } from './components/LobbyMusicButton'
import { InventoryButton } from './components/InventoryButton'
import { InventoryPanel } from './components/InventoryPanel'
import { ItemReceivedOverlay } from './components/ItemReceivedNotification'
import { ModeToggleButton } from './components/ModeToggleButton'
import { NotificationOverlay } from './components/Notification'
import { RotateButtons } from './components/RotateButtons'
import { StartupScreen } from './components/StartupScreen'
import { StatsBars } from './components/StatsBars'
import { StorageMenu } from './components/StorageMenu'
import { SystemButton } from './components/SystemButton'
import { SystemMenu } from './components/SystemMenu'
import { isCookOpen } from './cookToggle'
import { isCrafting } from './craftSession'
import { isCraftOpen } from './craftToggle'
import { isGameOver } from './gameOver'
import { isWinActive } from './winScreen'
import { isInventoryOpen } from './inventoryToggle'
import { isStartupGateActive } from './startupGate'
import { isStorageOpen } from './storageToggle'
import { isSystemMenuOpen } from './systemSession'

// Both platforms use the same 1600×720 virtual canvas so a single set
// of pixel constants in `theme.ts` lays out the HUD on every aspect
// ratio — proportional scaling fills the viewport in both directions.
// See `.agents/skills/local/mobile-ui-scaling/SKILL.md`.
export function setupUi(): void {
  ReactEcsRenderer.setUiRenderer(ui, { virtualWidth: 1600, virtualHeight: 720 })
}

// Mobile is the only platform with hardware insets (notch / home indicator)
// that overlap the canvas, so it's the only platform where the safe-area
// inset is applied. On desktop the chat/minimap chrome is outside the UI
// canvas, and shrinking the HUD would just waste pixels.
//
// `UiCanvasInformation.interactableArea` is the renderer-reported BorderRect
// (in virtual pixels) of the region not covered by platform/hardware UI.
// We render an absolute UiEntity with matching top/left/right/bottom so a
// child sized 100%×100% fills exactly the safe area.
function SafeArea({ children }: { children?: ReactEcs.JSX.ReactNode }): ReactEcs.JSX.Element {
  if (!isMobile()) {
    return (
      <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
        {children}
      </UiEntity>
    )
  }
  const insets = UiCanvasInformation.getOrNull(engine.RootEntity)?.interactableArea
  const top = insets?.top ?? 0
  const left = insets?.left ?? 0
  const right = insets?.right ?? 0
  const bottom = insets?.bottom ?? 0
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top, left, right, bottom }
      }}
    >
      {children}
    </UiEntity>
  )
}

function ui(): ReactEcs.JSX.Element {
  // Boot-time title/gate sits ABOVE everything else, ignoring the safe
  // area so the black backdrop covers the full canvas. Suppresses all
  // regular HUD until the player picks NEW GAME or LOAD LAST GAME.
  if (isStartupGateActive()) {
    return (
      <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
        <SafeArea>
          <LobbyMusicButton />
        </SafeArea>
        <StartupScreen />
      </UiEntity>
    )
  }
  if (isGameOver()) {
    return (
      <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
        <DeathScreen />
      </UiEntity>
    )
  }
  if (isWinActive()) {
    return (
      <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
        <WinScreen />
      </UiEntity>
    )
  }
  // While a craft is running every interactive HUD element hides — the
  // player can't act, only watch the progress bar fill. The bar reuses
  // the hook charge meter style for visual consistency. Cooking and
  // water purification are asynchronous (place-and-wait) and don't
  // lock the HUD.
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
          <ItemReceivedOverlay />
        </UiEntity>
      </SafeArea>
    )
  }

  const anyPanel = isInventoryOpen() || isCraftOpen() || isCookOpen() || isStorageOpen() || isSystemMenuOpen()

  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      <SafeArea>
        <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
          {/* No conditional fullscreen onMouseDown here. We used to attach
              `pressBackground` while a swap was pending so a click outside
              slots would cancel the swap, but the SDK latches the
              "UI captures pointer input" state when that handler goes
              active and doesn't fully release it when the prop swings back
              to `undefined` next frame. The result: after starting a swap
              (clicking the first slot), the canvas could no longer
              re-acquire pointer lock on desktop, so PointerEvents on
              placed grills / purifiers stopped firing entirely (no hover
              prompt, no click). Cancel paths that still work: click the
              same slot to deselect, click another slot to swap, or close
              the inventory (which runs cancelSelection internally). */}
          <DestroyBanner />
          {/* All standalone HUD elements hide while ANY panel is up —
              each panel renders its own relevant sub-elements. */}
          {!anyPanel && <BottomBar />}
          {!anyPanel && <StatsBars />}
          {!anyPanel && <ActionButton />}
          {!anyPanel && <ModeToggleButton />}
          {!anyPanel && <InventoryButton />}
          {!anyPanel && <CraftButton />}
          {!anyPanel && <SystemButton />}
          <InventoryPanel />
          <CraftDoubleMenu />
          <CookMenu />
          <StorageMenu />
          {!anyPanel && <RotateButtons />}
          <ChargeReticle />
          <NotificationOverlay />
          <ItemReceivedOverlay />
        </UiEntity>
      </SafeArea>
      {/* System (settings) menu sits OUTSIDE SafeArea so its dark backdrop
          covers the full viewport — on mobile the notch / home-indicator
          strips would otherwise show the live scene through the gaps. The
          modal's own contents are centered, so they stay clear of the
          insets regardless of platform. */}
      <SystemMenu />
      <SafeArea>
        <DebugPanel />
      </SafeArea>
    </UiEntity>
  )
}
