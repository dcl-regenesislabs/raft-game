import { engine, Entity, Transform, ParticleSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { ExpansionState, Platform, PlatformConstruction } from '../components'
import { RAIN_CLOUD_HEIGHT_M, RAIN_COLLECTOR_MAX_EFFECTS } from '../config/gameConfig'
import { getMultiplayerSnapshot, isMultiplayer, multiplayerReady } from '../client/multiplayerState'
import { getWeatherElapsedSeconds } from '../expansion/runtime'
import { isRainingAt, rainCloudPass } from '../expansion/weather'
import { createRainCloud, destroyRainCloud, createCollectorRainEffect, RainCloud } from '../factories/rain'
import { PLATFORM_SIZE_X, PLATFORM_SIZE_Z } from '../factories/platform'
import { WATER_LEVEL } from '../factories/sceneLevels'
import { isStartupGateActive } from '../ui/startupGate'
import { isGameOver } from '../ui/gameOver'
import { isWinActive } from '../ui/winScreen'

let cloud: RainCloud | null = null
const collectors = new Map<Entity, { parent: Entity; effect: Entity }>()
let lastSeconds = -1
let betweenSamplesS = 0

function clearEffects(): void {
  if (cloud) destroyRainCloud(cloud)
  cloud = null
  for (const { effect } of collectors.values()) engine.removeEntity(effect)
  collectors.clear()
}

export function rainSystem(dt: number): void {
  if (isStartupGateActive() || isGameOver() || isWinActive() || !multiplayerReady()) {
    clearEffects()
    lastSeconds = -1
    return
  }
  const seconds = isMultiplayer() ? getMultiplayerSnapshot()?.world.progress.seconds : getWeatherElapsedSeconds()
  if (seconds === undefined) return clearEffects()
  // Smooth snapshot/quarter-second steps without running a separate weather clock.
  betweenSamplesS = seconds === lastSeconds ? Math.min(0.25, betweenSamplesS + Math.max(0, dt)) : 0
  lastSeconds = seconds
  const pass = rainCloudPass(seconds + betweenSamplesS)
  if (!pass.visible) return clearEffects()

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [, , transform] of engine.getEntitiesWith(Platform, Transform)) {
    if (transform.position.y < WATER_LEVEL - 1) continue
    minX = Math.min(minX, transform.position.x)
    maxX = Math.max(maxX, transform.position.x)
    minZ = Math.min(minZ, transform.position.z)
    maxZ = Math.max(maxZ, transform.position.z)
  }
  if (!Number.isFinite(minX)) return clearEffects()
  if (!cloud) cloud = createRainCloud()
  // Wide enough that the moving shower covers every raft tile throughout collection.
  const width = (maxX - minX + PLATFORM_SIZE_X) * 2 + 20
  const depth = maxZ - minZ + PLATFORM_SIZE_Z + 12
  const x = (minX + maxX) / 2 + (pass.progress - 0.5) * width * 0.7
  const z = (minZ + maxZ) / 2
  const transform = Transform.getMutable(cloud.root)
  transform.position = Vector3.create(x, WATER_LEVEL + RAIN_CLOUD_HEIGHT_M, z)
  transform.scale = Vector3.create(width * pass.scale, pass.scale, depth * pass.scale)
  Transform.getMutable(cloud.drops).position = Vector3.create(x, WATER_LEVEL + RAIN_CLOUD_HEIGHT_M - 1, z)
  const rain = ParticleSystem.getMutable(cloud.drops)
  const raining = isRainingAt(seconds)
  rain.active = raining
  rain.shape = ParticleSystem.Shape.Box({ size: Vector3.create(width, 0.1, depth) })

  // Bound total particle cost even on rafts with many collectors; nearest ones win.
  const player = Transform.getOrNull(engine.PlayerEntity)?.position
  const nearby = [...engine.getEntitiesWith(ExpansionState, PlatformConstruction)]
    .filter(([, , pc]) => pc.kind === 'rainCollector' && Transform.getOrNull(pc.child))
    .sort((a, b) => {
      if (!player) return 0
      const ap = Transform.get(a[2].child).position
      const bp = Transform.get(b[2].child).position
      return (ap.x - player.x) ** 2 + (ap.z - player.z) ** 2 - (bp.x - player.x) ** 2 - (bp.z - player.z) ** 2
    })
    .slice(0, RAIN_COLLECTOR_MAX_EFFECTS)
  const active = new Set<Entity>()
  if (raining) {
    for (const [tile, , pc] of nearby) {
      active.add(tile)
      const existing = collectors.get(tile)
      if (existing?.parent !== pc.child) {
        if (existing) engine.removeEntity(existing.effect)
        collectors.set(tile, { parent: pc.child, effect: createCollectorRainEffect(pc.child) })
      }
    }
  }
  for (const [tile, { effect }] of collectors) {
    if (!active.has(tile)) {
      engine.removeEntity(effect)
      collectors.delete(tile)
    }
  }
}
