import { Animator, Entity, engine } from '@dcl/sdk/ecs'

import { ChefAnimDebug, ChefNpc } from '../components'

// Kicks off the idle animation on every ChefNpc entity after a short
// delay so the GLB has time to load and bind its skeleton. Calling
// playSingleAnimation in the same tick as Animator.create is lost
// because the renderer hasn't processed the GltfContainer yet.

const KICK_DELAY_S = 1.5
const pending = new Map<Entity, number>()
const kicked = new Set<Entity>()

export function chefIdleStarterSystem(dt: number): void {
  for (const [entity] of engine.getEntitiesWith(ChefNpc)) {
    if (kicked.has(entity)) continue
    if (ChefAnimDebug.getOrNull(entity) !== null) continue

    const elapsed = (pending.get(entity) ?? 0) + dt
    pending.set(entity, elapsed)
    if (elapsed < KICK_DELAY_S) continue

    const anim = Animator.getOrNull(entity)
    if (anim === null || anim.states.length === 0) continue

    const clip = anim.states.find((s) => s.playing)?.clip ?? anim.states[0].clip
    Animator.playSingleAnimation(entity, clip, true)
    kicked.add(entity)
    pending.delete(entity)
  }
}

export function resetChefIdleStarterState(): void {
  kicked.clear()
  pending.clear()
}
