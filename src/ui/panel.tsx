import { beginUiTouch } from './mobileControlsState'
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import type { UiTransformProps } from '@dcl/sdk/react-ecs'
import { UI_PAPER, UI_BORDER, UI_GOLD } from './visualTheme'

export interface PanelProps {
  accent?: boolean
  uiTransform?: UiTransformProps
  children?: ReactEcs.JSX.Element | (ReactEcs.JSX.Element | null)[] | null
}
export function Panel(props: PanelProps): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{ ...props.uiTransform, borderRadius: 16, borderWidth: 1, borderColor: UI_BORDER }}
      uiBackground={{ color: UI_PAPER }}
      onMouseDown={beginUiTouch}
      onMouseUp={beginUiTouch}
    >
      {props.accent !== false && (
        <UiEntity
          uiTransform={{ positionType: 'absolute', position: { top: 0, left: 24 }, width: 64, height: 3 }}
          uiBackground={{ color: UI_GOLD }}
        />
      )}
      {props.children}
    </UiEntity>
  )
}
