import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { isCraftOpen, toggleCraft } from '../craftToggle'
import { isInventoryOpen, toggleInventory } from '../inventoryToggle'
import { isSystemMenuOpen } from '../systemSession'
import { toggleSystemMenu } from '../systemToggle'
import { CRAFT_BUTTON_ICON, INVENTORY_BUTTON_ICON, SYSTEM_BUTTON_ICON } from '../theme'
import { HUD_CLUSTER_WIDTH, HUD_ROW_GAP, HudIcon, VitalsRow } from './HudPieces'

// Desktop twin of the mobile cluster: vitals over the menu toggles, pinned to
// the padded canvas's top-right corner (SafeArea preserves left-side clearance
// for the explorer's minimap and chat). Tools live in the bottom tool bar instead of
// the mobile "change tool" dropdown.
export function DesktopHud(): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, right: 0 },
        width: HUD_CLUSTER_WIDTH,
        flexDirection: 'column',
        alignItems: 'flex-end'
      }}
    >
      <VitalsRow />
      <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: HUD_ROW_GAP } }}>
        <HudIcon icon={CRAFT_BUTTON_ICON} label="CRAFT" active={isCraftOpen()} onPress={toggleCraft} />
        <HudIcon icon={INVENTORY_BUTTON_ICON} label="PACK" active={isInventoryOpen()} onPress={toggleInventory} marginLeft={HUD_ROW_GAP} />
        <HudIcon icon={SYSTEM_BUTTON_ICON} label="MENU" active={isSystemMenuOpen()} onPress={toggleSystemMenu} marginLeft={HUD_ROW_GAP} />
      </UiEntity>
    </UiEntity>
  )
}
