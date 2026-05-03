import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'

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
export function setupUi(): void {
  ReactEcsRenderer.setUiRenderer(ui)
}

function ui(): ReactEcs.JSX.Element {
  // While a craft is running every interactive HUD element hides — the
  // player can't act, only watch the progress bar fill. The bar reuses
  // the hook charge meter style for visual consistency.
  if (isCrafting()) {
    return (
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%',
          positionType: 'absolute'
        }}
      >
        <CraftProgressBar />
        <NotificationOverlay />
      </UiEntity>
    )
  }

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
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
  )
}
