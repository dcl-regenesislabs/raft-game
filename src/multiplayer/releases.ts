export type Release = {
  format: number
  world: string
  id: string
  sequence: number
  compatibility: number
  previous: string
  previousCompatibility: number
  previousDescriptor?: string
}
export function parseRelease(value: unknown): Release {
  const r = value as Release
  if (
    !r ||
    r.format !== 1 ||
    r.world !== 'raft.dcl.eth' ||
    typeof r.id !== 'string' ||
    typeof r.previous !== 'string' ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(r.id) ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(r.previous) ||
    !Number.isSafeInteger(r.sequence) ||
    r.sequence < 0 ||
    !Number.isSafeInteger(r.compatibility) ||
    r.compatibility < 1 ||
    (r.previousDescriptor !== undefined &&
      (typeof r.previousDescriptor !== 'string' || !/^[a-zA-Z0-9]+$/.test(r.previousDescriptor))) ||
    !Number.isSafeInteger(r.previousCompatibility) ||
    r.previousCompatibility < 1
  )
    throw Error('Invalid release metadata')
  return r
}
export function releaseNamespace(id: string): string {
  return id === 'legacy' || id === 'dev' ? 'cooperative:v1' : `cooperative:release:${id}`
}
export function handoffKey(from: string, to: string): string {
  return `cooperative:handoff:${from}:${to}`
}
export function isNewerRelease(local: Release, remote: Release): boolean {
  return remote.id !== local.id && remote.sequence > local.sequence
}

// Read only the publisher's content service; never take a URL supplied by another player.
export function releaseReader(readJson: (url: string) => Promise<unknown>): () => Promise<Release> {
  const base = 'https://worlds-content-server.decentraland.org'
  let signature = '',
    cached: Release | null = null
  return async () => {
    const about = (await readJson(`${base}/world/raft.dcl.eth/about?raftVersion=${Date.now()}`)) as {
      configurations?: { scenesUrn?: string[] }
    }
    const urns = about.configurations?.scenesUrn
    if (!Array.isArray(urns) || !urns.length || urns.length > 16) throw Error('Scene list unavailable')
    const next = urns.join('|')
    if (next === signature && cached) return cached
    for (const urn of urns) {
      const match = /^urn:decentraland:entity:([a-zA-Z0-9]+)(?:\?|$)/.exec(urn)
      if (!match) continue
      const entity = (await readJson(`${base}/contents/${match[1]}`)) as {
        metadata?: { scene?: { base?: string } }
        content?: { file: string; hash: string }[]
      }
      if (entity.metadata?.scene?.base !== '0,0') continue
      const file = entity.content?.find((item) => item.file === 'raft-release.json')
      if (!file || !/^[a-zA-Z0-9]+$/.test(file.hash)) continue
      const release = parseRelease(await readJson(`${base}/contents/${file.hash}`))
      signature = next
      cached = release
      return release
    }
    throw Error('Published release metadata unavailable')
  }
}
export const readPublishedRelease = releaseReader(async (url) => {
  const response = await fetch(url, { timeout: 10000 })
  if (!response.ok) throw Error('Release lookup unavailable')
  return response.json()
})

export async function readReleaseDescriptor(hash: string): Promise<Release> {
  if (!/^[a-zA-Z0-9]+$/.test(hash)) throw Error('Invalid predecessor descriptor')
  const response = await fetch(`https://worlds-content-server.decentraland.org/contents/${hash}`, { timeout: 10000 })
  if (!response.ok) throw Error('Predecessor descriptor unavailable')
  return parseRelease(await response.json())
}
