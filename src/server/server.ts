// Authoritative server entry point. Runs headless inside the
// Decentraland-hosted server room; the client and server share the same
// codebase, branched on isServer() in src/index.ts.
//
// The save layer here is intentionally thin — the server treats the
// SaveBlob as an opaque string and only routes save / load / wipe per
// player wallet, scoped by scene mode. All shape validation happens on
// the client (parseSaveBlob in src/shared/saveSchema.ts).

import { Storage } from '@dcl/sdk/server'

import { saveRoom } from '../shared/messages'

const VALID_MODES: ReadonlySet<string> = new Set(['full', 'demo'])

export function runServer(): void {
  saveRoom.onMessage('save', async (data, ctx) => {
    const address = ctx?.from
    if (address === undefined || address === '') {
      replyAck(address, 'save', false, 'missing-sender')
      return
    }
    const mode = normalizeMode(data.mode)
    if (mode === null) {
      replyAck(address, 'save', false, 'invalid-mode')
      return
    }
    try {
      await Storage.player.set(address, storageKey(mode), data.payload)
      replyAck(address, 'save', true, '')
    } catch (error) {
      replyAck(address, 'save', false, errorMessage(error))
    }
  })

  saveRoom.onMessage('load', async (data, ctx) => {
    const address = ctx?.from
    if (address === undefined || address === '') return
    const mode = normalizeMode(data.mode)
    if (mode === null) {
      saveRoom.send(
        'loadResult',
        { mode: data.mode, payload: '', found: false },
        { to: [address] }
      )
      return
    }
    try {
      const raw = await Storage.player.get<string>(address, storageKey(mode))
      saveRoom.send(
        'loadResult',
        {
          mode,
          payload: raw ?? '',
          found: raw !== undefined && raw !== null && raw !== ''
        },
        { to: [address] }
      )
    } catch {
      saveRoom.send(
        'loadResult',
        { mode, payload: '', found: false },
        { to: [address] }
      )
    }
  })

  saveRoom.onMessage('wipe', async (_data, ctx) => {
    const address = ctx?.from
    if (address === undefined || address === '') return
    try {
      await Storage.player.delete(address, storageKey('full'))
      await Storage.player.delete(address, storageKey('demo'))
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
    const mode = normalizeMode(data.mode)
    if (mode === null) {
      replySubmitScoreAck(address, false, 'invalid-mode')
      return
    }
    const entry = {
      address,
      timeS: data.timeS,
      submittedAtMs: Date.now()
    }
    const key = `ranking:${mode}:${Date.now()}:${address}`
    try {
      await Storage.set(key, JSON.stringify(entry))
      replySubmitScoreAck(address, true, '')
    } catch (error) {
      replySubmitScoreAck(address, false, errorMessage(error))
    }
  })

  saveRoom.onMessage('requestRankings', async (data, ctx) => {
    const address = ctx?.from
    if (address === undefined || address === '') return
    const mode = normalizeMode(data.mode)
    if (mode === null) {
      saveRoom.send(
        'rankingsResult',
        { mode: data.mode, entries: '[]' },
        { to: [address] }
      )
      return
    }
    try {
      const result = await Storage.getValues({ prefix: `ranking:${mode}:`, limit: 100 })
      const entries: Array<{ address: string; timeS: number; submittedAtMs: number }> = []
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
        timeS: e.timeS
      }))
      saveRoom.send(
        'rankingsResult',
        { mode, entries: JSON.stringify(top10) },
        { to: [address] }
      )
    } catch {
      saveRoom.send(
        'rankingsResult',
        { mode, entries: '[]' },
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

function storageKey(mode: 'full' | 'demo'): string {
  return `progress:${mode}`
}

function normalizeMode(input: string): 'full' | 'demo' | null {
  if (VALID_MODES.has(input)) return input as 'full' | 'demo'
  return null
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
