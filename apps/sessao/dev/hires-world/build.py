"""Export original/restored sources into registered game and browser delivery tiers."""
from pathlib import Path
from PIL import Image
from scipy import ndimage
import numpy as np,json,sys
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=ROOT/'public/assets/world-hd'
OUT.mkdir(exist_ok=True)
records=json.loads((HERE/'manifest.json').read_text())
registry=json.loads((ROOT/'src/world-assets.json').read_text()) if len(sys.argv)>1 else {};portraits=[]
FEDERAL_X=[.5,10,1,10,-.5,6,0,6,0,8.5,.5,8.5]
def box(im):return im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
def cell(im,n,grid):
 c,r=grid;return im.crop(tuple(map(round,(n%c*im.width/c,n//c*im.height/r,(n%c+1)*im.width/c,(n//c+1)*im.height/r))))
def body(im):
 a=np.array(im.getchannel('A'));labels,count=ndimage.label(a>16)
 if count:
  sizes=np.bincount(labels.ravel());sizes[0]=0;keep=ndimage.binary_dilation(labels==sizes.argmax(),iterations=2);a[~keep]=0;im.putalpha(Image.fromarray(a))
 return im
def fit(source,target,size,offset=0,stretch=False):
 b=box(source);t=box(target)
 if not b or not t:raise ValueError('Empty source or target')
 sx,sy=size[0]/target.width,size[1]/target.height
 w,h=b[2]-b[0],b[3]-b[1];scale=min((t[2]-t[0])*sx/w,(t[3]-t[1])*sy/h,(size[0]-4)/w,(size[1]-4)/h)
 art_size=(min(size[0]-4,max(1,round((t[2]-t[0])*sx))),min(size[1]-4,max(1,round((t[3]-t[1])*sy)))) if stretch else (max(1,round(w*scale)),max(1,round(h*scale)))
 art=source.crop(b).resize(art_size,Image.Resampling.LANCZOS)
 x=round((t[0]+t[2])/2*sx-art.width/2+offset*sx);y=round(t[3]*sy-art.height)
 x=max(2,min(size[0]-2-art.width,x));y=max(2,min(size[1]-2-art.height,y))
 canvas=Image.new('RGBA',size);canvas.alpha_composite(art,(x,y));return canvas
for rec in records:
 if len(sys.argv)>1 and not any(rec['id'].startswith(prefix) for prefix in sys.argv[1:]):continue
 source=Image.open(HERE/'masters'/f'{rec["id"]}.webp').convert('RGBA')
 original=Image.open(ROOT/'public/assets'/rec['original']).convert('RGBA');kind=rec['kind'];variants=[]
 if kind=='portrait':
  n=rec['frame'];portraits.append((n,fit(source,cell(original,n,[2,4]),(512,512))));continue
 if kind=='image':
  for long in rec.get('resolutions',[128,256,512]):
   size=tuple(max(1,round(n/max(original.size)*long)) for n in original.size)
   im=fit(source,original,size,stretch=rec.get('stretchToLegacyFrame',False));path=f'assets/world-hd/{rec["id"]}-{long}.webp';im.save(ROOT/'public'/path,lossless=True,method=4)
   variants.append({'key':f'hires:{rec["id"]}:{long}','path':path,'width':size[0],'height':size[1],'size':long})
 elif kind in ['animation','atlas']:
  grid=rec['grid'];base=rec.get('frameSize',[128,128]);oldgrid=[original.width//base[0],original.height//base[1]]
  for factor in ([1,2,4] if kind=='animation' else [2,4]):
   size=[n*factor for n in base];outputgrid=[2,3] if kind=='atlas' else grid
   atlas=Image.new('RGBA',(outputgrid[0]*size[0],outputgrid[1]*size[1]))
   for n in range(grid[0]*grid[1]):
    src=source.crop(rec['frameBoxes'][n]) if 'frameBoxes' in rec else cell(source,n,grid);target=cell(original,n,oldgrid)
    if kind=='animation' or 'frameBoxes' in rec:src=body(src)
    if kind=='animation':target=body(target)
    offset=FEDERAL_X[n] if rec['id']=='japones-federal-walk' else 0
    im=fit(src,target,size,offset,stretch=rec.get('stretchToLegacyFrame',False));atlas.paste(im,(n%outputgrid[0]*size[0],n//outputgrid[0]*size[1]))
   long=size[0];path=f'assets/world-hd/{rec["id"]}-{long}.webp';atlas.save(ROOT/'public'/path,lossless=True,method=4)
   variants.append({'key':f'{rec["id"]}-{long}' if kind=='animation' else f'hires:{rec["id"]}:{long}','path':path,'width':size[0],'height':size[1],'size':long})
 registry[rec['original']]={'id':rec['id'],'kind':kind,'width':128 if kind=='animation' else rec.get('frameSize',list(original.size))[0],'height':128 if kind=='animation' else rec.get('frameSize',list(original.size))[1],'variants':variants}
if portraits:
 atlas=Image.new('RGBA',(1024,2048))
 for n,im in portraits:atlas.paste(im,(n%2*512,n//2*512))
 path='assets/world-hd/retratos-elenco-512.webp';atlas.save(ROOT/'public'/path,lossless=True,method=4)
 registry['retratos-elenco.webp']={'id':'retratos-elenco','kind':'atlas','width':256,'height':256,'variants':[{'key':'hires:installed-portraits:512','path':path,'width':512,'height':512,'size':512}]}
(ROOT/'src/world-assets.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
print('Exported',len(registry),'asset families;',sum(len(a['variants']) for a in registry.values()),'delivery files')
