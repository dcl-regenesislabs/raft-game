// Increment only when a deployment must discard the previous world's state.
export const WORLD_COMPATIBILITY = 1
// Stamped by scripts/prepare-release.mjs for deployment. Local previews keep their own legacy namespace.
export const RELEASE = {
  format: 1,
  world: 'raft.dcl.eth',
  id: 'dev',
  sequence: 0,
  compatibility: WORLD_COMPATIBILITY,
  previous: 'legacy',
  previousCompatibility: 1
}
