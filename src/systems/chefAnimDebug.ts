import { Animator, TextShape, engine } from '@dcl/sdk/ecs'

import { ChefAnimDebug, ChefNpc } from '../components'

// Debug-only system. For every chef carrying `ChefAnimDebug`, advances
// through the clip list at `period` seconds per clip, switching the
// Animator to the current clip via `playSingleAnimation` and rewriting
// the dialog bubble text to "[i/N] clipName". Lets the player identify
// each animation visually so we can pick the right one for a given
// scene role (e.g. seated chef on the boat).
//
// To disable: drop `debugCycleAllClips: true` from the createChef call
// and remove this system from `index.ts`. The component lookup short-
// circuits when no entity carries the marker, so leaving the system
// registered is harmless.
export function chefAnimDebugSystem(dt: number): void {
  for (const [entity, debug] of engine.getEntitiesWith(ChefAnimDebug, ChefNpc)) {
    const mut = ChefAnimDebug.getMutable(entity)
    mut.elapsed += dt
    if (mut.elapsed < debug.period) continue
    mut.elapsed = 0
    mut.clipIndex = (debug.clipIndex + 1) % debug.clipNames.length
    const clipName = debug.clipNames[mut.clipIndex]
    Animator.playSingleAnimation(entity, clipName, true)
    const chef = ChefNpc.get(entity)
    const textShape = TextShape.getMutableOrNull(chef.dialogTextEntity)
    if (textShape !== null) {
      textShape.text = `[${mut.clipIndex + 1}/${debug.clipNames.length}]\n${clipName}`
    }
  }
}
