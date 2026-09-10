"""Check downloaded assets and converted skinned models without a browser."""
import hashlib,json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'assets/riot/manifest.json').read_text(encoding='utf8'))
for source in manifest['sources']:
    data=(ROOT/source['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==source['sha256'],source['path']
models=json.loads((ROOT/'assets/models/manifest.json').read_text(encoding='utf8'))
clips=0
for model in models['models']:
    data=(ROOT/model['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==model['sha256'],model['id']
    magic,version,size=struct.unpack_from('<III',data)
    assert magic==0x46546c67 and version==2 and size==len(data)
    length,kind=struct.unpack_from('<II',data,12)
    assert kind==0x4e4f534a
    gltf=json.loads(data[20:20+length])
    bin_length,bin_kind=struct.unpack_from('<II',data,20+length)
    assert bin_kind==0x004e4942
    assert gltf['skins'] and gltf['animations'] and gltf['images']
    for view in gltf['bufferViews']:
        assert view.get('byteOffset',0)+view['byteLength']<=bin_length
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            assert all(k in prim['attributes'] for k in ['POSITION','JOINTS_0','WEIGHTS_0','TEXCOORD_0'])
    for anim in gltf['animations']:
        for channel in anim['channels']:
            assert channel['target']['node']<len(gltf['nodes'])
    clips+=len(gltf['animations'])
    print('PASS',model['id'],len(gltf['animations']),'animation clips')
grid=json.loads((ROOT/'assets/map/manifest.json').read_text(encoding='utf8'))
assert grid['renderSize']==[8192,8192] and grid['gridSize']==[295,296]
print('PASS',len(manifest['sources']),'source hashes,',len(models['models']),'GLBs,',clips,'animations, authentic map dimensions')
