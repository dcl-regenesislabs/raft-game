import {
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  MaterialTransparencyMode,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'

import { PLATFORM_SIZE_Y } from './platform'

// Pure opaque colors — the pulse animates hue (dark → light) only.
const DEFAULT_DIM = Color4.create(0.2, 0.7, 0.3, 1)
const DEFAULT_BRIGHT = Color4.create(0.5, 1.0, 0.6, 1)
// Radians per second of the sin() that drives the blink. ~1 Hz pulse.
const BLINK_RATE = Math.PI * 2

// Mirror createPlatform's visual sizing so the ghost reads as "the same raft."
// Keep in sync with the visualSize / visualYOffsetMeters constants in
// platform.ts; if they drift, the preview will desync from the placed raft.
const RAFT_VISUAL_SIZE = 1.7
const RAFT_VISUAL_Y_OFFSET = -0.15
const RAFT_GLB = 'assets/scene/items/raft.glb'

export type SpectralPalette = {
  dim?: Color4
  bright?: Color4
}

type State = {
  isVisible: boolean
  blinkPhase: number
  dim: Color4
  bright: Color4
}

const states = new Map<Entity, State>()

// "Ghost" raft used as a placement preview. Created at scene init and parked
// at scale 0; the builder system repositions it on the active preview position
// and toggles scale to show or hide it. Carries no collider — it must not
// block clicks landing on the underlying placement click area. Each ghost has
// its own palette and blink phase so multiple ghosts (e.g. a green "valid"
// preview and a red cursor-follower) can coexist.
//
// Visual: GltfContainer with raft.glb, but every node's material is replaced
// via GltfNodeModifiers with an opaque tinted PBR override. `path: ''` makes
// the override global.
export function createSpectralPlatform(palette: SpectralPalette = {}): Entity {
  const dim = palette.dim ?? DEFAULT_DIM
  const bright = palette.bright ?? DEFAULT_BRIGHT
  const ghost = engine.addEntity()
  Transform.create(ghost, {
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(0, 0, 0)
  })
  GltfContainer.create(ghost, { src: RAFT_GLB })
  GltfNodeModifiers.create(ghost, {
    modifiers: [
      {
        path: '',
        castShadows: false,
        material: buildSpectralPbMaterial(dim)
      }
    ]
  })
  states.set(ghost, { isVisible: false, blinkPhase: 0, dim, bright })
  return ghost
}

export function showSpectralAt(ghost: Entity, world: Vector3): void {
  const state = states.get(ghost)
  if (state === undefined) return
  const transform = Transform.getMutable(ghost)
  transform.position = Vector3.create(
    world.x,
    world.y + PLATFORM_SIZE_Y / 2 + RAFT_VISUAL_Y_OFFSET,
    world.z
  )
  transform.scale = Vector3.create(RAFT_VISUAL_SIZE, RAFT_VISUAL_SIZE, RAFT_VISUAL_SIZE)
  if (!state.isVisible) {
    state.isVisible = true
    state.blinkPhase = 0
    setSpectralColor(ghost, state.dim)
  }
}

export function hideSpectral(ghost: Entity): void {
  const state = states.get(ghost)
  if (state === undefined) return
  Transform.getMutable(ghost).scale = Vector3.create(0, 0, 0)
  state.isVisible = false
}

// Pulses albedo + alpha between dim and bright while shown. Called from the
// builder system every frame; no-op when the ghost is hidden.
export function tickSpectralBlink(ghost: Entity, dt: number): void {
  const state = states.get(ghost)
  if (state === undefined || !state.isVisible) return
  state.blinkPhase += dt * BLINK_RATE
  const t = (Math.sin(state.blinkPhase) + 1) / 2
  setSpectralColor(ghost, lerpColor(state.dim, state.bright, t))
}

function lerpColor(a: Color4, b: Color4, t: number): Color4 {
  return Color4.create(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
    1
  )
}

// Re-emits the modifiers array so the GLB material override picks up the new
// colour. Mutating deeply-nested oneof fields is brittle across the proto
// bridge, so we replace the array each frame instead.
function setSpectralColor(ghost: Entity, color: Color4): void {
  const mods = GltfNodeModifiers.getMutable(ghost)
  mods.modifiers = [
    {
      path: '',
      castShadows: false,
      material: buildSpectralPbMaterial(color)
    }
  ]
}

function buildSpectralPbMaterial(color: Color4) {
  return {
    material: {
      $case: 'pbr' as const,
      pbr: {
        albedoColor: color,
        transparencyMode: MaterialTransparencyMode.MTM_OPAQUE,
        castShadows: false,
        roughness: 1,
        metallic: 0
      }
    }
  }
}
