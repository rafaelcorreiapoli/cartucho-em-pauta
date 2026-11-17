import { installationArt } from './installations';
import { isOfficeFurniture, officeFurniture } from './private-offices';
import { equipment } from './equipment';
import type Phaser from 'phaser';
import { characterArt, downedArt, phoneArt } from './character-art';
import { objects, type ObjectKind } from './gameplay';
import { HEIGHT, VISION_RADIUS, WIDTH } from './map';
import { wallVision } from './visibility';
import { PHOTO_HEIGHT, PHOTO_LOOK_UP, PHOTO_WIDTH, type Decoration, type Photo, type PhotoScene } from './photography';

export const itemSymbols:Partial<Record<ObjectKind,string>> = {vip:'★',binoculars:equipment.binoculars.symbol,voiceModulator:equipment.voiceModulator.symbol,vest:equipment.vest.symbol};

// Keep map text and sprites sharp at photo zoom within a 4096px texture.
const MAP_SCALE = 3;

export class PhotoRenderer {
  private map?:HTMLImageElement;

  constructor(private textures:Phaser.Textures.TextureManager) {}

  loadMap(staticObjects:Phaser.GameObjects.GameObject[]) {
    const texture = this.textures.addDynamicTexture('photo-map',WIDTH*MAP_SCALE,HEIGHT*MAP_SCALE);
    if (!texture) return;
    texture.camera.setOrigin(0,0).setZoom(MAP_SCALE);
    texture.draw(staticObjects).render();
    texture.snapshot(image=>{
      if (image instanceof HTMLImageElement) this.map = image;
    });
    this.textures.remove('photo-map');
  }

  draw(canvas:HTMLCanvasElement, scene:PhotoScene, scale=4) {
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.map) return;
    const width = PHOTO_WIDTH, height = PHOTO_HEIGHT;
    const left = scene.center.x-width/2, top = scene.center.y-height/2-PHOTO_LOOK_UP;
    canvas.width = width*scale;
    canvas.height = height*scale;
    ctx.scale(scale,scale);
    ctx.fillStyle = '#101d19';
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(this.map,-left,-top,WIDTH,HEIGHT);
    if (scene.camera) {
      ctx.fillStyle = '#334e42';
      for (const [x,y,w,h] of scene.camera.barriers ?? []) ctx.fillRect(x-left,y-top,w,h);
    } else {
      const x = scene.center.x-left, y = scene.center.y-top;
      ctx.fillStyle = '#081710a8';
      ctx.beginPath();
      ctx.rect(0,0,width,height);
      const [first,...edge] = wallVision(scene.center,VISION_RADIUS);
      ctx.moveTo(x+first.x,y+first.y);
      for (const point of edge) ctx.lineTo(x+point.x,y+point.y);
      ctx.closePath();
      ctx.fill('evenodd');
    }

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
    for (const point of scene.breaches ?? []) {
      ctx.strokeStyle = '#ee9169';
      ctx.strokeRect(point.x-left-6,point.y-top-6,12,8);
    }
    for (const ground of scene.ground) item(ground.kind,ground.x-left,ground.y-top+2,16);
    for (const decoration of scene.decorations) {
      const x = decoration.x-left, y = decoration.y-top;
      if (isOfficeFurniture(decoration.kind)) {
        const {width,height,anchor} = officeFurniture[decoration.kind];
        const sprite = this.textures.get(`furniture-${decoration.kind}`).getSourceImage() as HTMLImageElement;
        ctx.drawImage(sprite,x-width/2,y-height*anchor,width,height);
      } else if (decoration.kind==='portrait') {
        const {texture,width,height} = installationArt.portrait;
        const mount = this.textures.get(texture).getSourceImage() as HTMLImageElement;
        ctx.drawImage(mount,x-width/2,y-height/2,width,height);
        const atlas = this.textures.get('installed-portraits').getSourceImage() as HTMLImageElement;
        ctx.drawImage(atlas,decoration.character%2*256,Math.floor(decoration.character/2)*256,256,256,x-9,y-9,18,18);
        if (decoration.marked) {
          ctx.strokeStyle = '#eb664e';
          ctx.beginPath();
          ctx.moveTo(x-6,y-6); ctx.lineTo(x+6,y+6);
          ctx.moveTo(x+6,y-6); ctx.lineTo(x-6,y+6); ctx.stroke();
        }
      } else if (decoration.kind==='vip') {
        const {texture,width,height,centerY} = installationArt.vip;
        const chair = this.textures.get(texture).getSourceImage() as HTMLImageElement;
        ctx.drawImage(chair,x-width/2,y+centerY-height/2,width,height);
        const plate = this.textures.get('item-vip').getSourceImage() as HTMLImageElement;
        ctx.drawImage(plate,x-6.5,y+centerY-6.5,13,13);
      } else item(decoration.kind,x,y+2,19);
    }

    const recent = 'transfers' in scene ? (scene as Photo).transfers : [];
    const labels:{name:string;x:number;y:number}[] = [];
    for (const person of [...scene.people].sort((a,b)=>a.y-b.y || Number(!!a.carried)-Number(!!b.carried))) {
      if ((scene as Photo).selfie && person.id===(scene as Photo).author.id) {
        const atlas = this.textures.get('installed-portraits').getSourceImage() as HTMLImageElement;
        const size = 68;
        ctx.drawImage(atlas,person.character%2*256,Math.floor(person.character/2)*256,256,256,(width-size)/2,height-size,size,size);
        continue;
      }
      const {sheet,frame} = characterArt(person.character);
      const downed = person.carried || person.knockedOut ? downedArt(person.character,person.direction) : undefined;
      const handset = !downed && (person.phone==='open' || person.phone==='game')
        ? phoneArt(person.character,0,true)
        : undefined;
      const art = downed ?? handset;
      const pose = this.textures.getFrame(art?.key ?? sheet.key,art?.frame ?? frame+(person.direction===3 ? 1 : person.direction)*4);
      if (!pose) continue;
      const source = pose.source.image as HTMLImageElement;
      const x = person.x-left, y = person.y-top;
      ctx.save();
      ctx.translate(x,person.carried ? y-24 : y);
      if (downed?.rotation) ctx.rotate(downed.rotation);
      if (downed?.flipX ?? (!handset && person.direction===3)) ctx.scale(-1,1);
      ctx.drawImage(source,pose.cutX,pose.cutY,pose.cutWidth,pose.cutHeight,-19,-38*(downed?.originY ?? 1),38,38);
      ctx.restore();
      if (person.pocketing) {
        ctx.fillStyle = '#ffd67c';
        ctx.font = 'bold 7px system-ui';
        ctx.fillText('Cofre',x-7,y-39);
      }
      const exposed = person.exposed ?? [];
      exposed.forEach(({kind},index)=>item(kind,x+(index-(exposed.length-1)/2)*12,y-37,11));
      if (person.phone==='game' || person.phone==='call') {
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
    item.kind==='portrait' ? `Retrato de ${item.owner.name}` : item.kind==='vip' ? `VIP · ${item.owner.name}` : objects[item.kind].name;
