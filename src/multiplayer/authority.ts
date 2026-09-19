import { Request, ActionResult, WorldState, RESET_ADMIN, PROTOCOL_VERSION, clone } from './types'
import { freshPlayer, freshWorld, reduceAction } from './world'
import { WorldRepository } from './persistence'

export function executeRequest(
  world: WorldState,
  address: string,
  request: Request
): { world: WorldState; result: ActionResult } {
  address = address.toLowerCase()
  const result: ActionResult = {
    session: request.session,
    sequence: request.sequence,
    ok: false,
    error: '',
    generation: world.generation,
    revision: world.revision
  }
  const prior = world.players[address]?.sessions[request.session]
  if (request.protocol !== PROTOCOL_VERSION || request.generation !== world.generation)
    return { world, result: { ...result, error: 'World changed; reconnecting' } }
  if (!prior) return { world, result: { ...result, error: 'Join first' } }
  if (request.sequence === prior.sequence) return { world, result: { ...result, ok: prior.ok, error: prior.error } }
  if (request.sequence !== prior.sequence + 1)
    return { world, result: { ...result, error: 'Request sequence mismatch' } }
  let next = world
  try {
    if (request.action.kind === 'reset') {
      if (address !== RESET_ADMIN) throw new Error('Only the world administrator may reset')
      next = freshWorld(world.generation + 1)
      next.revision = world.revision
      next.players[address] = freshPlayer(address)
      next.players[address].sessions[request.session] = clone(prior)
    } else next = reduceAction(world, address, request.action)
    result.ok = true
  } catch (error) {
    next = clone(world)
    result.error = error instanceof Error ? error.message : 'Invalid action'
  }
  next.players[address].sessions[request.session] = { sequence: request.sequence, ok: result.ok, error: result.error }
  result.generation = next.generation
  return { world: next, result }
}

// Holds the exact candidate on failure: no new action or simulation can overtake an uncertain commit.
export class CommitCoordinator {
  private candidate: WorldState | null = null
  private inFlight = false
  constructor(
    public committed: WorldState,
    private repository: WorldRepository
  ) {}
  get pending(): boolean {
    return this.candidate !== null
  }
  stage(next: WorldState): void {
    if (this.candidate) throw new Error('Commit already pending')
    next.revision = this.committed.revision + 1
    this.candidate = next
  }
  async flush(): Promise<boolean> {
    if (this.inFlight || !this.candidate) return false
    this.inFlight = true
    try {
      await this.repository.commit(this.candidate)
      this.committed = this.candidate
      this.candidate = null
      return true
    } finally {
      this.inFlight = false
    }
  }
}
