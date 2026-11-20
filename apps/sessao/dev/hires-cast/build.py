"""Rebuild shipped tiers from the archived masters. Requires Pillow."""
from pathlib import Path
from PIL import Image
import json, sys
import numpy as np
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
OUT=ROOT/'public/assets/characters-hd'
SLUGS=['lula','bolsonaro','clodovil','tiririca','sikera-jr','alexandre-frota','sergio-moro','ines-brasil']
OUT.mkdir(exist_ok=True)

def cell(im,index,grid):
 cols,rows=grid
 return im.crop((round(index%cols*im.width/cols),round(index//cols*im.height/rows),round((index%cols+1)*im.width/cols),round((index//cols+1)*im.height/rows)))
def bbox(im):
 return im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
def original(record):
 slug=record['slug'];action=record['action']
 if action!='walk':
  image=Image.open(ROOT/f'public/assets/{slug}-{action}.webp').convert('RGBA')
  return image,[image.width//128,image.height//128],0
 n=SLUGS.index(slug);exp=n>=3;row=(n-3 if exp else n)*3
 return Image.open(ROOT/('public/assets/sprites-expansao.png' if exp else 'public/assets/sprites-hd.png')).convert('RGBA'),[4,15 if exp else 9],row*4

def connected_body(tile):
 alpha=np.array(tile.getchannel('A'))
 labels,count=ndimage.label(alpha>16)
 if not count:return tile
 sizes=np.bincount(labels.ravel());sizes[0]=0
 keep=ndimage.binary_dilation(labels==sizes.argmax(),iterations=2)
 alpha[~keep]=0
 tile.putalpha(Image.fromarray(alpha))
 return tile

masters={}
for record in json.loads((HERE/'manifest.json').read_text()):
 source=Image.open(HERE/'masters'/f'{record["id"]}.webp').convert('RGBA')
 old,oldgrid,offset=original(record)
 frames=[]
 for n in range(record['frames']):
  index=([0,1,0,2,3,4,3,5,6,7,6,8][n] if record['action']=='walk' and record['grid']==[3,3] else 0 if record['action']=='phone' else n)
  tile=cell(source,index,record['grid'])
  if record['id']=='ines-brasil-fall' and n==6:tile=tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  if record['action'] in ['attack','hit','fall']:tile=connected_body(tile)
  box=bbox(tile)
  if not box:raise ValueError(f'Empty {record["id"]} frame {n}')
  anchor=cell(old,n+offset,oldgrid)
  if record['action'] in ['attack','hit','fall']:anchor=connected_body(anchor)
  target=bbox(anchor)
  if not target:raise ValueError('Missing original anchor')
  # Uniform fit preserves anatomy. Keep the original foot/ground contact and body center.
  w,h=box[2]-box[0],box[3]-box[1]
  targetw=min(target[2]-target[0],124);targeth=min(target[3]-target[1],124)
  scale=min(targetw*4/w,targeth*4/h)
  art=tile.crop(box).resize((max(1,round(w*scale)),max(1,round(h*scale))),Image.Resampling.LANCZOS)
  center=(target[0]+target[2])*2
  if record['action']=='walk':center=256
  left=max(4,min(508-art.width,round(center-art.width/2)))
  bottom=min(508,target[3]*4)
  canvas=Image.new('RGBA',(512,512));canvas.alpha_composite(art,(left,max(4,bottom-art.height)))
  frames.append(canvas)
 rows=(record['frames']+3)//4
 atlas=Image.new('RGBA',(2048,rows*512))
 for n,frame in enumerate(frames):atlas.paste(frame,(n%4*512,n//4*512))
 masters[record['id']]=atlas
 if len(sys.argv)>1 and record['action'] not in sys.argv[1:]:continue
 for size in [128,256,512]:
  scaled=atlas if size==512 else atlas.resize((size*4,size*rows),Image.Resampling.LANCZOS)
  scaled.save(OUT/f'{record["id"]}-{size}.webp',lossless=True,method=4)
for name,slugs in [('players',SLUGS[:3]),('players-expansion',SLUGS[3:])]:
 atlas=Image.new('RGBA',(512,len(slugs)*384))
 for n,slug in enumerate(slugs):atlas.paste(masters[f'{slug}-walk'].resize((512,384),Image.Resampling.LANCZOS),(0,n*384))
 atlas.save(OUT/f'{name}-128.webp',lossless=True,method=4)
print(f'Built {len(masters)} sheets in three tiers')
