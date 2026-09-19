import { clone, WorldState } from './types'
import { WorldRepository } from './persistence'

// Storage is a serialized backup of live memory, never the gameplay transaction lock.
// Keep an uncertain candidate unchanged until its manifest outcome is reconciled.
export class LiveAuthority {
  private backup: WorldState | null = null
  private saving: Promise<void> | null = null
  private durableRevision: number
  constructor(
    public state: WorldState,
    private repository: WorldRepository
  ) {
    this.durableRevision = state.revision
  }
  stage(next: WorldState): void {
    next.revision = this.state.revision + 1
    this.state = next
  }
  async checkpoint(): Promise<void> {
    if (this.saving) {
      await this.saving
      return this.checkpoint()
    }
    if (!this.backup && this.durableRevision === this.state.revision) return
    if (!this.backup) this.backup = clone(this.state)
    const candidate = this.backup
    this.saving = this.repository.commit(candidate)
    try {
      await this.saving
      this.durableRevision = candidate.revision
      this.backup = null
    } finally {
      this.saving = null
    }
  }
  // Reset is the sole durable gameplay barrier: an older backup cannot resurrect a reset world.
  async reset(next: WorldState): Promise<void> {
    if (this.saving) await this.saving
    if (this.backup) await this.checkpoint()
    next.revision = this.state.revision + 1
    this.backup = clone(next)
    await this.checkpoint()
    this.state = next
  }
}
