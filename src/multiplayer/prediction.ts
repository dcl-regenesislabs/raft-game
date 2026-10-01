import { clone, Request, Snapshot, Vec, WorldState } from './types'
import { reduceAction } from './world'

// Prediction uses the same rules, but only the owner view is ever changed. The server
// independently validates every request against authenticated positions and live state.
export function predictSnapshot(base: Snapshot, pending: Request[], position?: Vec): Snapshot {
  if (!pending.length) return base
  let world: WorldState = { ...base.world, players: { [base.player.address]: clone(base.player) } }
  if (position) world.players[base.player.address].position = { ...position }
  for (const request of pending) {
    if (request.generation !== world.generation || ['reset', 'respawn', 'debug'].includes(request.action.kind)) continue
    try {
      world = reduceAction(world, base.player.address, request.action)
      // Server nextId also advances for debris and other players. Keep local
      // construction identities stable across snapshots until acknowledgement.
      if (request.action.kind === 'build' || request.action.kind === 'place' || request.action.kind === 'destroy') {
        const cell = request.action.kind === 'build'
          ? `${request.action.x},${request.action.z}`
          : request.action.target.split('@')[0]
        if (world.tiles[cell]) world.tiles[cell].instance = -request.sequence
      }
    } catch {
      /* authority decides rejection */
    }
  }
  const { players, ...shared } = world
  return { world: shared, player: players[base.player.address], session: base.session }
}
