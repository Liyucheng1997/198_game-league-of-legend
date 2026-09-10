"""Import a pinned 2024 Summoner's Rift render and its matching navgrid."""
from pathlib import Path
import urllib.request
import hashlib
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'map'
REF='92943ed2b2d5e82c86d680e69f53f247c89aefee'
BASE=f'https://raw.githubusercontent.com/FrankTheBoxMonster/LoL-NGRID-converter/{REF}/'
FILES={'source/Base.png':'SR_2024/renders/Base.png','source/VisionPathing.bmp':'SR_2024/navgrids/Base/AIPath_SRX_3.VisionPathing.bmp','source/Base.LSGNGRID':'SR_2024/navgrids/Base/AIPath_SRX_3.LSGNGRID','SOURCE-LICENSE.txt':'LICENSE'}
sources=[]
for path,remote in FILES.items():
    dest=OUT/path;dest.parent.mkdir(parents=True,exist_ok=True)
    if not dest.exists():
        print('Fetching',remote,flush=True)
        with urllib.request.urlopen(BASE+remote,timeout=120) as response,dest.with_suffix(dest.suffix+'.part').open('wb') as output:
            while chunk:=response.read(1024*1024):output.write(chunk)
        dest.with_suffix(dest.suffix+'.part').replace(dest)
    data=dest.read_bytes();sources.append({'url':BASE+remote,'file':str(dest.relative_to(ROOT)).replace('\\','/'),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
img=Image.open(OUT/'source/Base.png');print('Map dimensions',img.size,flush=True)
img.convert('RGB').save(OUT/'summoners-rift-2024.webp','WEBP',quality=92,method=6)
nav=Image.open(OUT/'source/VisionPathing.bmp').convert('RGB');print('Navgrid',nav.size,'colors',nav.getcolors(256),flush=True)
nav.resize((1180,1184),Image.Resampling.NEAREST).save(OUT/'navgrid-preview.png')
colors={(255,255,255):0,(0,122,14):1,(64,64,64):2,(0,210,214):3,(0,216,111):4,(87,79,255):5,(12,0,255):5,(255,124,124):6,(255,0,0):6}
grid=''.join(str(colors.get(p,2)) for p in nav.getdata())
(ROOT/'js'/'rift-grid.js').write_text('/* 2024 Riot navigation cells, exported by FrankTheBoxMonster. See assets/map/manifest.json. */\nconst RIFT_GRID='+json.dumps({'width':nav.width,'height':nav.height,'flags':grid,'season':2024},separators=(',',':'))+';\n',encoding='utf-8')
(OUT/'manifest.json').write_text(json.dumps({'repository':'https://github.com/FrankTheBoxMonster/LoL-NGRID-converter','commit':REF,'season':2024,'sources':sources,'renderSize':img.size,'gridSize':nav.size},indent=2),encoding='utf-8')
