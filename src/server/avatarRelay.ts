import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { worldRoom } from '../shared/messages'
import {
  AVATAR_CAST_MAX_ORIGIN_DISTANCE,
  AVATAR_PRESENCE_MAX_BYTES,
  AvatarPresence,
  sanitizeAvatarPresence
} from '../multiplayer/avatars'

const FLUSH_S = 0.1
const FULL_S = 2
const STALE_MS = 8000
// Keeps each broadcast far below the 13 KB transport ceiling.
const ENTRIES_PER_MESSAGE = 12

// Relays cosmetic avatar presence between joined peers: dirty entries every 100 ms,
// everything every 2 s so late joiners and dropped packets converge.
export function createAvatarRelay(isPeer: (address: string) => boolean): (dt: number) => void {
  const states = new Map<string, { presence: AvatarPresence; at: number; dirty: boolean }>()
  worldRoom.onMessage('worldAvatar', (data, ctx) => {
    const address = (ctx?.from ?? '').toLowerCase()
    if (!isPeer(address) || data.payload.length > AVATAR_PRESENCE_MAX_BYTES) return
    let presence: AvatarPresence | null = null
    try {
      presence = sanitizeAvatarPresence(JSON.parse(data.payload))
    } catch {
      return
    }
    if (!presence) return
    const previous = states.get(address)
    // Only a new cast needs a position check; later phase updates keep the original origin.
    if (presence.cast && presence.cast.id !== previous?.presence.cast?.id) {
      const avatar = avatarPosition(address)
      const o = presence.cast.origin
      // No Transform until the avatar moves after a server reload; cosmetic casts pass unchecked then.
      if (avatar && Math.hypot(o.x - avatar.x, o.y - avatar.y, o.z - avatar.z) > AVATAR_CAST_MAX_ORIGIN_DISTANCE)
        presence.cast = null
    }
    const dirty = !previous || JSON.stringify(previous.presence) !== JSON.stringify(presence)
    states.set(address, { presence, at: Date.now(), dirty: (previous?.dirty ?? false) || dirty })
  })
  let flush = 0,
    full = 0
  return (dt) => {
    flush += dt
    full += dt
    if (flush < FLUSH_S) return
    flush = 0
    const everything = full >= FULL_S
    if (everything) full = 0
    const now = Date.now()
    const entries: [string, AvatarPresence][] = []
    for (const [address, state] of states) {
      if (now - state.at > STALE_MS || !isPeer(address)) {
        states.delete(address)
        continue
      }
      if (everything || state.dirty) entries.push([address, state.presence])
      state.dirty = false
    }
    for (let i = 0; i < entries.length; i += ENTRIES_PER_MESSAGE) {
      const payload = JSON.stringify(entries.slice(i, i + ENTRIES_PER_MESSAGE))
      void worldRoom.send('worldAvatars', { payload }).catch(() => {})
    }
  }
}

function avatarPosition(address: string): { x: number; y: number; z: number } | null {
  for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
    if (identity.address.toLowerCase() === address) return Transform.getOrNull(entity)?.position ?? null
  }
  return null
}
