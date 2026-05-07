import {
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  MaterialTransparencyMode,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  type ConstructionKind,
  getConstructionDeckOffset,
  getConstructionGlb,
  getConstructionVisualSize
} from './construction'

// Pure opaque colors — pulse animates hue dim → bright, mirroring the
// spectralPlatform palette so the placement preview vocabulary stays
// consistent across raft/grill/purifier placement systems.
const DEFAULT_DIM = Color4.create(0.2, 0.7, 0.3, 1)
const DEFAULT_BRIGHT = Color4.create(0.5, 1.0, 0.6, 1)
const BLINK_RATE = Math.PI * 2

export type SpectralPalette = {
  dim?: Color4
  bright?: Color4
}

type State = {
  isVisible: boolean
  blinkPhase: number
  dim: Color4
  bright: Color4
  visualSize: number
  // Same world offset the factory uses when placing the real entity —
  // stored per ghost so the hovered preview matches the committed
  // placement exactly, otherwise the construction visibly jumps on
  // commit.
  deckOffsetM: number
}

const states = new Map<Entity, State>()

// Ghost preview for a placeable construction (grill / water purifier).
// Created at scene init and parked at scale 0; the placement system shows
// it on the hovered platform deck and re-tints it on stock/validity.
// Carries no collider so it never blocks the underlying placement raycast.
export function createSpectralConstruction(
  kind: ConstructionKind,
  palette: SpectralPalette = {}
): Entity {
  const dim = palette.dim ?? DEFAULT_DIM
  const bright = palette.bright ?? DEFAULT_BRIGHT
  const visualSize = getConstructionVisualSize(kind)
  const ghost = engine.addEntity()
  Transform.create(ghost, {
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(0, 0, 0)
  })
  GltfContainer.create(ghost, { src: getConstructionGlb(kind) })
  GltfNodeModifiers.create(ghost, {
    modifiers: [
      {
        path: '',
        castShadows: false,
        material: buildSpectralPbMaterial(dim)
      }
    ]
  })
  states.set(ghost, {
    isVisible: false,
    blinkPhase: 0,
    dim,
    bright,
    visualSize,
    deckOffsetM: getConstructionDeckOffset(kind)
  })
  return ghost
}

// Snaps the ghost to the world position of the hovered platform's deck top.
// `platformTopWorld` is the platform Transform's world position; this lifts
// the ghost by the kind-specific deck offset so it sits ON the deck rather
// than inside it.
export function showSpectralConstructionAt(
  ghost: Entity,
  platformTopWorld: Vector3,
  yawDeg: number = 0
): void {
  const state = states.get(ghost)
  if (state === undefined) return
  const transform = Transform.getMutable(ghost)
  transform.position = Vector3.create(
    platformTopWorld.x,
    platformTopWorld.y + state.deckOffsetM,
    platformTopWorld.z
  )
  transform.rotation = Quaternion.fromEulerDegrees(0, yawDeg, 0)
  transform.scale = Vector3.create(
    state.visualSize,
    state.visualSize,
    state.visualSize
  )
  if (!state.isVisible) {
    state.isVisible = true
    state.blinkPhase = 0
    setSpectralColor(ghost, state.dim)
  }
}

export function hideSpectralConstruction(ghost: Entity): void {
  const state = states.get(ghost)
  if (state === undefined) return
  Transform.getMutable(ghost).scale = Vector3.create(0, 0, 0)
  state.isVisible = false
}

export function tickSpectralConstructionBlink(ghost: Entity, dt: number): void {
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
