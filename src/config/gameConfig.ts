// Centralised gameplay tunables. Constants tied to single-system internals
// can stay alongside that system, but anything a designer might want to
// tune (timings, distances, populations, charges) lives here so the entire
// "feel" of the scene can be edited from one file.
//
// Add a constant here when:
//   - it's a numeric tuning knob that affects player-perceived behaviour,
//   - it would make sense to expose to a hot-reload / config-file flow,
//   - or it's referenced by more than one system.

// --- Debug -----------------------------------------------------------------
// Pre-seeds the inventory with crafting materials at scene start so we can
// exercise recipes without grinding. MUST be false on shipped builds.
export const DEBUG_SEED_INVENTORY = true

// --- Shark director --------------------------------------------------------
// Initial patrol population. The director scales up/down each frame from
// the patrol-ring circumference; this is just the t=0 value.
export const SHARK_INITIAL_COUNT = 3
// Initial patrol radius (m). Director recomputes from raft extent each frame.
export const SHARK_INITIAL_RADIUS = 12

// One scheduled attack per this interval (s). The clock only ticks while
// at least one destructible (non-Main) platform exists.
export const SHARK_ATTACK_INTERVAL_S = 5 * 60
export const SHARK_APPROACH_DURATION_S = 2.0
export const SHARK_BITE_DURATION_S = 5
export const SHARK_RETURN_DURATION_S = 3.0
// Exponential-smoothing rate for orbit centre + radius (s⁻¹).
export const SHARK_CENTER_LERP_K = 2.0
// Floor for the orbit radius — keeps sharks at a sensible distance even
// with just the base raft.
export const SHARK_RADIUS_MIN = 12
// Metres of clearance over the raft's max extent from centroid.
export const SHARK_RADIUS_MARGIN = 4
// Pulse frequency of the red↔wood tint during bite.
export const SHARK_PULSE_HZ = 2
// Target arc length (metres) along the patrol ring between adjacent sharks.
// Population scales so circumference / count ≈ this value.
export const SHARK_TARGET_ARC_PER_SHARK = 25
export const SHARK_MIN_COUNT = 3
export const SHARK_MAX_COUNT = 12
// Hysteresis band — must drift this far from the ideal count before we
// add or remove a shark. Prevents flapping near a boundary.
export const SHARK_RESIZE_HYSTERESIS = 0.6
// Pitch (deg) applied during the bite — negative tilts the nose up so the
// head rises onto the deck while the tail drops into the water.
export const SHARK_BITE_PITCH_DEG = -25
// Side-to-side yaw shake during the bite.
export const SHARK_BITE_SHAKE_AMP_DEG = 10
export const SHARK_BITE_SHAKE_HZ = 4
// Vertical offset (m) for the bite anchor relative to the water surface.
// Negative sinks the shark so only the head/snout breaches the deck edge.
export const SHARK_BITE_Y_OFFSET = -0.3
// Half-range of the orbit spacing speed multiplier; range becomes
// [1 - r, 1 + r].
export const SHARK_SPACING_MULT_RANGE = 0.3

// --- Survival drain --------------------------------------------------------
// Stat bars (life/hunger/thirst) are stored internally as 0..1, but designers
// reason about them as 0..100 percentages. Rates below are expressed in
// percentage-points-per-second; the system divides by 100 at apply time.
export const HUNGER_DRAIN_PCT_PER_S = 0.09
export const THIRST_DRAIN_PCT_PER_S = 0.11
// Life damage per second when EITHER hunger or thirst hits 0%.
export const LIFE_DAMAGE_SINGLE_PCT_PER_S = 0.75
// Life damage per second when BOTH hunger AND thirst are at 0% (replaces,
// does not stack with, the single-empty rate).
export const LIFE_DAMAGE_BOTH_PCT_PER_S = 1.5

// --- Hook thrower ----------------------------------------------------------
// Initial speed bounds along the aim direction. Charge ramps the throw
// from MIN (instant tap) up to MAX (held until the bar fills).
export const HOOK_MIN_THROW_SPEED = 6
export const HOOK_MAX_THROW_SPEED = 18
// Hold duration to fill the charge bar all the way (s). The throw fires
// automatically the instant the bar fills.
export const HOOK_CHARGE_DURATION_S = 0.5
// Slightly stronger than real gravity so the arc resolves quickly and
// reads as a "throw" rather than a slow lob.
export const HOOK_GRAVITY = 18
// Constant horizontal speed of the hook while floating back to the player.
export const HOOK_REEL_SPEED = 7
// Despawn radius on the XZ plane — the hook disappears when this close.
export const HOOK_REEL_DESPAWN_RADIUS_XZ = 1.2
// Safety: force-transition into floating after this much airtime.
export const HOOK_MAX_FLIGHT_TIME_S = 6
// XZ capture radius around the hook. Checked on splashdown and again every
// frame while the hook floats/reels, so items drifting near the line get
// snagged dynamically rather than only those crossed at the moment of impact.
export const HOOK_COLLECT_RADIUS_XZ = 1.8
// Mid-air wobble amplitude (deg) and frequency.
export const HOOK_WOBBLE_AMPLITUDE_DEG = 9
export const HOOK_WOBBLE_FREQ = 22
// Wobble dampener applied during reeling. <1 reduces tumble vs flight.
export const HOOK_REEL_WOBBLE_SCALE = 0.45
