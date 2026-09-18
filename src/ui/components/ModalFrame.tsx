import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { getMobileLayout } from '../mobileLayout'

// Backdrop fills the viewport; contents stay inside the usable safe area.
export function ModalFrame(props: { children?: ReactEcs.JSX.Element | null; alpha?: number; deviceInset?: boolean }): ReactEcs.JSX.Element {
  const area = getMobileLayout(props.deviceInset ?? false)
  const inset = isMobile()
    ? { top: area.top, left: area.left, right: area.right, bottom: area.bottom }
    : { top: 0, left: 0, right: 0, bottom: 0 }
  return (
    <UiEntity
      uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }}
      uiBackground={{ color: Color4.create(0.01, 0.04, 0.06, props.alpha ?? 0.55) }}
    >
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: inset,
          padding: 16,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {props.children}
      </UiEntity>
    </UiEntity>
  )
}
