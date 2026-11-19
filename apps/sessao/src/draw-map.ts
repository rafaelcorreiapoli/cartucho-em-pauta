import type Phaser from 'phaser';
import { corridorFloors, doors, floorDecor } from './congress-layout';
import { officeFixtures, privateOffices, type OfficeLayout } from './private-offices';
import { infirmary } from './medical';
import { desks, furnishings, rooms, walls, WIDTH, HEIGHT, type Rect } from './map';

export function drawMap(scene: Phaser.Scene,
  officeFixture?:(art:Phaser.GameObjects.Image,office:OfficeLayout,kind:'safe'|'cabinet')=>void,
  securityTerminal?:(art:Phaser.GameObjects.Image)=>void) {
  const graphics = scene.add.graphics();
  const fill = (color:number, x:number, y:number, width:number, height:number, alpha=1) => {
    graphics.fillStyle(color,alpha).fillRect(x,y,width,height);
  };
  const prop = (frame:number, x:number, y:number, width:number, height:number, depth=0) =>
    scene.add.image(x,y,'office',frame).setOrigin(0).setDisplaySize(width,height).setDepth(depth);
  const floor = ([x,y,w,h]:Rect, color:number, tileWidth:number, tileHeight:number) => {
    fill(color,x,y,w,h);
    for (let row=0;row*tileHeight<h;row++) {
      for (let col=0;col*tileWidth<w;col++) {
        const tx = x+col*tileWidth;
        const ty = y+row*tileHeight;
        const shade = (row*17+col*11+row*col)%7;
        fill(shade<3 ? 0xffffff : 0x122421,tx,ty,
          Math.min(tileWidth,w-col*tileWidth),Math.min(tileHeight,h-row*tileHeight),shade*.014);
        fill(0x172d29,tx,ty,Math.min(tileWidth,w-col*tileWidth),.5,.19);
        fill(0x172d29,tx,ty,.5,Math.min(tileHeight,h-row*tileHeight),.15);
      }
    }
    fill(0x101b19,x,y,w,4,.23);
  };
  const rug = (x:number,y:number,w:number,h:number) => {
    fill(0x122724,x,y,w,h);
    fill(0xc3a66d,x+1,y+1,w-2,h-2);
    fill(0x254a42,x+2,y+2,w-4,h-4);
    fill(0x729281,x+4,y+4,w-8,h-8);
    fill(0x31564b,x+4.5,y+4.5,w-9,h-9);
  };

  const drawFloorDetails = (details:typeof corridorFloors) => {
    for (const detail of details) {
      if (detail.kind==='rug') rug(...detail.area);
      else if (detail.kind==='floor') floor(detail.area,detail.fill,detail.width,detail.height);
      else fill(detail.fill,...detail.area,detail.opacity);
    }
  };
  drawFloorDetails(corridorFloors);
  rooms.forEach(({bounds,color}) => floor(bounds,color,24,8));
  drawFloorDetails(floorDecor);
  fill(0x9b8d6d,...infirmary.door);
  for (const [x,y,w,h] of walls) {
    fill(0x172723,x,y,w,h);
    if (h>w) {
      fill(0x2c453b,x+1,y,Math.max(0,w-2),h);
      continue;
    }
    fill(0x9aa296,x,y,w,Math.min(2,h));
    fill(0x526b5d,x,y+2,w,Math.min(3,h-2));
    if (h>5) fill(0x2c453b,x,y+5,w,h-5);
    fill(0x162b24,x,y+h-1,w,1);
  }
  for (const {name,area:[x,y,w,h]} of doors) {
    if (name===infirmary.name) continue;
    if (privateOffices.some(office=>office.name===name)) fill(0x757f78,x,y,w,h);
    if (h>w) fill(0x9b8d6d,x+1,y,3,h);
    else fill(0x9b8d6d,x,y+3,w,3);
  }

  for (const office of privateOffices) {
    for (const kind of ['safe','cabinet'] as const) {
      const {x,y} = office[kind];
      const {texture,width,height,footOffset} = officeFixtures[kind];
      const art = scene.add.image(x,y-footOffset,texture).setOrigin(.5,1).setDisplaySize(width,height).setDepth(y-footOffset);
      officeFixture?.(art,office,kind);
    }
  }
  // The floor, rugs and walls never move. Draw their geometry once.
  const backdrop = 'congress-map-backdrop';
  if (!scene.textures.exists(backdrop)) graphics.generateTexture(backdrop,WIDTH,HEIGHT);
  graphics.destroy();
  scene.add.image(0,0,backdrop).setOrigin(0).setDepth(-1);

  for (const {name,x,y} of desks) {
    if (name==='Terminal de segurança') {
      const terminal = scene.add.image(x,y-14,'security-terminal')
        .setOrigin(0).setDisplaySize(45,34).setDepth(y+20);
      securityTerminal?.(terminal);
      continue;
    }
    if (name==='Balcão do Topa ou Não Topa') {
      scene.add.text(x+22.5,y+9,'TOPA OU NÃO TOPA',{
        fontFamily:'system-ui',fontSize:'3.5px',fontStyle:'bold',color:'#fff3d6',
        backgroundColor:'#412064',padding:{x:2,y:1},resolution:4,
      }).setOrigin(.5,0).setDepth(y+21);
    }
    if (name!=='Balcão da tesouraria') prop(2,x+13,y-17,19,23,y+1);
    prop(1,x,y-3,45,23,y+20);
  }
  for (const furnishing of furnishings) {
    const [x,y,w,h] = furnishing.area;
    if ('texture' in furnishing) scene.add.image(x,y,furnishing.texture).setOrigin(0).setDisplaySize(w,h).setDepth(y+h);
    else prop(furnishing.frame,x,y,w,h,y+h);
  }

  const tribune = scene.add.text(570,591,'TRIBUNA',{
    fontFamily:'system-ui',fontSize:'5px',color:'#fff4dc',backgroundColor:'#263a31',resolution:3,
  }).setOrigin(.5,0).setDepth(HEIGHT+20);
  return [tribune,...rooms.filter(room=>!privateOffices.some(office=>office.name===room.name)).map(({name,bounds:[x,y,w]}) =>
    scene.add.text(x+w/2,y+4,name.toUpperCase(),{
      fontFamily:'system-ui',fontSize:name==='Plenário' ? '11px' : name===infirmary.name ? '6px' : '8px',fontStyle:'bold',color:'#fff4dc',
      backgroundColor:'#263a31aa',resolution:3,padding:{x:5,y:2},
    }).setOrigin(.5,0).setDepth(1),
  )];
}

export function updateSafeArt(art:Phaser.GameObjects.Image,open:boolean) {
  const {texture,openTexture,width,openWidth,height,openOriginX} = officeFixtures.safe;
  const key = open ? openTexture : texture;
  if (art.texture.key!==key) art.setTexture(key).setOrigin(open ? openOriginX : .5,1)
    .setDisplaySize(open ? openWidth : width,height);
}
