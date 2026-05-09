import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { requestLoad, requestSave, requestWipe } from '../../client/saveClient'
import { Panel } from '../panel'
import {
  getSystemConfirm,
  getSystemStatus,
  isSystemMenuOpen,
  setSystemConfirm,
  setSystemMenuOpen,
  type SystemConfirm,
  type SystemStatus
} from '../systemSession'
import {
  CRAFT_BUTTON_FG,
  CRAFT_BUTTON_H,
  CRAFT_BUTTON_TEXTURE,
  CRAFT_TEXT_COLOR,
  CRAFT_TEXT_DIM_COLOR
} from '../theme'

// Modal sized to fit the three primary actions in a column with breathing
// room for a status line and an optional confirm step. Centered with the
// rest of the panel-style modals (death screen, craft menu).
const PANEL_WIDTH = 560
const PANEL_HEIGHT = 460
const BACKDROP_COLOR = Color4.create(0, 0, 0, 0.55)

// Wider, full-width-feeling buttons for the system menu. We render the red
// button texture as nine-slices so the painted side bevels keep their
// pixel size at any width — only the red center stretches.
const SYSTEM_BUTTON_W = 320
const SYSTEM_BUTTON_H = CRAFT_BUTTON_H
const SYSTEM_BUTTON_INLINE_W = 200
const SYSTEM_BUTTON_SLICE = { top: 0.2, right: 0.16, bottom: 0.2, left: 0.16 }

export function SystemMenu(): ReactEcs.JSX.Element | null {
  if (!isSystemMenuOpen()) return null
  const confirm = getSystemConfirm()
  const status = getSystemStatus()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: BACKDROP_COLOR }}
    >
      <Panel
        uiTransform={{
          width: PANEL_WIDTH,
          height: PANEL_HEIGHT,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: { top: 48, bottom: 32, left: 24, right: 24 }
        }}
      >
        <Label
          value="SYSTEM"
          fontSize={36}
          color={CRAFT_TEXT_COLOR}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 56 }}
        />
        <Label
          value="Save your progress, reload your last save, or restart from scratch."
          fontSize={16}
          color={CRAFT_TEXT_DIM_COLOR}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 44, margin: { top: 8 } }}
        />
        {confirm === null ? (
          <ActionColumn />
        ) : (
          <ConfirmColumn kind={confirm} />
        )}
        <StatusLine status={status} />
        <CloseButton />
      </Panel>
    </UiEntity>
  )
}

function ActionColumn(): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 220,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: { top: 16 }
      }}
    >
      <SystemActionButton
        label="SAVE"
        onPress={() => {
          setSystemMenuOpen(false)
          void requestSave()
        }}
      />
      <SystemActionButton
        label="LOAD"
        onPress={() => {
          setSystemConfirm('load')
        }}
      />
      <SystemActionButton
        label="RESTART"
        onPress={() => {
          setSystemConfirm('restart')
        }}
      />
    </UiEntity>
  )
}

function ConfirmColumn(props: { kind: SystemConfirm }): ReactEcs.JSX.Element {
  const isRestart = props.kind === 'restart'
  const headline = isRestart
    ? 'Wipe ALL progress and start over?'
    : 'Reload last save and discard local changes?'
  const sub = isRestart
    ? 'Your saved game on the server will be deleted. This cannot be undone.'
    : 'Anything you did since your last Save will be lost.'
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 220,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: { top: 16 }
      }}
    >
      <Label
        value={headline}
        fontSize={20}
        color={CRAFT_TEXT_COLOR}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: 32 }}
      />
      <Label
        value={sub}
        fontSize={14}
        color={CRAFT_TEXT_DIM_COLOR}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: 28, margin: { top: 4 } }}
      />
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 80,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          margin: { top: 16 }
        }}
      >
        <SystemActionButton
          label="CANCEL"
          onPress={() => setSystemConfirm(null)}
          inline
        />
        <SystemActionButton
          label={isRestart ? 'CONFIRM' : 'RELOAD'}
          onPress={() => {
            setSystemConfirm(null)
            setSystemMenuOpen(false)
            if (isRestart) {
              void requestWipe()
            } else {
              void requestLoad(false)
            }
          }}
          inline
        />
      </UiEntity>
    </UiEntity>
  )
}

function SystemActionButton(props: {
  label: string
  onPress: () => void
  inline?: boolean
}): ReactEcs.JSX.Element {
  const inline = props.inline === true
  const width = inline ? SYSTEM_BUTTON_INLINE_W : SYSTEM_BUTTON_W
  const margin = inline ? { left: 12, right: 12 } : { top: 8 }
  return (
    <UiEntity
      uiTransform={{
        width,
        height: SYSTEM_BUTTON_H,
        alignItems: 'center',
        justifyContent: 'center',
        margin
      }}
      uiBackground={{
        textureMode: 'nine-slices',
        texture: { src: CRAFT_BUTTON_TEXTURE },
        textureSlices: SYSTEM_BUTTON_SLICE
      }}
      onMouseDown={props.onPress}
    >
      <Label
        value={props.label}
        fontSize={18}
        color={CRAFT_BUTTON_FG}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: '100%' }}
      />
    </UiEntity>
  )
}

function StatusLine(props: { status: SystemStatus }): ReactEcs.JSX.Element {
  const label = describeStatus(props.status)
  return (
    <Label
      value={label}
      fontSize={14}
      color={CRAFT_TEXT_DIM_COLOR}
      textAlign="middle-center"
      uiTransform={{ width: '100%', height: 28, margin: { top: 12 } }}
    />
  )
}

function describeStatus(status: SystemStatus): string {
  switch (status.kind) {
    case 'idle':
      return ''
    case 'saving':
      return 'Saving…'
    case 'loading':
      return 'Loading…'
    case 'wiping':
      return 'Restarting…'
    case 'saved':
      return 'Saved.'
    case 'loaded':
      return status.found ? 'Loaded.' : 'No saved game found yet.'
    case 'wiped':
      return 'Save wiped. Fresh start.'
    case 'error':
      return `Error: ${status.message}`
  }
}

function CloseButton(): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: SYSTEM_BUTTON_W,
        height: SYSTEM_BUTTON_H,
        alignItems: 'center',
        justifyContent: 'center',
        margin: { top: 16 }
      }}
      uiBackground={{
        textureMode: 'nine-slices',
        texture: { src: CRAFT_BUTTON_TEXTURE },
        textureSlices: SYSTEM_BUTTON_SLICE
      }}
      onMouseDown={() => setSystemMenuOpen(false)}
    >
      <Label
        value="CLOSE"
        fontSize={18}
        color={CRAFT_BUTTON_FG}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: '100%' }}
      />
    </UiEntity>
  )
}
