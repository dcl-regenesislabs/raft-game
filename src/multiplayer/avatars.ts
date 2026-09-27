// Cosmetic per-player presence: what each avatar is holding and whether it has a cast out.
// Relayed through the authority because clients only accept messages from the server peer.
// Never feeds gameplay; the world snapshot stays the single source of truth for outcomes.
import { HOOK_MAX_THROW_SPEED } from '../config/gameConfig'
import { Vec } from './types'

export type AvatarCastTool = 'hook' | 'rod'
export type AvatarCastPhase = 'flying' | 'idle' | 'biting' | 'reeling'
export type AvatarCast = { id: number; tool: AvatarCastTool; phase: AvatarCastPhase; origin: Vec; velocity: Vec }
export type AvatarPresence = { held: string; cast: AvatarCast | null }

export const AVATAR_PRESENCE_MAX_BYTES = 400
// A cast must start near the sender's server-verified avatar position.
export const AVATAR_CAST_MAX_ORIGIN_DISTANCE = 6

const TOOLS: AvatarCastTool[] = ['hook', 'rod']
const PHASES: AvatarCastPhase[] = ['flying', 'idle', 'biting', 'reeling']

function vec(value: unknown, limit: number): Vec | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const out = { x: v.x, y: v.y, z: v.z }
  for (const n of [out.x, out.y, out.z]) if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > limit) return null
  return out as Vec
}

// Rebuilds the payload field by field so relayed data can only ever carry this shape.
export function sanitizeAvatarPresence(raw: unknown): AvatarPresence | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.held !== 'string' || !/^[a-zA-Z0-9_-]{0,40}$/.test(r.held)) return null
  if (r.cast === null || r.cast === undefined) return { held: r.held, cast: null }
  if (typeof r.cast !== 'object') return null
  const c = r.cast as Record<string, unknown>
  const origin = vec(c.origin, 10000)
  const velocity = vec(c.velocity, HOOK_MAX_THROW_SPEED * 1.1)
  if (
    !Number.isSafeInteger(c.id) ||
    !TOOLS.includes(c.tool as AvatarCastTool) ||
    !PHASES.includes(c.phase as AvatarCastPhase) ||
    !origin ||
    !velocity
  )
    return null
  return {
    held: r.held,
    cast: {
      id: c.id as number,
      tool: c.tool as AvatarCastTool,
      phase: c.phase as AvatarCastPhase,
      origin,
      velocity
    }
  }
}
