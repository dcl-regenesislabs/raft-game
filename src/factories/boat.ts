import { ColliderLayer, GltfContainer, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { BOAT_CHEF_DIALOG_LINES } from '../systems/chefDialog'
import { CHEF_BIG_WAVE_HELLO_CLIP, CHEF_SITTING_IDLE_CLIP, createChef } from './chef'
import { WATER_LEVEL } from './sceneLevels'

// Wooden rowboat that carries the in-game chef. Parked at the water
// surface alongside the main raft so the player can chat with the chef
// from the deck. The chef is parented to the boat so the idle loop,
// click box, and speech bubble all share the boat transform.

const BOAT_GLB = 'assets/scene/items/boat.glb'

// Distance from the raft centre to the boat origin along +X. Just
// outside the 3 m raft footprint (1.5 m half-extent) with a small gap
// so the hull doesn't visually clip the deck edge.
const BOAT_SIDE_OFFSET = 6
const BOAT_SCALE = 2
// Vertical offset above WATER_LEVEL — the boat GLB pivot sits a bit
// below the waterline, so we lift it so the hull rides on top of the
// alpha-blended water plane instead of half-submerging.
const BOAT_Y_OFFSET = 0.2
// Source GLB faces +X by default; rotate -90° so the bow points along
// +Z (parallel to the raft edge) when parked.
const BOAT_HEADING_DEG = -90
// Per-animation chef pose relative to the boat origin, in boat-local
// coordinates (so it inherits BOAT_SCALE — doubling the boat doubles
// the offsets, which is what we want since the deck doubled too). Each
// clip has its own pose because seated/standing/waving animations have
// different pivots; tweak per pose and pick the active one below.
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
    position: Vector3.create(0, 0.05, 0),
    yawDeg: 90
  }
}
const ACTIVE_CHEF_CLIP = CHEF_BIG_WAVE_HELLO_CLIP
// Cancel the parent boat scale so the chef body still renders at human
// size (1.0 world) inside the 2x boat. Children of the chef (click
// box, dialog bubble) inherit chef's world scale (= 1), so their tuned
// pixel-style offsets remain correct without further adjustment.
const CHEF_LOCAL_SCALE = 1 / BOAT_SCALE

export function spawnBoatChef(center: Vector3): void {
  const boat = engine.addEntity()
  Transform.create(boat, {
    position: Vector3.create(center.x + BOAT_SIDE_OFFSET, WATER_LEVEL + BOAT_Y_OFFSET, center.z),
    rotation: Quaternion.fromEulerDegrees(0, BOAT_HEADING_DEG, 0),
    scale: Vector3.create(BOAT_SCALE, BOAT_SCALE, BOAT_SCALE)
  })
  GltfContainer.create(boat, { src: BOAT_GLB })

  // Chef rides as a Transform child so the idle loop, click box, and
  // speech bubble inherit the boat's transform. Click box stays
  // pointer-only — no physics collider needed for a parked boat.
  const pose = CHEF_POSES[ACTIVE_CHEF_CLIP]
  createChef({
    parent: boat,
    position: pose.position,
    rotation: Quaternion.fromEulerDegrees(0, pose.yawDeg, 0),
    scale: CHEF_LOCAL_SCALE,
    idleClip: ACTIVE_CHEF_CLIP,
    dialogLines: BOAT_CHEF_DIALOG_LINES,
    clickColliderLayers: [ColliderLayer.CL_POINTER]
  })
}
