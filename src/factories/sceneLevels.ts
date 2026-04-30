// Shared vertical levels for the scene. Keeping these in one place so the
// water surface, the seabed, and anything that floats stay in sync.

// Scene baseline elevation. The whole pond sits this high in the sky so the
// scene reads as a floating arena above the rest of the world.
export const SCENE_BASE_Y = 200

// Y of the seabed (sand) plane.
export const SEABED_Y = SCENE_BASE_Y

// Y of the water surface. The platform and any floating prop should sit at
// this height so they look like they're resting on the water.
export const WATER_LEVEL = SCENE_BASE_Y + 4
