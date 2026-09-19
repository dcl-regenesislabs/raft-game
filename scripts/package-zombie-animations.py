"""Combine downloaded Meshy clips on one verified shared rig without re-encoding textures."""
import copy,json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/art/meshy/zombie-animation'
def read(path):
 b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0]
 return json.loads(b[20:20+n]),b[28+n:]
def accessor_bytes(g,b,index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']]
 assert 'sparse' not in a
 return b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
g,raw=read(SOURCE/'zombie-walk.glb');data=bytearray(raw);g['animations'][0]['name']='walk'
names={n['name']:i for i,n in enumerate(g['nodes'])};assert len(names)==len(g['nodes'])
for name in ['run','idle','attack','hit','death']:
 path=SOURCE/f'zombie-{name}.glb'
 if not path.exists():continue
 other,b=read(path);assert len(other['skins'])==1
 assert [other['nodes'][j]['name'] for j in other['skins'][0]['joints']]==[g['nodes'][j]['name'] for j in g['skins'][0]['joints']]
 assert accessor_bytes(g,data,g['skins'][0]['inverseBindMatrices'])==accessor_bytes(other,b,other['skins'][0]['inverseBindMatrices']), 'Different bind pose'
 assert len(other['animations'])==1
 clip=copy.deepcopy(other['animations'][0]);clip['name']=name
 cache={}
 def take(index):
  if index in cache:return cache[index]
  a=copy.deepcopy(other['accessors'][index]);v=copy.deepcopy(other['bufferViews'][a['bufferView']]);assert 'sparse' not in a
  data.extend(b'\0'*(-len(data)%4));offset=len(data);start=v.get('byteOffset',0);data.extend(b[start:start+v['byteLength']]);v.update(buffer=0,byteOffset=offset)
  a['bufferView']=len(g['bufferViews']);g['bufferViews'].append(v);cache[index]=len(g['accessors']);g['accessors'].append(a);return cache[index]
 for sampler in clip['samplers']:
  sampler['input']=take(sampler['input']);sampler['output']=take(sampler['output'])
 for channel in clip['channels']:
  channel['target']['node']=names[other['nodes'][channel['target']['node']]['name']]
 g['animations'].append(clip)
data.extend(b'\0'*(-len(data)%4));g['buffers']=[{'byteLength':len(data)}]
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
out=ROOT/'assets/scene/items/expansion/zombie-animated.glb'
out.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(j)+len(data))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(data),0x004e4942)+data)
report={'file':str(out.relative_to(ROOT)),'joints':len(g['skins'][0]['joints']),'bytes':out.stat().st_size,'clips':[{'name':a['name'],'channels':len(a['channels']),'duration_seconds':max(g['accessors'][s['input']]['max'][0] for s in a['samplers'])} for a in g['animations']]}
(SOURCE/'animation-inspection.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
