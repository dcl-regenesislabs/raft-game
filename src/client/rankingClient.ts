import { isStateSyncronized } from '@dcl/sdk/network'

import { saveRoom } from '../shared/messages'
import { showNotification } from '../ui/notification'
import type { SceneMode } from '../runtime/sceneMode'
import type { RankingEntry } from '../shared/rankingTypes'

const cachedRankings = new Map<string, RankingEntry[]>()
let listenersRegistered = false
let loading = true
let lastSyncState = false
let probeFired = false
let pendingMode: SceneMode | null = null

export function initRankingClient(mode: SceneMode): void {
  if (listenersRegistered) return
  listenersRegistered = true
  pendingMode = mode

  saveRoom.onMessage('rankingsResult', (data) => {
    const entries: RankingEntry[] = parseRankingEntries(data.entries)
    cachedRankings.set(data.mode, entries)
    loading = false
  })

  saveRoom.onMessage('submitScoreAck', (data) => {
    if (data.ok) {
      showNotification('Victory! Time recorded.')
    } else {
      const message = data.error !== '' ? data.error : 'Score could not be recorded.'
      showNotification(`Score failed: ${message}`)
    }
  })
}

export function rankingClientTickSystem(_dt: number): void {
  const synced = isStateSyncronized()
  if (synced && !lastSyncState) {
    if (!probeFired && pendingMode !== null) {
      probeFired = true
      requestRankings(pendingMode)
    }
  }
  lastSyncState = synced
}

export function requestRankings(mode: SceneMode): void {
  if (!isStateSyncronized()) return
  loading = true
  saveRoom.send('requestRankings', { mode })
}

export function submitScore(mode: SceneMode, timeS: number): void {
  if (!isStateSyncronized()) {
    showNotification('Not connected — score could not be submitted.')
    return
  }
  saveRoom.send('submitScore', { mode, timeS })
}

export function getRankings(mode: SceneMode): RankingEntry[] | null {
  return cachedRankings.get(mode) ?? null
}

export function isRankingsLoading(): boolean {
  return loading
}

export function resetRankingClientState(): void {
  lastSyncState = false
  probeFired = false
  loading = true
}

function parseRankingEntries(raw: string): RankingEntry[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e: unknown) =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as RankingEntry).rank === 'number' &&
        typeof (e as RankingEntry).address === 'string' &&
        typeof (e as RankingEntry).timeS === 'number'
    ) as RankingEntry[]
  } catch {
    return []
  }
}
