import { isStartupGateActive } from '../ui/startupGate'
import { isGameOver } from '../ui/gameOver'
import { isWinActive } from '../ui/winScreen'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { showNotification } from '../ui/notification'
import { playSfx } from '../audio/sfx'
import { cancelSharkAttacks } from '../systems/sharkDirector'
import { captureCheckpoint } from './checkpoint'
import { tickProgress, progressRevision, chapter, isSandbox, assaultActive, hasProgress } from './state'
import { CAMPAIGN } from './config'
let capturedRevision = -1
let previousChapter = 1
let wasAssault = false
export function progressionSystem(dt: number): void {
  if (isStartupGateActive() || isGameOver() || isWinActive()) return
  tickProgress(Math.max(0, Math.min(dt, 1)), isInventoryActionLocked())
  const assault = assaultActive()
  if (assault && !wasAssault) cancelSharkAttacks()
  wasAssault = assault
  const current = chapter()
  if (!isSandbox() && current > previousChapter) {
    showNotification(CAMPAIGN.chapterNames[current - 1] + ' · New recipes available')
    playSfx('cookReady')
  }
  previousChapter = current
  if (!isSandbox() && !assault && !hasProgress('finaleStarted') && !isInventoryActionLocked() && capturedRevision !== progressRevision()) {
    cancelSharkAttacks()
    captureCheckpoint()
    capturedRevision = progressRevision()
  }
}
