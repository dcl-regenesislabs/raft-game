import {
  EVENT_CHEF_COOLDOWN_S,
  EVENT_ISLAND_FIRST_S,
  EVENT_ISLAND_INTERVAL_S,
  EVENT_SHARK_FIRST_S,
  EVENT_SHARK_INTERVAL_S
} from '../config/gameConfig'
import { armBoatChefEvent, isBoatChefActive } from './boatChefDirector'
import { triggerIslandSpawn } from './islandSpawner'
import { triggerSharkAttack } from './sharkDirector'
import { isTier4Recipe, pickRandomTier3PlateId } from '../ui/cookableItems'
import { addCollected } from '../ui/inventoryState'
import { notifyItemReceived } from '../ui/itemReceivedNotification'
import { isStartupGateActive } from '../ui/startupGate'

// Central event scheduler. One frame picks AT MOST one scripted action.
//
//   sharks   — first at EVENT_SHARK_FIRST_S, then every
//              EVENT_SHARK_INTERVAL_S (deterministic).
//   islands  — first at EVENT_ISLAND_FIRST_S, then every
//              EVENT_ISLAND_INTERVAL_S (deterministic).
//   chef     — event-driven: tier-4 craft completion OR the first time
//              hunger drops to 20 %. Both are gated by a single
//              cooldown that begins the moment the boat sails away.
//
// The directors (`sharkDirector`, `islandSpawner`, `boatChefDirector`)
// no longer own their own scheduling clocks — they expose fire-on-demand
// entry points and this system decides when to call them.
//
// Time here is "scene time outside the startup gate" — the clock pauses
// while the lobby UI is up and the run hasn't started yet.

let gameElapsedS = 0
let nextSharkDueS = EVENT_SHARK_FIRST_S
let nextIslandDueS = EVENT_ISLAND_FIRST_S

let chefCooldownS = 0
let chefPendingTier4 = false
let chefPendingLowHunger = false
let lowHungerFired = false
let chefWasActive = false

// --- public API ---

// Called from `cookGrab.ts` the moment a fresh plate enters the
// inventory. Non-tier-4 ids are dropped silently so the hook stays a
// single line at the call site.
export function notifyTier4Crafted(itemId: string): void {
  if (!isTier4Recipe(itemId)) return
  chefPendingTier4 = true
}

// Called from `survivalDrain.ts` the frame hunger transitions from
// > 20 % to ≤ 20 %. One-shot per run — subsequent calls are dropped so
// the chef never gifts the survival plate twice.
export function notifyHungerCrossedLow(): void {
  if (lowHungerFired) return
  lowHungerFired = true
  chefPendingLowHunger = true
}

// DEBUG / SKIP_LOBBY hook so the island encounter fires on the next
// tick instead of after EVENT_ISLAND_FIRST_S. Cadence-tracking resumes
// normally on the post-fire advance.
export function forceImmediateIslandSpawn(): void {
  nextIslandDueS = gameElapsedS
}

// Wipes scheduler state. `returnToLobby` calls this alongside the
// other module-state resets so a fresh portal entry starts the clock
// at zero and re-arms the one-shot low-hunger trigger.
export function resetEventScheduler(): void {
  gameElapsedS = 0
  nextSharkDueS = EVENT_SHARK_FIRST_S
  nextIslandDueS = EVENT_ISLAND_FIRST_S
  chefCooldownS = 0
  chefPendingTier4 = false
  chefPendingLowHunger = false
  lowHungerFired = false
  chefWasActive = false
}

// --- system ---

export function eventSchedulerSystem(dt: number): void {
  if (isStartupGateActive()) return

  // Falling edge — the boat just sailed off this frame, so the 5-minute
  // cooldown starts now. (Tracks last frame's `isBoatChefActive()`.)
  const chefActive = isBoatChefActive()
  if (chefWasActive && !chefActive) {
    chefCooldownS = EVENT_CHEF_COOLDOWN_S
  }
  chefWasActive = chefActive

  if (chefCooldownS > 0) {
    chefCooldownS = Math.max(0, chefCooldownS - dt)
  }

  // Chef priority — player-driven event preempts the scheduled ones.
  // A single visit collapses both reasons when both are queued; the
  // low-hunger gift still fires so the player doesn't lose it.
  if (
    !chefActive &&
    chefCooldownS === 0 &&
    (chefPendingTier4 || chefPendingLowHunger)
  ) {
    if (chefPendingLowHunger) {
      const plateId = pickRandomTier3PlateId()
      if (plateId !== null) {
        addCollected(plateId, 1)
        notifyItemReceived(plateId, 1)
      }
    }
    armBoatChefEvent()
    chefPendingTier4 = false
    chefPendingLowHunger = false
    return
  }

  // No chef firing this frame — accumulate scene time and check the
  // scheduled events. Only one fires per tick.
  gameElapsedS += dt

  // Scheduled sharks. Trigger fails when there's no destructible
  // platform or no idle shark; we retry every frame until it succeeds.
  if (!chefActive && gameElapsedS >= nextSharkDueS) {
    if (triggerSharkAttack()) {
      nextSharkDueS += EVENT_SHARK_INTERVAL_S
      // Skip any slots we missed entirely (e.g. the player spent the
      // gap with no destructibles) so we don't dump a burst of catch-up
      // bites the moment a platform exists.
      while (nextSharkDueS <= gameElapsedS) {
        nextSharkDueS += EVENT_SHARK_INTERVAL_S
      }
    }
    return
  }

  // Scheduled islands. Same retry / catch-up shape.
  if (!chefActive && gameElapsedS >= nextIslandDueS) {
    if (triggerIslandSpawn()) {
      nextIslandDueS += EVENT_ISLAND_INTERVAL_S
      while (nextIslandDueS <= gameElapsedS) {
        nextIslandDueS += EVENT_ISLAND_INTERVAL_S
      }
    }
    return
  }
}
