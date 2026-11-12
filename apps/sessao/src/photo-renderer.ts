import { equipment } from './equipment';
import type Phaser from 'phaser';
import { characterArt } from './character-art';
import { objects, type ObjectKind } from './gameplay';
import { HEIGHT, localPerception, WIDTH } from './map';
import { PHOTO_HEIGHT, PHOTO_LOOK_UP, PHOTO_WIDTH, type Decoration, type Photo, type PhotoScene } from './photography';

export const itemSymbols:Partial<Record<ObjectKind,string>> = {pizza:'🍕',vip:'★',binoculars:equipment.binoculars.symbol,voiceModulator:equipment.voiceModulator.symbol,vest:equipment.vest.symbol};

export class PhotoRenderer {
  private map?:HTMLImageElement;
  private fog = document.createElement('canvas');

  constructor(private textures:Phaser.Textures.TextureManager) {}

  loadMap(staticObjects:Phaser.GameObjects.GameObject[]) {
    const texture = this.textures.addDynamicTexture('photo-map',WIDTH,HEIGHT);
    texture?.draw(staticObjects).render();
    texture?.snapshot(image=>{
      if (image instanceof HTMLImageElement) this.map = image;
      this.textures.remove('photo-map');
    });
  }

  draw(canvas:HTMLCanvasElement, scene:PhotoScene, scale=2) {
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.map) return;
    const width = PHOTO_WIDTH, height = PHOTO_HEIGHT;
    const left = scene.center.x-width/2, top = scene.center.y-height/2-PHOTO_LOOK_UP;
    canvas.width = width*scale;
    canvas.height = height*scale;
    ctx.scale(scale,scale);
    ctx.fillStyle = '#101d19';
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(this.map,-left,-top);
    this.fog.width = Math.ceil(width/4);
    this.fog.height = Math.ceil(height/4);
    const mask = this.fog.getContext('2d')!;
    mask.fillStyle = '#081710a8';
    for (let y=0;y<this.fog.height;y++) {
      for (let x=0;x<this.fog.width;x++) {
        if (!localPerception(scene.center,{x:left+x*4+2,y:top+y*4+2}).visible) mask.fillRect(x,y,1,1);
      }
    }
    ctx.drawImage(this.fog,0,0,width,height);

    const item = (kind:ObjectKind,x:number,y:number,size:number) => {
      const symbol = itemSymbols[kind];
      if (symbol) {
        ctx.font = `bold ${size-1}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffda86';
        ctx.fillText(symbol,x,y);
      } else {
        const source = this.textures.get(`item-${kind}`).getSourceImage() as HTMLImageElement;
        ctx.drawImage(source,x-size/2,y-size,size,size);
      }
    };
    for (const ground of scene.ground) item(ground.kind,ground.x-left,ground.y-top+2,16);
    for (const decoration of scene.decorations) {
      const x = decoration.x-left, y = decoration.y-top;
      if (decoration.kind==='portrait') {
        ctx.fillStyle = '#ae7746';
        ctx.fillRect(x-9,y-15,18,18);
        const atlas = this.textures.get('installed-portraits').getSourceImage() as HTMLImageElement;
        ctx.drawImage(atlas,decoration.character%2*256,Math.floor(decoration.character/2)*256,256,256,x-7,y-13,14,14);
        if (decoration.marked) {
          ctx.strokeStyle = '#eb664e';
          ctx.beginPath();
          ctx.moveTo(x-6,y-12); ctx.lineTo(x+6,y);
          ctx.moveTo(x+6,y-12); ctx.lineTo(x-6,y); ctx.stroke();
        }
      } else item(decoration.kind,x,y+2,19);
    }

    const recent = 'transfers' in scene ? (scene as Photo).transfers : [];
    const labels:{name:string;x:number;y:number}[] = [];
    for (const person of [...scene.people].sort((a,b)=>a.y-b.y || Number(!!a.carried)-Number(!!b.carried))) {
      const {sheet,frame} = characterArt(person.character);
      const pose = this.textures.getFrame(sheet.key,frame+(person.direction===3 ? 1 : person.direction)*4);
      if (!pose) continue;
      const source = pose.source.image as HTMLImageElement;
      const x = person.x-left, y = person.y-top;
      ctx.save();
      ctx.translate(person.carried ? x-17 : x,person.carried ? y-24 : y);
      if (person.carried) ctx.rotate(Math.PI/2);
      else if (person.knockedOut) ctx.rotate(-Math.PI/2);
      if (person.direction===3) ctx.scale(-1,1);
      ctx.drawImage(source,pose.cutX,pose.cutY,pose.cutWidth,pose.cutHeight,-19,-38,38,38);
      ctx.restore();
      if (person.exposed) item(person.exposed.kind,x,y-37,13);
      if (person.phone) {
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#b7f0d3';
        ctx.fillText(person.phone==='game' ? '🎮' : '☎',x+13,y-25);
      }
      for (const handoff of recent.filter(event=>event.to===person.id)) item(handoff.kind,x+16,y-9,12);
      labels.push({name:person.name,x,y:person.carried ? y-53 : y});
    }
    ctx.font = 'bold 6px system-ui';
    ctx.textAlign = 'center';
    const occupied:{left:number;right:number;top:number}[] = [];
    for (const label of labels) {
      const size = ctx.measureText(label.name).width+4;
      const x = Math.max(size/2,Math.min(width-size/2,label.x));
      const left = x-size/2;
      const right = x+size/2;
      let top = label.y+2;
      while (occupied.some(rect=>left<rect.right && right>rect.left && Math.abs(top-rect.top)<8)) top += 8;
      if (top+8>height) continue;
      occupied.push({left,right,top});
      ctx.fillStyle = '#10221be8';
      ctx.fillRect(left,top,size,8);
      ctx.fillStyle = '#fff5df';
      ctx.fillText(label.name,x,top+6);
    }
  }
}

export const decorationLabel = (item:Decoration) =>
  item.kind==='pizza' ? `Pizza · ${item.slices} fatias` :
    item.kind==='portrait' ? `Retrato de ${item.owner.name}` : `VIP · ${item.owner.name}`;
