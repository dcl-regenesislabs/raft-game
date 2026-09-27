import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { beginUiTouch } from '../mobileControlsState'
import { getStat } from '../statsBars'
import { STAT_ICON_TEXTURES } from '../theme'
import { UI_ACCENT, UI_GLASS } from '../visualTheme'

// Shared by the mobile and desktop HUD clusters so both platforms read the same.
export const HUD_CLUSTER_WIDTH = 392
export const HUD_ICON_SIZE = 64
export const HUD_ROW_GAP = 8

const VITALS = [
  { kind: 'life' as const, color: Color4.create(0.96, 0.36, 0.34, 1) },
  { kind: 'hunger' as const, color: Color4.create(1, 0.72, 0.26, 1) },
  { kind: 'thirst' as const, color: Color4.create(0.27, 0.76, 1, 1) }
]

export function VitalsRow(): ReactEcs.JSX.Element {
  return (
    <UiEntity uiTransform={{ width: HUD_CLUSTER_WIDTH, height: 44, flexDirection: 'row', justifyContent: 'space-between' }}>
      {VITALS.map((vital) => {
        const value = Math.max(0, getStat(vital.kind))
        return (
          <UiEntity
            key={vital.kind}
            uiTransform={{
              width: 125,
              height: 44,
              padding: 8,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center'
            }}
            uiBackground={{ color: UI_GLASS }}
          >
            <UiEntity
              uiTransform={{ width: 26, height: 26, margin: { right: 8 } }}
              uiBackground={{ textureMode: 'stretch', texture: { src: STAT_ICON_TEXTURES[vital.kind] } }}
            />
            <UiEntity
              uiTransform={{ width: 75, height: 8, borderRadius: 3 }}
              uiBackground={{ color: Color4.create(1, 1, 1, 0.12) }}
            >
              <UiEntity
                uiTransform={{ width: 75 * Math.min(value, 1), height: 8, borderRadius: 3 }}
                uiBackground={{ color: vital.color }}
              />
            </UiEntity>
          </UiEntity>
        )
      })}
    </UiEntity>
  )
}

export function HudIcon(props: {
  icon: string
  label: string
  onPress: () => void
  active?: boolean
  marginLeft?: number
}): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{ width: HUD_ICON_SIZE, height: HUD_ICON_SIZE, borderRadius: 8, margin: { left: props.marginLeft ?? 0 } }}
      uiBackground={{ color: props.active ? UI_ACCENT : UI_GLASS }}
      onMouseDown={beginUiTouch}
      onMouseUp={props.onPress}
    >
      <UiEntity
        uiTransform={{ positionType: 'absolute', position: { top: 12, left: 12 }, width: 40, height: 40 }}
        uiBackground={{ textureMode: 'stretch', texture: { src: props.icon } }}
      />
    </UiEntity>
  )
}
