#!/usr/bin/env node
// Writes the single raft.dcl.eth deployment configuration.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCENE_JSON = resolve(HERE, '..', 'scene.json')

const CONFIG = {
  worldName: 'raft.dcl.eth',
  parcels: rangeParcels(0, 49, 0, 49),
  base: '0,0',
  spawnPoint: {
    name: 'spawn1',
    default: true,
    // North tip of the lobby bridge → see `factories/lobby.ts`
    // (getLobbyArrivalPosition). GRID_ORIGIN=(400,_,400), BRIDGE_GX=-1,
    // LOBBY_Z_OFFSET=+0.9, ISLAND_HALF=3, BRIDGE_REACH=10, CELL=3.
    // x = cellCentre(400,-1) = 398.5; z = 400 + 0.9 + (9 + 30 - 1.5) = 438.4.
    // Camera faces south toward the welcome arch/island.
    position: { x: [397.5, 399.5], y: [5, 5], z: [437.6, 439.2] },
    cameraTarget: { x: 398.5, y: 5, z: 410 }
  }
}

function rangeParcels(xMin, xMax, zMin, zMax) {
  const out = []
  for (let x = xMin; x <= xMax; x++) {
    for (let z = zMin; z <= zMax; z++) {
      out.push(`${x},${z}`)
    }
  }
  return out
}

function main() {
  const cfg = CONFIG

  const raw = readFileSync(SCENE_JSON, 'utf8')
  const scene = JSON.parse(raw)

  scene.worldConfiguration = {
    ...(scene.worldConfiguration ?? {}),
    name: cfg.worldName
  }
  scene.scene = {
    ...(scene.scene ?? {}),
    parcels: cfg.parcels,
    base: cfg.base
  }
  scene.spawnPoints = [cfg.spawnPoint]

  writeFileSync(SCENE_JSON, JSON.stringify(scene, null, 2) + '\n', 'utf8')

  // eslint-disable-next-line no-console
  console.log(
    `[build-scene-json] ${cfg.worldName} (${cfg.parcels.length} parcels)`
  )
}

main()
