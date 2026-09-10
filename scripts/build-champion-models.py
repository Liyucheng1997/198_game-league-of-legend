"""Convert public archived lmesh/lanim assets to self-contained glTF 2.0.

Source format documented by tengge1/lol-model-viewer (MIT viewer code).
Original character mesh, textures and animations remain Riot Games assets.
These are archived classic models, not models from patch 14.24.1.
Requires numpy. No proprietary client installation or API credentials.
"""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import re
import struct
import urllib.request
import zlib
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'models'
REF='ef5635c5fbe0c315275c9bcccf83558cfe7ee436'
BASE=f'https://raw.githubusercontent.com/tengge1/lol-model-viewer/{REF}/LOLModelViewer/LOLModelViewer/resource/'
HEROES={'garen':86,'darius':122,'ashe':22,'caitlyn':51,'ahri':103,'lux':99,'annie':1,'yi':11,'malphite':54,'soraka':16}

class Reader:
    def __init__(self,data):self.data=data;self.i=0
    def read(self,fmt):
        n=struct.calcsize('<'+fmt);v=struct.unpack_from('<'+fmt,self.data,self.i);self.i+=n;return v[0] if len(v)==1 else v
    def string(self):
        n=self.read('H');s=self.data[self.i:self.i+n].decode('utf-8');self.i+=n;return s

def download(url,path):
    path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists():
        with urllib.request.urlopen(url,timeout=60) as response:path.write_bytes(response.read())
    return path.read_bytes()

def quaternion(mat):
    # Stable matrix-to-quaternion conversion; glTF uses XYZW.
    m=mat;tr=float(np.trace(m))
    if tr>0:
        s=np.sqrt(tr+1)*2;q=[(m[2,1]-m[1,2])/s,(m[0,2]-m[2,0])/s,(m[1,0]-m[0,1])/s,s/4]
    else:
        i=int(np.argmax(np.diag(m)));j=(i+1)%3;k=(i+2)%3;s=np.sqrt(max(0,1+m[i,i]-m[j,j]-m[k,k]))*2
        q=[0.,0.,0.,0.];q[i]=s/4;q[j]=(m[j,i]+m[i,j])/s;q[k]=(m[k,i]+m[i,k])/s;q[3]=(m[k,j]-m[j,k])/s
    q=np.asarray(q);return (q/np.linalg.norm(q)).tolist()

def convert(entry):
    name,cid=entry;sources=[]
    def get(rel):
        data=download(BASE+rel,OUT/'source'/str(cid)/Path(rel).name)
        sources.append({'url':BASE+rel,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
        return data
    r=Reader(get(f'models/{cid}_0.lmesh'))
    assert r.read('I')==604210091
    version=r.read('I');anim_name=r.string();texture_name=r.string();meshes=[]
    for _ in range(r.read('I')):meshes.append({'name':r.string().lower(),'vStart':r.read('I'),'vCount':r.read('I'),'iStart':r.read('I'),'iCount':r.read('I')})
    nv=r.read('I');vertices=[];joints=[];weights=[]
    for _ in range(nv):vertices.append(r.read('8f'));joints.append(r.read('4B'));weights.append(r.read('4f'))
    indices=np.array(r.read(str(r.read('I'))+'H'),dtype='<u2');bones=[]
    for i in range(r.read('I')):
        bone={'name':r.string().lower(),'parent':r.read('i'),'scale':r.read('f'),'global':np.array(r.read('16f')).reshape(4,4)}
        if version>=2:bone['local']=np.array(r.read('16f')).reshape(4,4)
        bones.append(bone)
    assert r.i==len(r.data),(name,r.i,len(r.data))
    texture=get(f'textures/{cid}/{texture_name}.png')
    r=Reader(get(f'models/{anim_name}.lanim'));assert r.read('I')==604210092
    av=r.read('I')
    if av>=2:r=Reader(zlib.decompress(r.data[r.i:]))
    clips=[]
    for _ in range(r.read('I')):
        clip={'name':r.string().lower(),'fps':r.read('i'),'tracks':[]}
        for _ in range(r.read('I')):
            nf=r.read('I');bn=r.string().lower();flags=r.read('I');n=10 if av>=3 else 7
            frames=np.frombuffer(r.data,dtype='<f4',count=nf*n,offset=r.i).reshape(nf,n).copy();r.i+=nf*n*4
            clip['tracks'].append({'bone':bn,'frames':frames})
        if re.search(r'(^idle|^run|^walk|^attack|^spell[1-4]|^death|^recall)',clip['name']) and clip['fps']>1:clips.append(clip)
    # GLB buffer builder.
    binary=bytearray();views=[];accessors=[]
    def blob(data):
        while len(binary)%4:binary.append(0)
        offset=len(binary);binary.extend(data);views.append({'buffer':0,'byteOffset':offset,'byteLength':len(data)});return len(views)-1
    def accessor(data,typ,component=5126,bounds=False):
        a=np.asarray(data,dtype={5126:'<f4',5123:'<u2'}[component]);count=len(a);out={'bufferView':blob(a.tobytes()),'componentType':component,'count':count,'type':typ}
        if bounds:out.update(min=a.min(axis=0).reshape(-1).tolist(),max=a.max(axis=0).reshape(-1).tolist())
        accessors.append(out);return len(accessors)-1
    v=np.array(vertices,dtype='<f4');pos=accessor(v[:,:3],'VEC3',bounds=True);normal=accessor(v[:,3:6],'VEC3');uv=accessor(v[:,6:8],'VEC2');joint=accessor(joints,'VEC4',5123);w=np.array(weights);w/=np.maximum(w.sum(axis=1,keepdims=True),1e-9);weight=accessor(w,'VEC4')
    nodes=[]
    lookup={}
    for i,b in enumerate(bones):
        bn=b['name'];bn=bn+'2' if bn in lookup else bn;lookup[bn]=i
        local=b.get('local',np.linalg.inv(bones[b['parent']]['global'])@b['global'] if b['parent']>=0 else b['global'])
        scale=np.linalg.norm(local[:3,:3],axis=0);rot=local[:3,:3]/np.maximum(scale,1e-9)
        nodes.append({'name':bn,'translation':local[:3,3].tolist(),'rotation':quaternion(rot),'scale':scale.tolist()})
    roots=[]
    for i,b in enumerate(bones):
        if b['parent']<0:roots.append(i)
        else:nodes[b['parent']].setdefault('children',[]).append(i)
    invbind=accessor([np.linalg.inv(b['global']).T.flatten() for b in bones],'MAT4')
    primitives=[]
    for m in meshes:
        idx=accessor(indices[m['iStart']:m['iStart']+m['iCount']],'SCALAR',5123)
        primitives.append({'attributes':{'POSITION':pos,'NORMAL':normal,'TEXCOORD_0':uv,'JOINTS_0':joint,'WEIGHTS_0':weight},'indices':idx,'material':0})
    nodes.append({'name':name,'mesh':0,'skin':0});roots.append(len(nodes)-1)
    animations=[]
    for clip in clips:
        anim={'name':clip['name'],'channels':[],'samplers':[]}
        for track in clip['tracks']:
            if track['bone'] not in lookup:continue
            frames=track['frames'];nf=len(frames)
            if nf<1:continue
            # Keep native frame timing, reduce 30fps sources to 15fps for local size.
            idx=np.unique(np.r_[np.arange(0,nf,max(1,clip['fps']//15)),nf-1]).astype(int);frames=frames[idx]
            times=accessor(idx.astype(float)/clip['fps'],'SCALAR',bounds=True)
            for path,data in [('translation',frames[:,:3]),('rotation',frames[:,3:7]),('scale',frames[:,7:10] if av>=3 else np.ones((len(idx),3)))]:
                if path=='rotation':data=data/np.maximum(np.linalg.norm(data,axis=1,keepdims=True),1e-8)
                out=accessor(data,'VEC4' if path=='rotation' else 'VEC3');sid=len(anim['samplers']);anim['samplers'].append({'input':times,'output':out,'interpolation':'LINEAR'});anim['channels'].append({'sampler':sid,'target':{'node':lookup[track['bone']],'path':path}})
        if anim['channels']:animations.append(anim)
    texture_view=blob(texture)
    gltf={'asset':{'version':'2.0','generator':'Rift archive converter','copyright':'Character assets © Riot Games; archival source tengge1/lol-model-viewer'},'scene':0,'scenes':[{'nodes':roots}],'nodes':nodes,'meshes':[{'primitives':primitives}],'skins':[{'joints':list(range(len(bones))),'inverseBindMatrices':invbind}],'materials':[{'name':'Base skin','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':1},'doubleSided':True,'alphaMode':'MASK','alphaCutoff':.35,'extensions':{'KHR_materials_unlit':{}}}],'extensionsUsed':['KHR_materials_unlit'],'textures':[{'source':0,'sampler':0}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'images':[{'bufferView':texture_view,'mimeType':'image/png'}],'animations':animations,'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors}
    js=json.dumps(gltf,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary.extend(b'\0'*((-len(binary))%4))
    output=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(binary),0x004E4942)+binary
    (OUT/(name+'.glb')).write_bytes(output)
    report={'id':name,'championKey':cid,'file':f'assets/models/{name}.glb','bytes':len(output),'sha256':hashlib.sha256(output).hexdigest(),'vertices':nv,'bones':len(bones),'clips':[a['name'] for a in animations],'sources':sources}
    print(name,nv,'vertices',len(bones),'bones',len(animations),'animations',flush=True)
    return report

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:models=list(pool.map(convert,HEROES.items()))
    (OUT/'manifest.json').write_text(json.dumps({'repository':'https://github.com/tengge1/lol-model-viewer','commit':REF,'modelEra':'archived classic; not 14.24.1','models':models},ensure_ascii=False,indent=2),encoding='utf-8')
    vendor=ROOT/'js'/'vendor';vendor.mkdir(exist_ok=True)
    for remote,local in [('build/three.module.js','three.module.js'),('examples/jsm/loaders/GLTFLoader.js','GLTFLoader.js'),('examples/jsm/utils/BufferGeometryUtils.js','BufferGeometryUtils.js'),('examples/jsm/utils/SkeletonUtils.js','SkeletonUtils.js'),('LICENSE','THREE-LICENSE.txt')]:
        data=download('https://cdn.jsdelivr.net/npm/three@0.160.1/'+remote,vendor/local)
        if local=='GLTFLoader.js':(vendor/local).write_text(data.decode().replace('../utils/BufferGeometryUtils.js','./BufferGeometryUtils.js'),encoding='utf-8')
    download(f'https://raw.githubusercontent.com/tengge1/lol-model-viewer/{REF}/LICENSE',OUT/'VIEWER-LICENSE.txt')
    print('Ten animated GLB files and local Three.js runtime ready.')
