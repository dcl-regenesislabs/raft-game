import ReactEcs,{ Label,UiEntity } from '@dcl/sdk/react-ecs'
import { equipInventorySlot } from '../../systems/nativeEquipment'
import { HANDS_SLOT,getEquippableSlots,getSelectedSlot,isSlotSelectable } from '../inventoryState'
import { getInventorySlot,getItemDisplayName } from '../items'
import { beginUiTouch } from '../mobileControlsState'
import { getMobileLayout } from '../mobileLayout'
import { Panel } from '../panel'
import { HANDS_ICON } from '../theme'
import { UI_ACCENT,UI_CELL,UI_INK,UI_MUTED } from '../visualTheme'
import { MenuList } from './MenuList'

// Anchored directly below Change tool, not a fullscreen inventory modal.
export function ToolPicker(): ReactEcs.JSX.Element {
  const slots = [HANDS_SLOT, ...getEquippableSlots()]
  const height = Math.max(62, Math.min(getMobileLayout(true).height - 140, slots.length * 54 + 16))
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 124, right: 0 }, width: 232 }}>
      <Panel
        uiTransform={{
          width: 232,
          height: height,
          padding: 8,
          flexDirection: 'column'
        }}
      >
        <MenuList
          id="tools"
          height={height - 16}
          rowHeight={54}
        >
          {slots.map((slot) => {
            const item = getInventorySlot(slot)
            const hands = slot === HANDS_SLOT
            const selected = slot === getSelectedSlot()
            const usable = hands || isSlotSelectable(slot)
            return (
              <UiEntity
                key={slot}
                uiTransform={{
                  width: '100%',
                  height: 50,
                  flexShrink: 0,
                  margin: { bottom: 4 },
                  padding: 6,
                  borderRadius: 6,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}
                uiBackground={{ color: selected ? UI_ACCENT : UI_CELL }}
                onMouseDown={beginUiTouch}
                onMouseUp={() => {
                  equipInventorySlot(slot)
                }}
              >
                {item || hands ? (
                  <UiEntity
                    uiTransform={{ width: 32, height: 32, flexShrink: 0 }}
                    uiBackground={{ textureMode: 'stretch', texture: { src: hands ? HANDS_ICON : item!.texture } }}
                  />
                ) : (
                  <Label
                    value="—"
                    fontSize={20}
                    color={UI_MUTED}
                    uiTransform={{ width: 32, height: 32, flexShrink: 0 }}
                  />
                )}
                <Label
                  value={hands ? 'Hands' : item ? getItemDisplayName(item) : `Empty slot ${slot + 1}`}
                  fontSize={14}
                  color={usable ? UI_INK : UI_MUTED}
                  textAlign="middle-left"
                  uiTransform={{ flexGrow: 1, flexShrink: 1, height: 36, margin: { left: 8 } }}
                />
                {selected && <Label value="✓" fontSize={16} uiTransform={{ width: 20, height: 32, flexShrink: 0 }} />}
              </UiEntity>
            )
          })}
        </MenuList>
      </Panel>
    </UiEntity>
  )
}
