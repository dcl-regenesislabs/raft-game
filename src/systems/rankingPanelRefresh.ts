import { TextShape } from '@dcl/sdk/ecs'

import { getRankings, isRankingsLoading } from '../client/rankingClient'
import { getRankingEntryEntities } from '../factories/rankingPanel'
import { formatTimeS } from '../shared/rankingTypes'
import { isStartupGateActive } from '../ui/startupGate'
import type { SceneMode } from '../runtime/sceneMode'

let lastWrittenKey = ''
let cachedMode: SceneMode = 'demo'

export function setRankingPanelMode(mode: SceneMode): void {
  cachedMode = mode
}

export function rankingPanelRefreshSystem(_dt: number): void {
  if (!isStartupGateActive()) return

  const entities = getRankingEntryEntities()
  if (entities.length === 0) return

  const rankings = getRankings(cachedMode)
  const loading = isRankingsLoading()

  const key = loading
    ? 'loading'
    : rankings === null || rankings.length === 0
      ? 'empty'
      : rankings.map((e) => `${e.rank}:${e.timeS}`).join(',')

  if (key === lastWrittenKey) return
  lastWrittenKey = key

  if (loading || rankings === null) {
    for (let i = 0; i < entities.length; i++) {
      const ts = TextShape.getMutable(entities[i])
      ts.text = i === 0 ? 'Loading...' : ''
    }
    return
  }

  if (rankings.length === 0) {
    for (let i = 0; i < entities.length; i++) {
      const ts = TextShape.getMutable(entities[i])
      ts.text = i === 0 ? 'No winners yet' : ''
    }
    return
  }

  for (let i = 0; i < entities.length; i++) {
    const ts = TextShape.getMutable(entities[i])
    if (i < rankings.length) {
      const entry = rankings[i]
      ts.text = `#${entry.rank}  ${entry.address}  ${formatTimeS(entry.timeS)}`
    } else {
      ts.text = ''
    }
  }
}

export function resetRankingPanelRefreshState(): void {
  lastWrittenKey = ''
}
