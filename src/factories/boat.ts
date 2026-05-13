import {
  Animator,
  ColliderLayer,
  Entity,
  GltfContainer,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { BOAT_CHEF_DIALOG_LINES } from '../systems/chefDialog'
import {
  CHEF_BIG_WAVE_HELLO_CLIP,
  CHEF_CELEBRATING_CLIP,
  CHEF_IFEELYOUBRO_CLIP,
  CHEF_SITTING_IDLE_CLIP,
  CHEF_THANKS_CLIP,
  CHEF_THINKING_CLIP,
  createChef
} from './chef'

// Wooden rowboat that carries the in-game chef on his visitor event.
// The boat is created at a spawn point out by the horizon by the
// `boatChefDirector` system; the director then steers it toward the
// nearest platform, parks it for 30 s of waiting, plays the dialog,
// and rows it off into the distance. This factory only owns the
// spawn + pose helpers — all state machine logic lives in the director.

const BOAT_GLB = 'assets/scene/items/boat.glb'

const BOAT_SCALE = 2
// Vertical offset above WATER_LEVEL — the boat GLB pivot sits a bit
// below the waterline, so we lift it so the hull rides on top of the
// alpha-blended water plane instead of half-submerging.
export const BOAT_Y_OFFSET = 0.2

// Per-animation chef pose relative to the boat origin, in boat-local
// coordinates (inherits BOAT_SCALE, so doubling the boat doubles the
// offsets — which is what we want since the deck doubled too). Each
// clip has its own pivot, so the director swaps the chef's Transform
// to the matching pose every time the phase changes its clip.
interface ChefPose {
  position: Vector3
  yawDeg: number
}
const CHEF_POSES: Record<string, ChefPose> = {
  [CHEF_SITTING_IDLE_CLIP]: {
    position: Vector3.create(-0.3, 0.05, 0),
    yawDeg: 90
  },
  [CHEF_BIG_WAVE_HELLO_CLIP]: {
    position: Vector3.create(0.3, 0.16, -0.1),
    yawDeg: 90
  },
  [CHEF_CELEBRATING_CLIP]: {
    position: Vector3.create(0.22, 0.11, 0),
    yawDeg: 90
  },
  [CHEF_THANKS_CLIP]: {
    position: Vector3.create(0.22, 0.11, 0),
    yawDeg: 90
  },
  [CHEF_THINKING_CLIP]: {
    position: Vector3.create(0.18, 0.11, 0),
    yawDeg: 90
  },
  [CHEF_IFEELYOUBRO_CLIP]: {
    position: Vector3.create(0.18, 0.11, 0),
    yawDeg: 90
  }
}

// Every clip the director may switch to. Pre-registered as Animator
// states by `createChef({ availableClips })` so `playSingleAnimation`
// can swap among them later without re-creating the entity.
const BOAT_CHEF_AVAILABLE_CLIPS: ReadonlyArray<string> = [
  CHEF_BIG_WAVE_HELLO_CLIP,
  CHEF_SITTING_IDLE_CLIP,
  CHEF_CELEBRATING_CLIP,
  CHEF_THINKING_CLIP,
  CHEF_IFEELYOUBRO_CLIP,
  CHEF_THANKS_CLIP
]

// Cancel the parent boat scale so the chef body still renders at human
// size (1.0 world) inside the 2x boat. Children of the chef (click
// box, dialog bubble) inherit chef's world scale (= 1), so their tuned
// pixel-style offsets remain correct without further adjustment.
const CHEF_LOCAL_SCALE = 1 / BOAT_SCALE

export interface BoatChefHandles {
  boat: Entity
  chef: Entity
  clickEntity: Entity
  dialogBubbleEntity: Entity
  dialogTextEntity: Entity
}

export interface SpawnBoatChefVisitorParams {
  // World-space starting transform. The director places the boat far
  // from the raft so it appears to row in from the horizon.
  spawnPosition: Vector3
  yawDeg: number
  // Clip the chef starts on. Defaults to the standing wave so the
  // approaching boat reads as "the chef is greeting you".
  initialClip?: string
}

export function spawnBoatChefVisitor(
  params: SpawnBoatChefVisitorParams
): BoatChefHandles {
  const initialClip = params.initialClip ?? CHEF_BIG_WAVE_HELLO_CLIP
  const boat = engine.addEntity()
  Transform.create(boat, {
    position: params.spawnPosition,
    rotation: Quaternion.fromEulerDegrees(0, params.yawDeg, 0),
    scale: Vector3.create(BOAT_SCALE, BOAT_SCALE, BOAT_SCALE)
  })
  GltfContainer.create(boat, { src: BOAT_GLB })

  const pose = CHEF_POSES[initialClip] ?? CHEF_POSES[CHEF_BIG_WAVE_HELLO_CLIP]
  const handles = createChef({
    parent: boat,
    position: pose.position,
    rotation: Quaternion.fromEulerDegrees(0, pose.yawDeg, 0),
    scale: CHEF_LOCAL_SCALE,
    idleClip: initialClip,
    availableClips: BOAT_CHEF_AVAILABLE_CLIPS,
    dialogLines: BOAT_CHEF_DIALOG_LINES,
    clickColliderLayers: [ColliderLayer.CL_POINTER]
  })

  return {
    boat,
    chef: handles.chef,
    clickEntity: handles.clickEntity,
    dialogBubbleEntity: handles.dialogBubbleEntity,
    dialogTextEntity: handles.dialogTextEntity
  }
}

// Switch the chef's animation clip AND re-pivot its local Transform to
// the matching pose (each clip has its own pivot in the GLB, so the
// chef would skate around the boat if we only swapped the clip). The
// pose table is the source of truth — unknown clip names are ignored
// so the director can stay declarative.
export function setBoatChefPose(chef: Entity, clip: string): void {
  const pose = CHEF_POSES[clip]
  if (pose === undefined) return
  const t = Transform.getMutable(chef)
  t.position = pose.position
  t.rotation = Quaternion.fromEulerDegrees(0, pose.yawDeg, 0)
  Animator.playSingleAnimation(chef, clip, true)
}

// Yaw (degrees, around +Y) that aligns the boat GLB's model-space +X
// forward with a horizontal velocity vector. Derivation:
//   R_y(yaw) maps +X to (cos yaw, 0, -sin yaw).
//   Setting that equal to (vx, 0, vz) (normalised) gives
//   yaw = atan2(-vz, vx).
// A zero-length velocity collapses to yaw 0 rather than NaN.
export function boatYawForVelocity(vx: number, vz: number): number {
  if (vx === 0 && vz === 0) return 0
  return Math.atan2(-vz, vx) * (180 / Math.PI)
}
