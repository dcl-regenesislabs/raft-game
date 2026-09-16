// Autowiring is derived from placement every tick: no wire entities, saved links,
// or connection action. Consumers never bridge networks.
export const AUTO_WIRE_RANGE_M = 7
export type PowerNode = {
  id: number
  kind: string
  x: number
  z: number
  fuel: number
  stock: number
}
const conducts = (kind: string) => ['generator', 'batteryBank', 'powerRelay'].includes(kind)
export function powerSources(nodes: readonly PowerNode[], consumer: number): PowerNode[] {
  const start = nodes.find((node) => node.id === consumer)
  if (!start) return []
  const seen = new Set<number>([start.id])
  const queue = [start]
  const sources: PowerNode[] = []
  while (queue.length) {
    const current = queue.shift()!
    if ((current.kind === 'generator' && current.fuel > 0) || (current.kind === 'batteryBank' && current.stock > 0))
      sources.push(current)
    for (const next of nodes) {
      if (seen.has(next.id) || !conducts(next.kind) || Math.hypot(current.x - next.x, current.z - next.z) > AUTO_WIRE_RANGE_M) continue
      seen.add(next.id)
      queue.push(next)
    }
  }
  return sources
}
// Generator time is shared; batteries pay only the unmet portion of each load.
// Mutates battery stock in this snapshot so multiple consumers cannot double-spend.
export function supplyPower(nodes: PowerNode[], consumer: number, seconds: number): number {
  const sources = powerSources(nodes, consumer)
  const generatorTime = Math.min(
    seconds,
    Math.max(0, ...sources.filter((node) => node.kind === 'generator').map((node) => node.fuel))
  )
  let supplied = generatorTime
  for (const battery of sources.filter((node) => node.kind === 'batteryBank')) {
    const used = Math.min(seconds - supplied, battery.stock)
    battery.stock -= used
    supplied += used
    if (supplied >= seconds) break
  }
  return supplied
}
