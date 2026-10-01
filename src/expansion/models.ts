// Native GLB bounds include node transforms; iteration two is fitted by scripts/prepare-iteration-two-models.py.
import { RAFT_DECK_SURFACE_OFFSET_M } from '../factories/sceneLevels'

// Uniform scales preserve Meshy proportions; benches include their tabletop props.
export type ExpansionModel = {
  src: string
  scale: number
  min: readonly [number, number, number]
  max: readonly [number, number, number]
  deckOffset: number
}
function model(id: string, scale: number, min: ExpansionModel['min'], max: ExpansionModel['max']): ExpansionModel {
  return { src: `assets/scene/items/expansion/${id}.glb`, scale, min, max, deckOffset: RAFT_DECK_SURFACE_OFFSET_M - min[1] * scale }
}
export const EXPANSION_MODELS: Readonly<Record<string, ExpansionModel>> = {
  workbench: model('workbench', 1.5, [-0.5, -0.292968988, -0.386718988], [0.5, 0.289061993, 0.380858988]),
  armoryBench: model('armoryBench', 1.5, [-0.5, -0.371093988, -0.330078006], [0.5, 0.367188007, 0.332031012]),
  engineeringBench: model('engineeringBench', 1.35, [-0.482421994, -0.5, -0.353516012], [0.484375, 0.5, 0.355468988]),
  smelter: model('smelter', 1.35, [-0.396483988, -0.5, -0.390625], [0.396483988, 0.5, 0.394531012]),
  researchTable: model('researchTable', 1.5, [-0.5, -0.287108988, -0.316406012], [0.5, 0.283203006, 0.320311993]),
  rainCollector: model('rainCollector', 1.5, [-0.5, -0.4375, -0.5], [0.5, 0.439453006, 0.5]),
  cropBed: model('cropBed', 1.6, [-0.337891012, -0.219726995, -0.5], [0.339843988, 0.219726995, 0.5]),
  waterTank: model('waterTank', 1.4, [-0.392578006, -0.433593988, -0.5], [0.396483988, 0.431641012, 0.5]),
  improvedGrill: model('improvedGrill', 1.4, [-0.5, -0.253906012, -0.34375], [0.5, 0.251953006, 0.345703006]),
  ammoCrate: model('ammoCrate', 0.9, [-0.5, -0.235351995, -0.380858988], [0.5, 0.235351995, 0.378906012]),
  wall: model('wall', 1, [-1.35, 0, -0.125], [1.35, 2, 0.125]),
  gate: model('gate', 1, [-1.35, 0, -0.15], [1.35, 2, 0.15]),
  stairs: model('stairs', 1, [-1.2, 0, -1.35], [1.2, 2.65, 1.35]),
  upperFloor: model('upperFloor', 1, [-1.35, 0, -1.35], [1.35, 2.3, 1.35]),
  railing: model('railing', 1, [-1.35, 0, -0.15], [1.35, 1, 0.15]),
  armoredFoundation: model('armoredFoundation', 1, [-1.45, 0, -1.45], [1.45, 0.16, 1.45]),
  towerPlatform: model('towerPlatform', 1, [-1.35, 0, -1.35], [1.35, 2.3, 1.35]),
  ropeBarricade: model('ropeBarricade', 1, [-1.35, 0, -0.125], [1.35, 1, 0.125]),
  spikeStrip: model('spikeStrip', 1, [-1.35, 0, -0.35], [1.35, 0.5, 0.35]),
  lookoutPost: model('lookoutPost', 1, [-1.35, 0, -1.35], [1.35, 3.65, 1.35]),
  netLauncher: model('netLauncher', 1.5, [-0.490233988, -0.5, -0.335938007], [0.490233988, 0.5, 0.337891012]),
  ballista: model('ballista', 1.8, [-0.5, -0.283203006, -0.4375], [0.5, 0.28125, 0.435546994]),
  harpoonTower: model('harpoonTower', 1.6, [-0.347656012, -0.5, -0.496093988], [0.355468988, 0.5, 0.5]),
  deckCannon: model('deckCannon', 1.6, [-0.5, -0.400391012, -0.378906012], [0.5, 0.400391012, 0.382811993]),
  alarmBell: model('alarmBell', 1.5, [-0.206055, -0.400391012, -0.5], [0.207030997, 0.400391012, 0.5]),
  sail: model('sail', 2.7, [-0.5, -0.5, -0.255858988], [0.5, 0.5, 0.255858988]),
  steeringWheel: model('steeringWheel', 1.3, [-0.421875, -0.5, -0.137695], [0.425781012, 0.5, 0.136719003]),
  engine: model('engine', 1.5, [-0.5, -0.457031012, -0.458983988], [0.5, 0.457031012, 0.460938007]),
  generator: model('generator', 1.4, [-0.337891012, -0.320311993, -0.5], [0.341796994, 0.318358988, 0.5]),
  batteryBank: model('batteryBank', 1.2, [-0.5, -0.386718988, -0.269531012], [0.5, 0.384766012, 0.271483988]),
  powerRelay: model('powerRelay', 1.1, [-0.265625, -0.5, -0.263671994], [0.267578006, 0.5, 0.265625]),
  antennaMast: model('antennaMast', 3, [-0.371093988, -0.5, -0.182616994], [0.375, 0.5, 0.180664003]),
  rescueRadio: model('rescueRadio', 0.9, [-0.5, -0.206055, -0.322266012], [0.5, 0.205078006, 0.322266012]),
  zombie: model('zombie', 1.8, [-0.279296994, -0.5, -0.173828006], [0.28125, 0.5, 0.179688007])
}
export function getExpansionModel(kind: string): ExpansionModel | undefined {
  return EXPANSION_MODELS[kind]
}
