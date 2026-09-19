import { Storage } from '@dcl/sdk/server'
import { getStorageServerUrl } from '@dcl/sdk/server/storage-url'
import { wrapSignedFetch } from '@dcl/sdk/server/utils'
import { DurableStorage, ReadResult } from '../multiplayer/persistence'

// The pinned SDK's public get() maps both HTTP failures and 404 to null.
// Preserve HTTP status here so an outage can never initialize an empty world.
export const worldStorage: DurableStorage = {
  async read(key: string): Promise<ReadResult> {
    const base = await getStorageServerUrl()
    const [error, data, status] = await wrapSignedFetch<{ value: unknown }>({
      url: `${base}/values/${encodeURIComponent(key)}`
    })
    if (status === 404) return { kind: 'missing' }
    if (status !== 200 || error || !data || !Object.prototype.hasOwnProperty.call(data, 'value'))
      throw new Error('World storage unavailable')
    return { kind: 'found', value: data.value }
  },
  write: (key, value) => Storage.set(key, value, { skipIfUnchanged: false }),
  remove: (key) => Storage.delete(key)
}
