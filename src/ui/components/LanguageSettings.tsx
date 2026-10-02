import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { getLanguagePreference, LanguagePreference, setLanguagePreference, t } from '../../i18n/index'
import { beginUiTouch } from '../mobileControlsState'
import { UI_ACCENT, UI_CELL, UI_INK, UI_MUTED } from '../visualTheme'

const options: ReadonlyArray<readonly [LanguagePreference, string]> = [
  ['default', 'DEFAULT'],
  ['en', 'ENGLISH'],
  ['es', 'ESPAÑOL'],
  ['pt', 'PORTUGUÊS']
]

export function LanguageSettings(): ReactEcs.JSX.Element {
  return (
    <UiEntity uiTransform={{ width: '100%', flexDirection: 'column', flexShrink: 0, margin: { top: 8 } }}>
      <Label value={t('LANGUAGE')} color={UI_INK} fontSize={16} textAlign="middle-left" uiTransform={{ width: '100%', height: 26 }} />
      <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap' }}>
        {options.map(([value, label]) => (
          <UiEntity
            key={value}
            uiTransform={{ width: '48%', height: 38, margin: { right: '2%', bottom: 4 }, borderRadius: 6 }}
            uiBackground={{ color: getLanguagePreference() === value ? UI_ACCENT : UI_CELL }}
            onMouseDown={beginUiTouch}
            onMouseUp={() => setLanguagePreference(value)}
          >
            <Label value={value === 'default' ? t(label) : label} color={UI_INK} fontSize={14} uiTransform={{ width: '100%', height: '100%' }} />
          </UiEntity>
        ))}
      </UiEntity>
      <Label value={t('DEFAULT follows the Explorer language.')} color={UI_MUTED} fontSize={13} uiTransform={{ width: '100%', height: 32 }} />
    </UiEntity>
  )
}
