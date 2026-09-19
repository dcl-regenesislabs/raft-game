import { clone, Request, Snapshot, Vec, WorldState } from './types'
import { reduceAction } from './world'

// Prediction uses the same rules, but only the owner view is ever changed. The server
// independently validates every request against authenticated positions and live state.
export function predictSnapshot(base: Snapshot, pending: Request[], position?: Vec): Snapshot {
  if (!pending.length) return base
  let world: WorldState = { ...base.world, players: { [base.player.address]: clone(base.player) } }
  if (position) world.players[base.player.address].position = { ...position }
  for (const request of pending) {
    if (request.generation !== world.generation || ['reset', 'respawn'].includes(request.action.kind)) continue
    try {
      world = reduceAction(world, base.player.address, request.action)
    } catch {
      /* authority decides rejection */
    }
  }
  const { players, ...shared } = world
  return { world: shared, player: players[base.player.address], session: base.session }
}
