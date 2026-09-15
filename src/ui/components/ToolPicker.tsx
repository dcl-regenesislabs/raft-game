import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { equipInventorySlot } from '../../systems/nativeEquipment'
import { getInventorySlot, getItemDisplayName } from '../items'
import { HANDS_SLOT, getSelectedSlot, isSlotSelectable, getEquippableSlots } from '../inventoryState'
import { HANDS_ICON } from '../theme'
import { beginUiTouch } from '../mobileControlsState'
import { UI_ACCENT, UI_INK, UI_MUTED, UI_CELL } from '../visualTheme'
import { Panel } from '../panel'

// Anchored directly below Change tool, not a fullscreen inventory modal.
export function ToolPicker(): ReactEcs.JSX.Element {
  const slots = [HANDS_SLOT, ...getEquippableSlots()]
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 124, right: 0 }, width: 232 }}>
      <Panel
        uiTransform={{
          width: 232,
          height: Math.max(62, Math.min(316, slots.length * 50 + 16)),
          padding: 8,
          flexDirection: 'column'
        }}
      >
        <UiEntity uiTransform={{ width: '100%', flexGrow: 1, flexDirection: 'column', overflow: 'scroll' }}>
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
                  height: 46,
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
                    uiTransform={{ width: 32, height: 32 }}
                    uiBackground={{ textureMode: 'stretch', texture: { src: hands ? HANDS_ICON : item!.texture } }}
                  />
                ) : (
                  <Label value="—" fontSize={20} color={UI_MUTED} uiTransform={{ width: 32, height: 32 }} />
                )}
                <Label
                  value={hands ? 'Hands' : item ? getItemDisplayName(item) : `Empty slot ${slot + 1}`}
                  fontSize={14}
                  color={usable ? UI_INK : UI_MUTED}
                  textAlign="middle-left"
                  uiTransform={{ width: 140, height: 32, margin: { left: 8 } }}
                />
                {selected && <Label value="✓" fontSize={16} uiTransform={{ width: 20, height: 32 }} />}
              </UiEntity>
            )
          })}
        </UiEntity>
      </Panel>
    </UiEntity>
  )
}
