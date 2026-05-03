// Shared vertical levels for the scene. Keeping these in one place so the
// water surface, the seabed, and anything that floats stay in sync.

// Scene baseline elevation. Ground level — seabed sits on the parcel floor.
export const SCENE_BASE_Y = 0

// Y of the seabed (sand) plane.
export const SEABED_Y = SCENE_BASE_Y

// Y of the water surface. The platform and any floating prop should sit at
// this height so they look like they're resting on the water. Platform top
// lands at ~50 m (PLATFORM_SIZE_Y/2 above WATER_LEVEL).
export const WATER_LEVEL = SCENE_BASE_Y + 4

// World units per parcel side. Decentraland fixes this at 16 m.
export const PARCEL_SIZE_M = 16

// Parcel-grid extents per deployment target. The demo (italy2026.dcl.eth)
// runs in 5x5; the FULL game on raft.dcl.eth runs in 50x50.
export const DEMO_PARCEL_GRID = 5
export const FULL_PARCEL_GRID = 50

// Visual sea-flow direction on the XZ plane. Derived from the WaterScroll
// UV speeds in `factories/water2.ts` so floating debris drifts WITH the
// rendered water motion. Pre-normalized.
const _flowMag = Math.sqrt(0.04 * 0.04 + 0.025 * 0.025)
export const SEA_FLOW_DIR_X = 0.04 / _flowMag
export const SEA_FLOW_DIR_Z = 0.025 / _flowMag
