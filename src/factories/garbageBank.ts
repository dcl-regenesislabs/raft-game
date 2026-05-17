import { addCollected } from '../ui/inventoryState'
import { notifyItemReceived } from '../ui/itemReceivedNotification'
import { randInt } from '../utils/math'

// Barrel rope drop is weighted: rope is the bottleneck for the raft
// recipe, so the barrel almost always coughs up at least one and
// occasionally two — 75% / 10% / 15% for 1 / 2 / 0 ropes.
function rollRopeDrop(): number {
  const r = Math.random()
  if (r < 0.75) return 1
  if (r < 0.85) return 2
  return 0
}

// Pantry pool dropped by barrels — the COOKING.md "BARREL" sourced
// ingredients minus shark/fish (those come from sharks and the rod).
// Each barrel rolls a small bundle from this list so kitchens fill up
// without making any single barrel a guaranteed full pantry.
const BARREL_POOL = [
  'mussels', 'clams', 'seaweed', 'tomatoes', 'garlic',
  'olive_oil', 'potato', 'spaghetti', 'fettuccine', 'crab'
] as const

// Translate a collected debris kind into inventory deposits. Most kinds
// map 1:1 to a material; barrel unpacks into a small loot bundle (wood,
// rope roll, plus 2–3 random pantry items). Shared by the hook reel
// (`systems/hookThrower.ts`) and the direct look-grab path
// (`systems/garbageGrab.ts`).
export function bankGarbageKind(kind: string): void {
  if (kind === 'barrel') {
    // Always: a bit of wood for fuel continuity + a rope roll.
    const woodCount = randInt(1, 2)
    addCollected('wood', woodCount)
    notifyItemReceived('wood', woodCount)
    const ropeCount = rollRopeDrop()
    addCollected('rope', ropeCount)
    notifyItemReceived('rope', ropeCount)
    // 2–3 random pantry/sea ingredients per barrel.
    const drops = randInt(2, 3)
    for (let i = 0; i < drops; i++) {
      const pick = BARREL_POOL[Math.floor(Math.random() * BARREL_POOL.length)]
      addCollected(pick, 1)
      notifyItemReceived(pick, 1)
    }
    return
  }
  addCollected(kind, 1)
  notifyItemReceived(kind, 1)
}
