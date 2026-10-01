import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { getEquippableSlots, getPressProgress, getSelectedSlot, selectSlot } from '../inventoryState'
import { getInventorySlot } from '../items'
import {
  TOOLBAR_CELL,
  TOOLBAR_GAP,
  TOOLBAR_HEIGHT,
  TOOLBAR_PADDING,
  TOOLBAR_TOGGLE_WIDTH,
  TOOLBAR_VISIBLE
} from '../theme'
import { UI_ACCENT, UI_BORDER, UI_CELL, UI_GLASS, UI_GOLD, UI_INK, UI_MUTED, UI_PAPER } from '../visualTheme'
import { DurabilityBar } from './DurabilityBar'
import { ItemCountBadge } from './ItemCountBadge'

// Desktop tool picker: the equippable tools (the same list as the mobile
// "change tool" dropdown) as a row of cells. Hotkeys 1-4 map to the first four
// cells (see `inventoryInputSystem`); past TOOLBAR_VISIBLE tools a MORE TOOLS
// toggle unfolds the rest above the row.
let expanded = false

export function isToolBarExpanded(): boolean {
  return expanded && getEquippableSlots().length > TOOLBAR_VISIBLE
}

export function getToolBarWidth(): number {
  const row = TOOLBAR_PADDING * 2 + TOOLBAR_VISIBLE * TOOLBAR_CELL + (TOOLBAR_VISIBLE - 1) * TOOLBAR_GAP
  return getEquippableSlots().length > TOOLBAR_VISIBLE ? row + TOOLBAR_GAP + TOOLBAR_TOGGLE_WIDTH : row
}

export function ToolBar(): ReactEcs.JSX.Element {
  const tools = getEquippableSlots()
  const main = tools.slice(0, TOOLBAR_VISIBLE)
  const extra = tools.slice(TOOLBAR_VISIBLE)
  if (extra.length === 0) expanded = false
  const width = getToolBarWidth()
  const selected = getSelectedSlot()
  return (
    <UiEntity uiTransform={{ width, flexDirection: 'column', alignItems: 'center' }}>
      {expanded && (
        <UiEntity
          uiTransform={{
            width,
            padding: { top: TOOLBAR_PADDING, left: TOOLBAR_PADDING },
            margin: { bottom: TOOLBAR_GAP },
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI_BORDER,
            flexDirection: 'row',
            flexWrap: 'wrap'
          }}
          uiBackground={{ color: UI_PAPER }}
        >
          {extra.map((slot) => (
            <ToolCell
              key={slot}
              slot={slot}
              margin={{ right: TOOLBAR_GAP, bottom: TOOLBAR_GAP }}
              onPicked={() => { expanded = false }}
            />
          ))}
        </UiEntity>
      )}
      <UiEntity
        uiTransform={{
          width,
          height: TOOLBAR_HEIGHT,
          padding: TOOLBAR_PADDING,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: UI_BORDER,
          flexDirection: 'row',
          alignItems: 'center'
        }}
        uiBackground={{ color: UI_PAPER }}
      >
        {Array.from({ length: TOOLBAR_VISIBLE }, (_, i) => (
          <ToolCell key={i} slot={main[i] ?? null} hotkey={i < 4 ? i + 1 : null} margin={{ left: i === 0 ? 0 : TOOLBAR_GAP }} />
        ))}
        {extra.length > 0 && (
          <UiEntity
            uiTransform={{
              width: TOOLBAR_TOGGLE_WIDTH,
              height: TOOLBAR_CELL,
              margin: { left: TOOLBAR_GAP },
              borderRadius: 8,
              borderWidth: 1,
              borderColor: extra.includes(selected) ? UI_GOLD : UI_BORDER,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            uiBackground={{ color: expanded ? UI_ACCENT : UI_GLASS }}
            onMouseDown={() => { expanded = !expanded }}
          >
            <Label
              value={expanded ? 'COLLAPSE' : `+${extra.length}`}
              fontSize={expanded ? 13 : 20}
              color={UI_INK}
              uiTransform={{ width: '100%', height: 26 }}
            />
            <Label
              value={expanded ? '∨' : 'MORE TOOLS ∧'}
              fontSize={12}
              color={UI_GOLD}
              uiTransform={{ width: '100%', height: 18 }}
            />
          </UiEntity>
        )}
      </UiEntity>
    </UiEntity>
  )
}

function ToolCell(props: {
  slot: number | null
  hotkey?: number | null
  margin: { left?: number; right?: number; bottom?: number }
  onPicked?: () => void
  key?: number | string
}): ReactEcs.JSX.Element {
  const slot = props.slot
  const item = slot === null ? null : getInventorySlot(slot)
  const selected = slot !== null && slot === getSelectedSlot()
  const press = slot === null ? 0 : getPressProgress(slot)
  // Icon pops outward for a moment after it is equipped.
  const inset = Math.round(10 - 6 * press * press)
  return (
    <UiEntity
      uiTransform={{
        width: TOOLBAR_CELL,
        height: TOOLBAR_CELL,
        flexShrink: 0,
        margin: props.margin,
        borderRadius: 8,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? UI_GOLD : UI_BORDER
      }}
      uiBackground={{ color: selected ? UI_ACCENT : UI_CELL }}
      onMouseDown={() => {
        if (slot === null) return
        selectSlot(slot)
        props.onPicked?.()
      }}
    >
      {item !== null && (
        <UiEntity
          uiTransform={{ positionType: 'absolute', position: { top: inset, left: inset, right: inset, bottom: inset } }}
          uiBackground={{ textureMode: 'stretch', texture: { src: item.texture } }}
        />
      )}
      {props.hotkey != null && (
        <Label
          value={`${props.hotkey}`}
          fontSize={12}
          color={selected ? UI_INK : UI_MUTED}
          uiTransform={{ positionType: 'absolute', position: { top: 2, left: 5 }, width: 12, height: 16 }}
        />
      )}
      <ItemCountBadge item={item} />
      {slot !== null && <DurabilityBar slotIndex={slot} />}
    </UiEntity>
  )
}
