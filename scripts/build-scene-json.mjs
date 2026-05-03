#!/usr/bin/env node
// Rewrites scene.json for one of the two deployment targets:
//
//   --target=full  → raft.dcl.eth, 50x50 parcels (0,0..49,49), base 0,0
//   --target=demo  → italy2026.dcl.eth, 5x5 parcels (14,5..18,9), base 14,5
//
// CI calls --target=full right before `sdk-commands deploy` so the BIG
// scene metadata never lives in source control. Devs can run --target=demo
// to undo a stray run and restore the canonical hackathon scene.json.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCENE_JSON = resolve(HERE, '..', 'scene.json')

const TARGETS = {
  full: {
    worldName: 'raft.dcl.eth',
    parcels: rangeParcels(0, 49, 0, 49),
    base: '0,0',
    spawnPoint: {
      name: 'spawn1',
      default: true,
      // Centered on a 50x50 (800m) scene → middle ≈ (400, 5, 400).
      // Y matches WATER_LEVEL (4) + ~1m head clearance above platform top.
      position: { x: [398, 402], y: [5, 5], z: [398, 402] },
      cameraTarget: { x: 400, y: 5, z: 400 }
    }
  },
  demo: {
    worldName: 'italy2026.dcl.eth',
    parcels: rangeParcels(14, 18, 5, 9),
    base: '14,5',
    spawnPoint: {
      name: 'spawn1',
      default: true,
      // Demo scene-local spawn (40, 5, 40). Y = WATER_LEVEL + 1m clearance.
      position: { x: [38, 42], y: [5, 5], z: [38, 42] },
      cameraTarget: { x: 40, y: 5, z: 40 }
    }
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

function parseTarget(argv) {
  const arg = argv.find((a) => a.startsWith('--target='))
  if (arg === undefined) {
    throw new Error('Missing --target=full|demo')
  }
  const value = arg.slice('--target='.length)
  if (value !== 'full' && value !== 'demo') {
    throw new Error(`Invalid target "${value}" (expected full|demo)`)
  }
  return value
}

function main() {
  const target = parseTarget(process.argv.slice(2))
  const cfg = TARGETS[target]

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
    `[build-scene-json] target=${target} → ${cfg.worldName} (${cfg.parcels.length} parcels)`
  )
}

main()
