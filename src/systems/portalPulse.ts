import { Material, engine } from '@dcl/sdk/ecs'

import { PortalPulse } from '../components'

// Animates `emissiveIntensity` on every entity tagged with `PortalPulse`
// so the gateway "breathes" — brighter on the rising half of the sin
// wave, dimmer on the falling half — without altering the texture's
// natural colors. Reads `Material.getMutable` and patches the PBR
// union in place; that's the cheapest way to push a per-frame intensity
// update through SDK7's CRDT.
export function portalPulseSystem(dt: number): void {
  for (const [entity, pulse] of engine.getEntitiesWith(PortalPulse)) {
    const writable = PortalPulse.getMutable(entity)
    writable.elapsed += dt

    const phase = writable.elapsed * pulse.speed
    const intensity = pulse.baseIntensity + Math.sin(phase) * pulse.pulseAmp

    const mat = Material.getMutableOrNull(entity)
    if (mat?.material?.$case === 'pbr') {
      mat.material.pbr.emissiveIntensity = intensity
    }
  }
}
