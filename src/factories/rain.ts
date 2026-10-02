import {
  engine, Entity, Transform, MeshRenderer, Material, ParticleSystem,
  PBParticleSystem_BlendMode, PBParticleSystem_SimulationSpace
} from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { RAIN_MAX_PARTICLES, RAIN_PARTICLES_PER_S } from '../config/gameConfig'

export type RainCloud = { root: Entity; drops: Entity; children: Entity[] }

// Runtime-only weather: no colliders, no pointer targets, no downloaded assets.
export function createRainCloud(): RainCloud {
  const root = engine.addEntity()
  Transform.create(root)
  const children: Entity[] = []
  const lobes = [
    [-0.29, 0, 0, 0.42, 2.6, 0.8],
    [0, 0.6, 0, 0.55, 3.6, 1],
    [0.3, 0.15, 0.02, 0.4, 2.8, 0.8],
    [-0.13, 0.3, -0.26, 0.4, 2.8, 0.55],
    [0.15, 0.1, 0.27, 0.45, 2.4, 0.6]
  ]
  for (const [x, y, z, w, h, d] of lobes) {
    const entity = engine.addEntity()
    children.push(entity)
    Transform.create(entity, {
      parent: root,
      position: Vector3.create(x, y, z),
      scale: Vector3.create(w, h, d)
    })
    MeshRenderer.setSphere(entity)
    Material.setPbrMaterial(entity, {
      albedoColor: Color4.create(0.53, 0.61, 0.68, 1), roughness: 1, metallic: 0, castShadows: false
    })
  }
  const drops = engine.addEntity()
  Transform.create(drops)
  ParticleSystem.create(drops, {
    active: false,
    loop: true,
    rate: RAIN_PARTICLES_PER_S,
    maxParticles: RAIN_MAX_PARTICLES,
    lifetime: 1.55,
    initialSize: { start: 0.035, end: 0.065 },
    sizeOverTime: { start: 1, end: 0.65 },
    initialVelocitySpeed: { start: 0, end: 0 },
    gravity: 1,
    additionalForce: Vector3.create(0.35, 0, 0),
    initialColor: { start: Color4.create(0.65, 0.82, 0.95, 0.65), end: Color4.create(0.8, 0.92, 1, 0.8) },
    colorOverTime: { start: Color4.create(1, 1, 1, 1), end: Color4.create(1, 1, 1, 0.15) },
    blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
    simulationSpace: PBParticleSystem_SimulationSpace.PSS_WORLD,
    shape: ParticleSystem.Shape.Box({ size: Vector3.create(20, 0.1, 20) })
  })
  return { root, drops, children }
}

export function destroyRainCloud(cloud: RainCloud): void {
  for (const entity of [...cloud.children, cloud.drops, cloud.root]) engine.removeEntity(entity)
}

export function createCollectorRainEffect(parent: Entity): Entity {
  const entity = engine.addEntity()
  // Collector root is 0.9m above the deck origin. Catchment is ~1.3m high.
  Transform.create(entity, { parent, position: Vector3.create(0, 0.46, 0) })
  ParticleSystem.create(entity, {
    loop: true, rate: 18, lifetime: 0.35, maxParticles: 12,
    initialSize: { start: 0.025, end: 0.045 },
    sizeOverTime: { start: 1, end: 0 },
    initialVelocitySpeed: { start: 0.4, end: 0.8 },
    gravity: 0.5,
    initialColor: { start: Color4.create(0.6, 0.85, 1, 0.8), end: Color4.create(0.9, 0.97, 1, 0.9) },
    colorOverTime: { start: Color4.create(1, 1, 1, 1), end: Color4.create(1, 1, 1, 0) },
    blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
    shape: ParticleSystem.Shape.Box({ size: Vector3.create(0.95, 0.04, 0.95) })
  })
  return entity
}
