import { isGameServerReady } from './serverConnection'

import { saveRoom } from '../shared/messages'
import { showNotification } from '../ui/notification'
import type { RankingEntry } from '../shared/rankingTypes'

let cachedRankings: RankingEntry[] | null = null
let listenersRegistered = false
let loading = true
let lastSyncState = false
let probeFired = false

export function initRankingClient(): void {
  if (listenersRegistered) return
  listenersRegistered = true

  saveRoom.onMessage('rankingsResult', (data) => {
    const entries: RankingEntry[] = parseRankingEntries(data.entries)
    cachedRankings = entries
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
  const synced = isGameServerReady()
  if (synced && !lastSyncState) {
    if (!probeFired && listenersRegistered) {
      probeFired = true
      requestRankings()
    }
  }
  if (!synced) probeFired = false
  lastSyncState = synced
}

export function requestRankings(): void {
  if (!isGameServerReady()) return
  loading = true
  saveRoom.send('requestRankings', {})
}

export function submitScore(timeS: number, debug: boolean): void {
  if (!isGameServerReady()) {
    showNotification('Not connected — score could not be submitted.')
    return
  }
  saveRoom.send('submitScore', { timeS, debug })
}

export function getRankings(): RankingEntry[] | null {
  return cachedRankings
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
    return parsed
      .filter(
        (e: unknown) =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as RankingEntry).rank === 'number' &&
          typeof (e as RankingEntry).address === 'string' &&
          typeof (e as RankingEntry).timeS === 'number'
      )
      .map((e: RankingEntry) => ({
        ...e,
        debug: typeof e.debug === 'boolean' ? e.debug : false
      })) as RankingEntry[]
  } catch {
    return []
  }
}
