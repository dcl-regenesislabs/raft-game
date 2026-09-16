import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Panel } from '../panel'
import { getMobileLayout } from '../mobileLayout'
import { beginUiTouch } from '../mobileControlsState'
import { UI_ACCENT, UI_CELL, UI_INK, UI_MUTED, UI_GOLD } from '../visualTheme'
import { ModalFrame } from './ModalFrame'

export function OutcomeScreen(props: {
  title: string
  message: string
  detail?: string
  backdrop: number
  fade: number
  primary: { label: string; action: () => void }
  secondary?: { label: string; action: () => void }
}): ReactEcs.JSX.Element {
  const area = getMobileLayout()
  return (
    <ModalFrame alpha={props.backdrop}>
      {props.fade > 0 ? (
        <Panel
          uiTransform={{
            width: Math.min(520, area.width - 32),
            maxHeight: area.height - 32,
            padding: 24,
            opacity: props.fade,
            flexDirection: 'column'
          }}
        >
          <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', overflow: 'scroll' }}>
            <Label
              value={props.title}
              fontSize={38}
              color={UI_INK}
              uiTransform={{ width: '100%', height: 64, flexShrink: 0 }}
            />
            {props.detail && (
              <Label
                value={props.detail}
                fontSize={26}
                color={UI_GOLD}
                uiTransform={{ width: '100%', height: 44, flexShrink: 0 }}
              />
            )}
            <Label
              value={props.message}
              fontSize={18}
              color={UI_MUTED}
              uiTransform={{ width: '100%', height: 64, flexShrink: 0, margin: { bottom: 12 } }}
            />
            {[props.primary, props.secondary].map((button, index) =>
              button ? (
                <UiEntity
                  key={button.label}
                  uiTransform={{ width: '100%', height: 52, flexShrink: 0, borderRadius: 8, margin: { top: 12 } }}
                  uiBackground={{ color: index === 0 ? UI_ACCENT : UI_CELL }}
                  onMouseDown={beginUiTouch}
                  onMouseUp={() => {
                    if (props.fade < 0.95) return
                    beginUiTouch()
                    button.action()
                  }}
                >
                  <Label
                    value={button.label}
                    fontSize={17}
                    color={UI_INK}
                    uiTransform={{ width: '100%', height: '100%' }}
                  />
                </UiEntity>
              ) : null
            )}
          </UiEntity>
        </Panel>
      ) : null}
    </ModalFrame>
  )
}
