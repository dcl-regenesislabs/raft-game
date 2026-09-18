// Authoritative server entry point. Runs headless inside the
// Decentraland-hosted server room; the client and server share the same
// codebase, branched on isServer() in src/index.ts.
//
// The save layer here is intentionally thin — the server treats the
// SaveBlob as an opaque string and only routes save / load / wipe per
// player wallet. All shape validation happens on
// the client (parseSaveBlob in src/shared/saveSchema.ts).

import { engine } from '@dcl/sdk/ecs'
import { Storage } from '@dcl/sdk/server'

import { saveRoom } from '../shared/messages'

// Preserve the existing production namespaces; there is only one game.
const PROGRESS_KEY = 'progress:full'
const RANKING_PREFIX = 'ranking:full:'

export function runServer(): void {
  let heartbeatElapsedS = 2
  engine.addSystem((dt) => {
    heartbeatElapsedS += dt
    if (heartbeatElapsedS < 2 || !saveRoom.isReady()) return
    heartbeatElapsedS = 0
    void saveRoom.send('serverHeartbeat', {}).catch((error) => console.error('[SERVER] Heartbeat failed', error))
  })
  console.log('[SERVER] Save and ranking service started')
  saveRoom.onMessage('save', async (data, ctx) => {
    const address = ctx?.from
    if (address === undefined || address === '') {
      replyAck(address, 'save', false, 'missing-sender')
      return
    }
    try {
      const stored = await Storage.player.set(address, PROGRESS_KEY, data.payload)
      if (!stored) throw new Error('Storage write failed')
      replyAck(address, 'save', true, '')
    } catch (error) {
      replyAck(address, 'save', false, errorMessage(error))
    }
  })

  saveRoom.onMessage('load', async (_data, ctx) => {
    const address = ctx?.from
    if (address === undefined || address === '') return
    try {
      const raw = await Storage.player.get<string>(address, PROGRESS_KEY)
      saveRoom.send(
        'loadResult',
        {
          payload: raw ?? '',
          found: raw !== undefined && raw !== null && raw !== ''
        },
        { to: [address] }
      )
    } catch {
      saveRoom.send(
        'loadResult',
        { payload: '', found: false },
        { to: [address] }
      )
    }
  })

  saveRoom.onMessage('wipe', async (_data, ctx) => {
    const address = ctx?.from
    if (address === undefined || address === '') return
    try {
      const deleted = await Storage.player.delete(address, PROGRESS_KEY)
      if (!deleted) throw new Error('Storage delete failed')
      replyAck(address, 'wipe', true, '')
    } catch (error) {
      replyAck(address, 'wipe', false, errorMessage(error))
    }
  })

  saveRoom.onMessage('submitScore', async (data, ctx) => {
    const address = ctx?.from
    if (address === undefined || address === '') {
      replySubmitScoreAck(address, false, 'missing-sender')
      return
    }
    const entry = {
      address,
      timeS: data.timeS,
      debug: data.debug,
      submittedAtMs: Date.now()
    }
    const key = `${RANKING_PREFIX}${Date.now()}:${address}`
    try {
      const stored = await Storage.set(key, JSON.stringify(entry))
      if (!stored) throw new Error('Storage write failed')
      replySubmitScoreAck(address, true, '')
    } catch (error) {
      replySubmitScoreAck(address, false, errorMessage(error))
    }
  })

  saveRoom.onMessage('requestRankings', async (_data, ctx) => {
    const address = ctx?.from
    if (address === undefined || address === '') return
    try {
      const result = await Storage.getValues({ prefix: RANKING_PREFIX, limit: 100 })
      const entries: Array<{ address: string; timeS: number; debug: boolean; submittedAtMs: number }> = []
      for (const item of result.data) {
        try {
          const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            typeof parsed.address === 'string' &&
            typeof parsed.timeS === 'number'
          ) {
            entries.push(parsed)
          }
        } catch {
          // skip malformed entries
        }
      }
      entries.sort((a, b) => a.timeS - b.timeS)
      const top10 = entries.slice(0, 10).map((e, i) => ({
        rank: i + 1,
        address: truncateAddress(e.address),
        timeS: e.timeS,
        debug: e.debug ?? false
      }))
      saveRoom.send(
        'rankingsResult',
        { entries: JSON.stringify(top10) },
        { to: [address] }
      )
    } catch {
      saveRoom.send(
        'rankingsResult',
        { entries: '[]' },
        { to: [address] }
      )
    }
  })
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}..${address.slice(-4)}`
}

function replySubmitScoreAck(
  address: string | undefined,
  ok: boolean,
  error: string
): void {
  if (address === undefined || address === '') return
  saveRoom.send('submitScoreAck', { ok, error }, { to: [address] })
}

function replyAck(
  address: string | undefined,
  op: string,
  ok: boolean,
  error: string
): void {
  if (address === undefined || address === '') return
  saveRoom.send('ack', { op, ok, error }, { to: [address] })
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'unknown-error'
}
