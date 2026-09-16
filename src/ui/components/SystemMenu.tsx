import { startChapterFixture, startTutorialCraftFixture } from '../../progression/fixtures'
import { triggerGameOver, playAgain } from '../gameOver'
import { startTestMode } from '../gameOver'
import { campaignMode, chapter, serializeProgress } from '../../progression/state'
import { startRaid, debugAdvanceExpansion } from '../../expansion/runtime'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import ReactEcs,{ Label,UiEntity } from '@dcl/sdk/react-ecs'
import { isMusicMuted,toggleMusicMuted } from '../../audio/music'
import { armBoatChefEvent } from '../../systems/boatChefDirector'
import { forceIslandSpawn } from '../../systems/islandSpawner'
import { triggerSharkAttack } from '../../systems/sharkDirector'
import { beginUiTouch } from '../mobileControlsState'
import { getMobileLayout } from '../mobileLayout'
import { showTutorial } from '../tutorialState'
import { UI_ACCENT,UI_CELL,UI_INK,UI_MUTED } from '../visualTheme'
import { ModalFrame } from './ModalFrame'

import { requestLoad,requestSave } from '../../client/saveClient'
import { DEBUG_MODE } from '../../config/gameConfig'
import { isDebugRun,returnToLobby } from '../../runtime/sceneFlow'
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
import { CRAFT_TEXT_DIM_COLOR } from '../theme'
import { CloseButton as XButton } from './CloseButton'

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
    <ModalFrame>
      <Panel
        uiTransform={{
          width,
          height: Math.min(580, getMobileLayout().height - 32),
          padding: 20,
          flexDirection: 'column'
        }}
      >
        <Label
          value={detail ? 'CONFIRM ACTION' : debugToolsOpen ? 'DEBUG TOOLS' : 'SURVIVAL MENU'}
          fontSize={28}
          color={UI_INK}
          textAlign="middle-left"
          uiTransform={{ width: width - 100, height: 48, flexShrink: 0 }}
        />
        <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 12, right: 12 } }}>
          <XButton onPress={() => setSystemMenuOpen(false)} />
        </UiEntity>
        <UiEntity
          uiTransform={{ width: '100%', flexGrow: 1, flexDirection: 'column', overflow: 'scroll', margin: { top: 12 } }}
        >
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
                  onPress={() => startTestMode('sandbox')}
                />
              )}
              <Label value={`${campaignMode()} · Chapter ${chapter()} · ${Math.floor(serializeProgress().seconds / 60)}m`} fontSize={16} color={UI_INK} uiTransform={{ width: '100%', height: 36, flexShrink: 0 }} />
              <SystemActionButton label="NEW CLEAN PROGRESSION TEST" onPress={() => startTestMode('progression-test')} />
              <SystemActionButton label="TUTORIAL CRAFT TEST" onPress={startTutorialCraftFixture} />
              <SystemActionButton label="NEW SANDBOX" onPress={() => startTestMode('sandbox')} />
              <SystemActionButton label="LOG MILESTONES / METRICS" onPress={() => console.log('[campaign]', JSON.stringify(serializeProgress()))} />
              {[2, 3, 4, 5, 6].map(stage => <SystemActionButton key={stage} label={`NEW CHAPTER ${stage} FIXTURE`} onPress={() => startChapterFixture(stage)} />)}
              <SystemActionButton label="TEST DEATH / RETRY" onPress={() => { setSystemMenuOpen(false); triggerGameOver() }} />
              <SystemActionButton label="START RAID" onPress={() => { setSystemMenuOpen(false); startRaid() }} />
              <SystemActionButton label="ADVANCE MACHINES / RAID 30s" onPress={() => { setSystemMenuOpen(false); debugAdvanceExpansion() }} />
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
                value={
                  isMobile()
                    ? 'Change tool with the top-right selector. Use the large item button; hold and release to cast. Stand near structures for more actions.'
                    : 'Select tools with the bottom bar or backpack. Left-click to use; hold and release to cast. Use E / F near structures.'
                }
                fontSize={16}
                color={UI_INK}
                textAlign="top-left"
                uiTransform={{ width: '100%', height: 90, margin: { top: 14, bottom: 8 } }}
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
        </UiEntity>
        <StatusLine status={getSystemStatus()} />
      </Panel>
    </ModalFrame>
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
        sub: 'This starts a fresh local run in the current mode and replaces your chapter checkpoint.',
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
      playAgain()
      return
    case 'load':
      void requestLoad(false)
      return
    case 'lobby':
      returnToLobby()
      return
  }
}

function SystemActionButton(props: { key?: number; label: string; onPress: () => void; inline?: boolean }): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: props.inline ? '23%' : '100%',
        height: 48,
        flexShrink: 0,
        margin: { top: 8 },
        borderRadius: 8
      }}
      uiBackground={{ color: props.label === 'RESUME GAME' ? UI_ACCENT : UI_CELL }}
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
  if (!label) return <UiEntity uiTransform={{ display: 'none' }} />
  return (
    <Label
      value={label}
      fontSize={14}
      color={CRAFT_TEXT_DIM_COLOR}
      textAlign="middle-center"
      uiTransform={{ width: '100%', height: 44, flexShrink: 0, margin: { top: 4 } }}
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
