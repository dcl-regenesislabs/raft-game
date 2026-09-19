// Publish-only: stamp a unique build identity and its predecessor without touching live storage.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const base = 'https://worlds-content-server.decentraland.org'
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw Error(`Release lookup failed: ${response.status}`)
  return response.json()
}
const source = readFileSync('src/config/release.ts', 'utf8')
const compatibility = Number(/WORLD_COMPATIBILITY = (\d+)/.exec(source)?.[1])
if (!Number.isSafeInteger(compatibility) || compatibility < 1) throw Error('Set WORLD_COMPATIBILITY explicitly')
const about = await json(`${base}/world/raft.dcl.eth/about`)
const urns = about.configurations?.scenesUrn
if (!Array.isArray(urns) || !urns.length || urns.length > 16) throw Error('Cannot verify previous deployment')
let previous = 'legacy',
  previousCompatibility = 1,
  previousDescriptor,
  previousSequence = 0,
  found = false
for (const urn of urns) {
  const hash = /^urn:decentraland:entity:([a-zA-Z0-9]+)(?:\?|$)/.exec(urn)?.[1]
  if (!hash) throw Error('Invalid scene URN')
  const entity = await json(`${base}/contents/${hash}`)
  if (entity.metadata?.scene?.base !== '0,0') continue
  found = true
  const entry = entity.content?.find((file) => file.file === 'raft-release.json')
  if (entry) {
    if (!/^[a-zA-Z0-9]+$/.test(entry.hash)) throw Error('Invalid release hash')
    const release = await json(`${base}/contents/${entry.hash}`)
    if (
      release.format !== 1 ||
      release.world !== 'raft.dcl.eth' ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(release.id) ||
      !Number.isSafeInteger(release.compatibility) ||
      release.compatibility < 1
    )
      throw Error('Invalid previous release')
    previousDescriptor = entry.hash
    previousSequence = release.sequence
    if (!Number.isSafeInteger(previousSequence) || previousSequence < 0) throw Error('Invalid release sequence')
    previous = release.id
    previousCompatibility = release.compatibility
  }
  break
}
if (!found) throw Error('Cannot locate the raft scene; refusing to guess a predecessor')
if (compatibility < previousCompatibility) throw Error('Compatibility version cannot decrease')
const sequence = Math.max(Date.now(), previousSequence + 1)
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const release = {
  format: 1,
  world: 'raft.dcl.eth',
  id: `${commit}-${sequence}`,
  sequence,
  compatibility,
  previous,
  previousCompatibility,
  ...(previousDescriptor ? { previousDescriptor } : {})
}
if (!process.argv.includes('--dry-run')) {
  writeFileSync('raft-release.json', JSON.stringify(release, null, 2) + '\n')
  writeFileSync(
    'src/config/release.ts',
    `// Generated for deployment; keep the development version committed.\nexport const WORLD_COMPATIBILITY = ${compatibility}\nexport const RELEASE = ${JSON.stringify(release, null, 2)}\n`
  )
}
console.log(`Release ${release.id}; compatibility ${compatibility}; predecessor ${previous}`)
