import { isMusicMuted, toggleMusicMuted } from '../../audio/music'
import { forceIslandSpawn } from '../../systems/islandSpawner'
import { triggerSharkAttack } from '../../systems/sharkDirector'
import { armBoatChefEvent } from '../../systems/boatChefDirector'
import { getMobileLayout } from '../mobileLayout'
import { beginUiTouch } from '../mobileControlsState'
import { showTutorial } from '../tutorialState'
import { UI_ACCENT, UI_CELL, UI_INK, UI_MUTED } from '../visualTheme'
import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { requestLoad, requestSave, requestWipe } from '../../client/saveClient'
import { DEBUG_MODE } from '../../config/gameConfig'
import { activateDebugMode, isDebugRun, returnToLobby } from '../../runtime/sceneFlow'
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
import { CRAFT_BUTTON_FG, CRAFT_BUTTON_H, CRAFT_BUTTON_TEXTURE, CRAFT_TEXT_COLOR, CRAFT_TEXT_DIM_COLOR } from '../theme'

const PANEL_WIDTH = 480
const PANEL_HEIGHT = 460
const BACKDROP_COLOR = Color4.create(0, 0, 0, 0.55)

const SYSTEM_BUTTON_W = 200
const SYSTEM_BUTTON_H = CRAFT_BUTTON_H
const SYSTEM_BUTTON_INLINE_W = 160
const SYSTEM_BUTTON_GAP = 12
const SYSTEM_BUTTON_SLICE = { top: 0.2, right: 0.16, bottom: 0.2, left: 0.16 }

let debugToolsOpen = false

export function SystemMenu(): ReactEcs.JSX.Element | null {
  if (!isSystemMenuOpen()) {
    debugToolsOpen = false
    return null
  }
  const confirm = getSystemConfirm()
  const detail = confirm ? describeConfirm(confirm) : null
  const width = Math.min(560, getMobileLayout().width - 32)
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: BACKDROP_COLOR }}
    >
      <Panel uiTransform={{ width, padding: 24, flexDirection: 'column' }}>
        <Label
          value={detail ? 'CONFIRM ACTION' : debugToolsOpen ? 'DEBUG TOOLS' : 'SURVIVAL MENU'}
          fontSize={28}
          color={UI_INK}
          textAlign="middle-left"
          uiTransform={{ width: width - 100, height: 44 }}
        />
        <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 12, right: 12 } }}>
          <XButton onPress={() => setSystemMenuOpen(false)} />
        </UiEntity>
        {detail ? (
          <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
            <Label value={detail.headline} fontSize={20} color={UI_INK} uiTransform={{ width: '100%', height: 64 }} />
            <Label value={detail.sub} fontSize={16} color={UI_MUTED} uiTransform={{ width: '100%', height: 70 }} />
            <SystemActionButton label="GO BACK" onPress={() => setSystemConfirm(null)} />
            <SystemActionButton
              label={detail.confirmLabel}
              onPress={() => {
                setSystemMenuOpen(false)
                runConfirmAction(confirm!)
              }}
            />
          </UiEntity>
        ) : debugToolsOpen ? (
          <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
            {!isDebugRun() && (
              <SystemActionButton
                label="START DEBUG PLAYTEST"
                onPress={() => {
                  setSystemMenuOpen(false)
                  activateDebugMode()
                }}
              />
            )}
            <SystemActionButton
              label="SPAWN ISLAND"
              onPress={() => {
                setSystemMenuOpen(false)
                forceIslandSpawn()
              }}
            />
            <SystemActionButton
              label="SHARK ATTACK"
              onPress={() => {
                setSystemMenuOpen(false)
                triggerSharkAttack()
              }}
            />
            <SystemActionButton
              label="SPAWN CHEF"
              onPress={() => {
                setSystemMenuOpen(false)
                armBoatChefEvent()
              }}
            />
            <SystemActionButton
              label="BACK"
              onPress={() => {
                debugToolsOpen = false
              }}
            />
          </UiEntity>
        ) : (
          <UiEntity uiTransform={{ width: '100%', flexDirection: 'column' }}>
            <Label
              value="Tools, survival help and your current session."
              fontSize={16}
              color={UI_MUTED}
              textAlign="middle-left"
              uiTransform={{ width: '100%', height: 36 }}
            />
            <SystemActionButton label="RESUME GAME" onPress={() => setSystemMenuOpen(false)} />
            <SystemActionButton
              label="SHOW SURVIVAL GUIDE"
              onPress={() => {
                showTutorial()
                setSystemMenuOpen(false)
              }}
            />
            <Label
              value="Change tool: top-right tool button. Hold the action button to cast. Aim at a target for contextual actions."
              fontSize={16}
              color={UI_INK}
              textAlign="top-left"
              uiTransform={{ width: '100%', height: 78, margin: { top: 14 } }}
            />
            <SystemActionButton label={isMusicMuted() ? 'MUSIC: OFF' : 'MUSIC: ON'} onPress={toggleMusicMuted} />
            {DEBUG_MODE && (
              <SystemActionButton
                label="DEBUG TOOLS"
                onPress={() => {
                  debugToolsOpen = true
                }}
              />
            )}
            <Label
              value="SESSION"
              fontSize={12}
              color={UI_MUTED}
              textAlign="middle-left"
              uiTransform={{ width: '100%', height: 28 }}
            />
            <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between' }}>
              <SystemActionButton
                label="SAVE"
                inline
                onPress={() => {
                  void requestSave()
                }}
              />
              <SystemActionButton label="LOAD" inline onPress={() => setSystemConfirm('load')} />
              <SystemActionButton label="LOBBY" inline onPress={() => setSystemConfirm('lobby')} />
              <SystemActionButton label="RESTART" inline onPress={() => setSystemConfirm('restart')} />
            </UiEntity>
          </UiEntity>
        )}
        <StatusLine status={getSystemStatus()} />
      </Panel>
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

function SystemActionButton(props: { label: string; onPress: () => void; inline?: boolean }): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{ width: props.inline ? '23%' : '100%', height: 48, margin: { top: 8 }, borderRadius: 8 }}
      uiBackground={{ color: props.inline ? UI_CELL : UI_ACCENT }}
      onMouseDown={beginUiTouch}
      onMouseUp={props.onPress}
    >
      <Label
        value={props.label}
        fontSize={props.inline ? 13 : 17}
        color={props.inline ? UI_INK : Color4.White()}
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
  return <SystemActionButton label="CLOSE" onPress={() => setSystemMenuOpen(false)} />
}
