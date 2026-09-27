import { getUpdateNotice } from '../client/multiplayerState'
import { UpdateScreen } from './components/UpdateScreen'
import { isMultiplayer, multiplayerReady, multiplayerStatus } from '../client/multiplayerState'
import { MobileActionControls } from './components/MobileActionControls'
import { RaidStatus } from './components/RaidStatus'
import { PanelBackdrop } from './components/PanelBackdrop'
import { BuilderHint } from './components/BuilderHint'
import { ProximityActions } from './components/ProximityActions'
import { MobileHud } from './components/MobileHud'
import { getMobileLayout } from './mobileLayout'
import { Tutorial } from './components/Tutorial'
import { isMobile } from '@dcl/sdk/platform'
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, InteractableArea } from '@dcl/sdk/react-ecs'

import { ActionButton } from './components/ActionButton'
import { DebugPanel } from './components/DebugPanel'
import { DesktopHud } from './components/DesktopHud'
import { BottomBar } from './components/BottomBar'
import { BuilderControls } from './components/BuilderControls'
import { ConnectingScreen } from './components/ConnectingScreen'
import { ChargeReticle } from './components/ChargeReticle'
import { CookMenu } from './components/CookMenu'
import { CraftDoubleMenu } from './components/CraftMenu'
import { CraftProgressBar } from './components/CraftProgressBar'
import { DeathScreen } from './components/DeathScreen'
import { WinScreen } from './components/WinScreen'
import { DestroyBanner } from './components/DestroyBanner'
import { LobbyMusicButton } from './components/LobbyMusicButton'
import { InventoryPanel } from './components/InventoryPanel'
import { ItemReceivedOverlay } from './components/ItemReceivedNotification'
import { NotificationOverlay } from './components/Notification'
import { StartupScreen } from './components/StartupScreen'
import { StorageMenu } from './components/StorageMenu'
import { SystemMenu } from './components/SystemMenu'
import { isCookOpen } from './cookToggle'
import { isCrafting } from './craftSession'
import { isCraftOpen } from './craftToggle'
import { isGameOver } from './gameOver'
import { isWinActive } from './winScreen'
import { isEquipmentPickerOpen, isInventoryOpen } from './inventoryToggle'
import { isStartupGateActive } from './startupGate'
import { isStorageOpen } from './storageToggle'
import { isSystemMenuOpen } from './systemSession'

// Desktop lays out on 1920×1080; the SDK swaps any 16:9 size for 1600×720 on
// mobile, which is what the mobile HUD constants are tuned for (see
// `getVirtualSize`). Insets are applied explicitly below via `screenInset: 'none'`,
// otherwise the renderer would add a second device wrapper.
export function setupUi(): void {
  ReactEcsRenderer.setUiRenderer(ui, { virtualWidth: 1920, virtualHeight: 1080, screenInset: 'none' })
}

// The renderer uses `screenInset: 'none'`, so the HUD applies its insets here.
// Desktop explorers draw the minimap and chat over the canvas (roughly the left
// quarter) and report them in `UiCanvasInformation.interactableArea`, so the
// desktop HUD sits inside the SDK's InteractableArea. Mobile keeps its own
// layout, which switches to hardware-only insets while the inventory is open.
//
// Insets arrive in canvas pixels; getMobileLayout / InteractableArea convert
// them to virtual pixels so a child sized 100%×100% fills the safe area.
function SafeArea({ children }: { children?: ReactEcs.JSX.ReactNode }): ReactEcs.JSX.Element {
  if (!isMobile()) return <InteractableArea>{children}</InteractableArea>
  const { top, left, right, bottom } = getMobileLayout(isInventoryOpen() && !isStorageOpen())
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
  if (isMultiplayer() && getUpdateNotice()) return <UpdateScreen />
  if (isMultiplayer() && !multiplayerReady()) return (
    <ConnectingScreen />
  )
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
      {anyPanel && <PanelBackdrop transparent={isEquipmentPickerOpen()} />}
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
          {!anyPanel && !isMobile() && <DestroyBanner />}
          {/* All standalone HUD elements hide while ANY panel is up —
              each panel renders its own relevant sub-elements. */}
          {!anyPanel && !isMobile() && <Tutorial />}
          {!anyPanel && !isMobile() && <BottomBar />}
          {!anyPanel && !isMobile() && <ActionButton />}
          {!anyPanel && !isMobile() && <BuilderControls />}
          {!anyPanel && !isMobile() && <DesktopHud />}
          {isMultiplayer() && multiplayerStatus() === 'Confirming…' && <Label
            value="Confirming…" fontSize={16}
            uiTransform={{ positionType: 'absolute', position: { bottom: 16, left: '50%' }, margin: { left: -120 }, width: 240, height: 36 }}
          />}
          <InventoryPanel />
          <CraftDoubleMenu />
          <CookMenu />
          <StorageMenu />

        </UiEntity>
      </SafeArea>
      <NotificationOverlay />
      <ItemReceivedOverlay />
      {(!anyPanel || isEquipmentPickerOpen()) && isMobile() && <MobileHud />}
      {!anyPanel && isMobile() && <MobileActionControls />}
      {!anyPanel && <ChargeReticle />}
      {!anyPanel && <RaidStatus />}
      {!anyPanel && <ProximityActions />}
      {!anyPanel && isMobile() && <BuilderHint />}
      {/* System (settings) menu sits OUTSIDE SafeArea so its dark backdrop
          covers the full viewport — on mobile the notch / home-indicator
          strips would otherwise show the live scene through the gaps. The
          modal's own contents are centered, so they stay clear of the
          insets regardless of platform. */}
      <SystemMenu />
    </UiEntity>
  )
}
