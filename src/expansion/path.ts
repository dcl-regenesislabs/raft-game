export type DeckCell = { id: number; x: number; z: number; blocked: boolean }
// Prefer clear deck routes, but return a breakable barrier if it is the only path.
export function nextDeckStep(cells: readonly DeckCell[], from: number, to: number): number | null {
  if (from === to) return to
  const byId = new Map(cells.map((cell) => [cell.id, cell]))
  const byGrid = new Map(cells.map((cell) => [`${cell.x},${cell.z}`, cell]))
  const scores = new Map<number, number>([[from, 0]])
  const previous = new Map<number, number>()
  const pending = new Set([from])
  while (pending.size) {
    const currentId = [...pending].sort((a, b) => scores.get(a)! - scores.get(b)!)[0]
    pending.delete(currentId)
    if (currentId === to) {
      let step = to
      while (previous.get(step) !== from) {
        const parent = previous.get(step)
        if (parent === undefined) return null
        step = parent
      }
      return step
    }
    const current = byId.get(currentId)
    if (!current) continue
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const neighbor = byGrid.get(`${current.x + dx},${current.z + dz}`)
      if (!neighbor) continue
      const score = scores.get(currentId)! + (neighbor.blocked ? 10 : 1)
      if (score >= (scores.get(neighbor.id) ?? Infinity)) continue
      scores.set(neighbor.id, score)
      previous.set(neighbor.id, currentId)
      pending.add(neighbor.id)
    }
  }
  return null
}
