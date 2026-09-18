"""Fit generated construction GLBs to gameplay dimensions without resampling textures.
Original exports are retained outside deployed assets. Node matrices include all fitting.
"""
import json, math, shutil, struct
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'docs/art/meshy/iteration-2'
SOURCE = ART / 'source-models'
SOURCE.mkdir(exist_ok=True)
# Width, height, depth in SDK metres; stairs ascend toward local +Z.
SIZES = {
    'wall': (2.7, 2, .25, 0), 'gate': (2.7, 2, .3, 0),
    'stairs': (2.4, 2.65, 2.7, 180), 'upperFloor': (2.7, 2.3, 2.7, 0),
    'railing': (2.7, 1, .3, 90), 'armoredFoundation': (2.9, .16, 2.9, 0),
    'towerPlatform': (2.7, 2.3, 2.7, 0), 'ropeBarricade': (2.7, 1, .25, 0),
    'spikeStrip': (2.7, .5, .7, 0), 'lookoutPost': (2.7, 3.65, 2.7, 0)
}
report = {}
for name, (w, h, d, yaw) in SIZES.items():
    dst = ROOT / f'assets/scene/items/expansion/{name}.glb'
    src = SOURCE / dst.name
    if not src.exists(): shutil.copy2(dst, src)
    raw = src.read_bytes()
    n = struct.unpack_from('<I', raw, 12)[0]
    gltf = json.loads(raw[20:20+n])
    assert len(gltf['nodes']) == 1 and gltf['nodes'][0]['matrix'] == [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
    assert not gltf.get('animations')
    a = gltf['accessors'][gltf['meshes'][0]['primitives'][0]['attributes']['POSITION']]
    lo, hi = a['min'], a['max']
    dims = [hi[i]-lo[i] for i in range(3)]
    target = (d,h,w) if yaw == 90 else (w,h,d)
    sx,sy,sz = [target[i]/dims[i] for i in range(3)]
    c,s = round(math.cos(math.radians(yaw))), round(math.sin(math.radians(yaw)))
    cx,cz = (lo[0]+hi[0])/2, (lo[2]+hi[2])/2
    gltf['nodes'][0]['matrix'] = [c*sx,0,-s*sx,0, 0,sy,0,0, s*sz,0,c*sz,0, -c*sx*cx-s*sz*cz,-sy*lo[1],s*sx*cx-c*sz*cz,1]
    data = json.dumps(gltf,separators=(',',':')).encode()
    data += b' ' * (-len(data)%4)
    tail = raw[20+n:]
    dst.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(data)+len(tail))+struct.pack('<II',len(data),0x4e4f534a)+data+tail)
    report[name] = {'source_dimensions': dims, 'node_scale': [sx,sy,sz], 'node_yaw_degrees':yaw,
                    'runtime_min':[-w/2,0,-d/2], 'runtime_max':[w/2,h,d/2], 'entity_scale':1,
                    'deck_offset':.2, 'animations':0, 'built_in_colliders':False}
(ART/'placement-audit.json').write_text(json.dumps(report,indent=2)+'\n')
