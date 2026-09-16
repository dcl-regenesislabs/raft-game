import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { beginUiTouch } from '../mobileControlsState'
import { protectPanelDismissal, setInventoryOpen } from '../inventoryToggle'
import { setCraftOpen } from '../craftToggle'
import { setCookOpen } from '../cookToggle'
import { closeStorageMenu } from '../storageToggle'
import { setSystemMenuOpen } from '../systemSession'

export function dismissPanels(): void {
  protectPanelDismissal()
  setInventoryOpen(false)
  setCraftOpen(false)
  setCookOpen(false)
  closeStorageMenu()
  setSystemMenuOpen(false)
}

// Mount only while a panel is open: never toggle handlers on the persistent
// canvas, which can leave desktop pointer capture latched in the renderer.
export function PanelBackdrop({ transparent = false }: { transparent?: boolean }): ReactEcs.JSX.Element {
  return <UiEntity
    uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }}
    uiBackground={{ color: Color4.create(0.01, 0.04, 0.06, transparent ? 0 : 0.55) }}
    onMouseDown={beginUiTouch}
    onMouseUp={dismissPanels}
  />
}
