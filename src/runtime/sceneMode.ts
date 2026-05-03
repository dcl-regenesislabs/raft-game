import { getRealm } from '~system/Runtime'

export type SceneMode = 'full' | 'demo'

// World name attached to the FULL (50x50) deployment. Anything else —
// italy2026.dcl.eth, the local preview realm, etc. — is treated as DEMO.
const FULL_REALM = 'raft.dcl.eth'

let cached: SceneMode | null = null

export async function getSceneMode(): Promise<SceneMode> {
  if (cached !== null) return cached
  const realm = await getRealm({})
  const realmName = realm.realmInfo?.realmName
  cached = realmName === FULL_REALM ? 'full' : 'demo'
  return cached
}

export async function isFullGame(): Promise<boolean> {
  return (await getSceneMode()) === 'full'
}
