import { Schemas, engine } from '@dcl/sdk/ecs'

// Custom components for the scene live here.

// Drives a slow UV drift on a tiled plane so a still water texture looks like
// flowing water. Attached to the water-floor entity in `factories/water.ts`,
// consumed by `systems/waterScroll.ts`.
export const WaterScroll = engine.defineComponent('water-scroll', {
  // UV units per second on each axis. Different values per axis give the
  // surface a more natural drift.
  speedU: Schemas.Number,
  speedV: Schemas.Number,
  // Accumulated offsets (kept in [0, 1)).
  offsetU: Schemas.Number,
  offsetV: Schemas.Number,
  // Cached so the system can rebuild UVs without external knowledge.
  tileCount: Schemas.Number
})
