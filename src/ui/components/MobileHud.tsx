import ReactEcs,{ Label,UiEntity } from '@dcl/sdk/react-ecs'
import { isFishingLineActive } from '../../systems/fishingRod'
import { PLATFORM_COST,getPlatformMaterialAvailable } from '../../systems/raft/platformCost'
import { getRaftBuilderMode } from '../../systems/raftBuilder'
import { resolveMobileControls } from '../../systems/touchControls'
import { toggleCraft } from '../craftToggle'
import { getSelectedSlot } from '../inventoryState'
import {
isEquipmentPickerOpen,
openEquipmentPicker,
setInventoryOpen,
showBackpack,
toggleInventory
} from '../inventoryToggle'
import { getInventorySlot,getItemDisplayName } from '../items'
import { beginUiTouch } from '../mobileControlsState'
import { getMobileLayout } from '../mobileLayout'
import { toggleSystemMenu } from '../systemToggle'
import { CRAFT_BUTTON_ICON,HANDS_ICON,INVENTORY_BUTTON_ICON,SYSTEM_BUTTON_ICON } from '../theme'
import { UI_BORDER,UI_GLASS,UI_GOLD,UI_INK } from '../visualTheme'
import { DurabilityBar } from './DurabilityBar'
import { HUD_CLUSTER_WIDTH,HudIcon,VitalsRow } from './HudPieces'
import { ToolPicker } from './ToolPicker'
import { Tutorial } from './Tutorial'

const WIDTH = HUD_CLUSTER_WIDTH
export function MobileHud(): ReactEcs.JSX.Element {
  const area = getMobileLayout(true)
  const item = getInventorySlot(getSelectedSlot())
  const picker = isEquipmentPickerOpen()
  const status =
    getRaftBuilderMode() === 'placing'
      ? PLATFORM_COST.map(({ id, amount }) => `${id} ${getPlatformMaterialAvailable(id)}/${amount}`).join(' · ')
      : isFishingLineActive()
        ? resolveMobileControls().pointer.label
        : null
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { right: area.right, top: area.top },
        width: WIDTH,
        height: 100
      }}
    >
      <VitalsRow />
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { right: 0, top: 52 },
          width: WIDTH,
          height: 64,
          flexDirection: 'row',
          justifyContent: 'space-between'
        }}
      >
        <HudIcon icon={CRAFT_BUTTON_ICON} label="CRAFT" onPress={toggleCraft} />
        <HudIcon
          icon={INVENTORY_BUTTON_ICON}
          label="PACK"
          onPress={() => {
            if (picker) showBackpack()
            else toggleInventory()
          }}
        />
        <HudIcon icon={SYSTEM_BUTTON_ICON} label="MENU" onPress={toggleSystemMenu} />
        <UiEntity
          uiTransform={{
            width: 176,
            height: 64,
            padding: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: UI_BORDER,
            flexDirection: 'row',
            alignItems: 'center'
          }}
          uiBackground={{ color: UI_GLASS }}
          onMouseDown={beginUiTouch}
          onMouseUp={() => {
            if (picker) setInventoryOpen(false)
            else openEquipmentPicker()
          }}
        >
          <UiEntity uiTransform={{ width: 40, height: 44 }}>
            {
              <UiEntity
                uiTransform={{ width: 38, height: 38 }}
                uiBackground={{ textureMode: 'stretch', texture: { src: item?.texture ?? HANDS_ICON } }}
              />
            }
            <DurabilityBar slotIndex={getSelectedSlot()} />
          </UiEntity>
          <UiEntity uiTransform={{ width: 118, height: 40, flexDirection: 'column' }}>
            <Label
              value={item ? getItemDisplayName(item) : 'Hands'}
              fontSize={16}
              color={UI_INK}
              textAlign="middle-left"
              uiTransform={{ width: 118, height: 22 }}
            />
            <Label
              value={picker ? 'CLOSE  ∧' : 'CHANGE TOOL  ∨'}
              fontSize={12}
              color={UI_GOLD}
              textAlign="middle-left"
              uiTransform={{ width: 118, height: 18 }}
            />
          </UiEntity>
        </UiEntity>
      </UiEntity>
      {picker ? <ToolPicker /> : <Tutorial />}
      {!picker && status && (
        <Label
          value={status}
          fontSize={13}
          color={UI_GOLD}
          textAlign="middle-right"
          uiTransform={{ positionType: 'absolute', position: { top: 138, right: 0 }, width: WIDTH, height: 22 }}
        />
      )}
    </UiEntity>
  )
}
