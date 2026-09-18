// Native GLB bounds include node transforms (all iteration-one nodes are identity).
// The raft deck is 0.2m above its logical platform origin.
export type ExpansionModel = {
  src: string
  scale: number
  min: readonly [number, number, number]
  max: readonly [number, number, number]
  deckOffset: number
}
function model(id: string, scale: number, min: ExpansionModel['min'], max: ExpansionModel['max']): ExpansionModel {
  return { src: `assets/scene/items/expansion/${id}.glb`, scale, min, max, deckOffset: 0.2 - min[1] * scale }
}
export const EXPANSION_MODELS: Readonly<Record<string, ExpansionModel>> = {
  workbench: model('workbench', 1.8, [-0.5, -0.292968988, -0.386718988], [0.5, 0.289061993, 0.380858988]),
  armoryBench: model('armoryBench', 1.8, [-0.5, -0.371093988, -0.330078006], [0.5, 0.367188007, 0.332031012]),
  engineeringBench: model('engineeringBench', 1.8, [-0.482421994, -0.5, -0.353516012], [0.484375, 0.5, 0.355468988]),
  smelter: model('smelter', 1.5, [-0.396483988, -0.5, -0.390625], [0.396483988, 0.5, 0.394531012]),
  researchTable: model('researchTable', 1.8, [-0.5, -0.287108988, -0.316406012], [0.5, 0.283203006, 0.320311993]),
  rainCollector: model('rainCollector', 1.8, [-0.5, -0.4375, -0.5], [0.5, 0.439453006, 0.5]),
  cropBed: model('cropBed', 1.6, [-0.337891012, -0.219726995, -0.5], [0.339843988, 0.219726995, 0.5]),
  waterTank: model('waterTank', 1.6, [-0.392578006, -0.433593988, -0.5], [0.396483988, 0.431641012, 0.5]),
  improvedGrill: model('improvedGrill', 1.4, [-0.5, -0.253906012, -0.34375], [0.5, 0.251953006, 0.345703006]),
  ammoCrate: model('ammoCrate', 1.2, [-0.5, -0.235351995, -0.380858988], [0.5, 0.235351995, 0.378906012]),
}
export function getExpansionModel(kind: string): ExpansionModel | undefined {
  return EXPANSION_MODELS[kind]
}
