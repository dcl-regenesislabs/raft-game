import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { requestLoad, requestSave, requestWipe } from '../../client/saveClient'
import { returnToLobby } from '../../runtime/sceneFlow'
import { CloseButton as XButton } from './CloseButton'
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

const PANEL_WIDTH = 480
const PANEL_HEIGHT = 460
const BACKDROP_COLOR = Color4.create(0, 0, 0, 0.55)

const SYSTEM_BUTTON_W = 200
const SYSTEM_BUTTON_H = CRAFT_BUTTON_H
const SYSTEM_BUTTON_INLINE_W = 160
const SYSTEM_BUTTON_GAP = 12
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
          padding: { top: 36, bottom: 24, left: 24, right: 24 }
        }}
      >
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: -8, right: -8 }
          }}
        >
          <XButton onPress={() => setSystemMenuOpen(false)} />
        </UiEntity>
        <Label
          value="SYSTEM"
          fontSize={32}
          color={CRAFT_TEXT_COLOR}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 44 }}
        />
        <Label
          value="Save, reload, return to the lobby, or wipe and start over."
          fontSize={14}
          color={CRAFT_TEXT_DIM_COLOR}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 32, margin: { top: 4 } }}
        />
        <UiEntity uiTransform={{ flexGrow: 1 }} />
        {confirm === null ? (
          <ActionColumn />
        ) : (
          <ConfirmColumn kind={confirm} />
        )}
        <StatusLine status={status} />
        <UiEntity uiTransform={{ flexGrow: 1 }} />
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
        flexDirection: 'row',
        justifyContent: 'center',
        margin: { top: 16 }
      }}
    >
      <UiEntity
        uiTransform={{
          flexDirection: 'column',
          alignItems: 'center',
          margin: { right: SYSTEM_BUTTON_GAP }
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
      </UiEntity>
      <UiEntity
        uiTransform={{
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <SystemActionButton
          label="LOBBY"
          onPress={() => {
            setSystemConfirm('lobby')
          }}
        />
        <SystemActionButton
          label="RESTART"
          onPress={() => {
            setSystemConfirm('restart')
          }}
        />
      </UiEntity>
    </UiEntity>
  )
}

function ConfirmColumn(props: { kind: SystemConfirm }): ReactEcs.JSX.Element {
  const { headline, sub, confirmLabel } = describeConfirm(props.kind)
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 280,
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
          label={confirmLabel}
          onPress={() => {
            setSystemConfirm(null)
            setSystemMenuOpen(false)
            runConfirmAction(props.kind)
          }}
          inline
        />
      </UiEntity>
    </UiEntity>
  )
}

function describeConfirm(kind: SystemConfirm): {
  headline: string
  sub: string
  confirmLabel: string
} {
  switch (kind) {
    case 'restart':
      return {
        headline: 'Wipe ALL progress and start over?',
        sub: 'Your saved game on the server will be deleted. This cannot be undone.',
        confirmLabel: 'CONFIRM'
      }
    case 'load':
      return {
        headline: 'Reload last save and discard local changes?',
        sub: 'Anything you did since your last Save will be lost.',
        confirmLabel: 'RELOAD'
      }
    case 'lobby':
      return {
        headline: 'Return to the lobby?',
        sub: 'The current world will be torn down. SAVE first if you want to keep it.',
        confirmLabel: 'RETURN'
      }
    default:
      // Unreachable — ConfirmColumn is only rendered when confirm !== null.
      return { headline: '', sub: '', confirmLabel: '' }
  }
}

function runConfirmAction(kind: SystemConfirm): void {
  switch (kind) {
    case 'restart':
      void requestWipe()
      return
    case 'load':
      void requestLoad(false)
      return
    case 'lobby':
      returnToLobby()
      return
  }
}

function SystemActionButton(props: {
  label: string
  onPress: () => void
  inline?: boolean
}): ReactEcs.JSX.Element {
  const inline = props.inline === true
  const width = inline ? SYSTEM_BUTTON_INLINE_W : SYSTEM_BUTTON_W
  const margin = inline ? { left: 12, right: 12 } : { top: 40 }
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
      uiTransform={{ width: '100%', height: 24, margin: { top: 4 } }}
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
    <SystemActionButton
      label="CLOSE"
      onPress={() => setSystemMenuOpen(false)}
    />
  )
}
