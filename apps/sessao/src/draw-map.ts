import type Phaser from 'phaser';
import { npcs } from './npcs';
import { infirmary } from './medical';
import { desks, furnishings, rooms, walls, PLENARY_DOORS, WIDTH, HEIGHT, type Rect } from './map';

export function drawMap(scene: Phaser.Scene) {
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

  fill(0x172722,0,0,WIDTH,541);
  floor([10,114,940,58],0x757f78,23,18);
  floor([10,259,940,11],0x757f78,23,11);
  floor([10,392,940,11],0x757f78,23,11);
  rug(14,130,932,23);
  rooms.forEach(({bounds,color},index) => floor(bounds,color,index===1?18:24,index===1?13:8));
  rug(156,16,168,95);
  fill(0x24473e,278,552,404,185);
  fill(0x355f50,282,556,396,177);
  fill(0x789383,453,620,54,120,.23);
  rug(617,418,260,102);
  fill(0xe7f0e6,898,438,30,28);
  fill(0x47796a,900,440,26,24);
  fill(0xfff5e7,910,445,6,14);
  fill(0xfff5e7,906,449,14,6);
  rug(78,306,135,75);
  rug(725,32,197,73);
  for (const [x,y,w,h] of walls) {
    fill(0x172723,x,y,w,h);
    fill(0x9aa296,x,y,w,Math.min(2,h));
    fill(0x526b5d,x,y+2,w,Math.min(3,h-2));
    if (h>5) fill(0x2c453b,x,y+5,w,h-5);
    fill(0x162b24,x,y+h-1,w,1);
  }
  for (const [x,y,w] of [
    [59,114,34],[177,114,26],[217,114,46],[277,114,26],...PLENARY_DOORS.map(([x,y,w]) => [x,y,w]),[384,114,35],[69,161,36],[218,161,44],[368,161,36],
    [545,114,41],[821,114,43],[550,161,41],[785,161,42],[221,259,40],[431,259,47],[658,259,44],
    [115,392,41],[400,392,46],[780,392,45],
  ]) {
    fill(0x9b8d6d,x,y+3,w,3);
  }

  for (const [x,y] of desks) {
    if (x!==npcs.vendor.counter.x || y!==npcs.vendor.counter.y) prop(2,x+13,y-17,19,23,y+1);
    prop(1,x,y-3,45,23,y+20);
  }
  for (const {frame,area:[x,y,w,h]} of furnishings) {
    prop(frame,x,y,w,h,y+h);
  }

  const tribune = scene.add.text(570,591,'TRIBUNA',{
    fontFamily:'system-ui',fontSize:'5px',color:'#fff4dc',backgroundColor:'#263a31',resolution:3,
  }).setOrigin(.5,0).setDepth(HEIGHT+20);
  return [tribune,...rooms.map(({name,bounds:[x,y,w]}) =>
    scene.add.text(x+w/2,y+4,name.toUpperCase(),{
      fontFamily:'system-ui',fontSize:name==='Plenário' ? '11px' : name===infirmary.name ? '6px' : '8px',fontStyle:'bold',color:'#fff4dc',
      backgroundColor:'#263a31aa',resolution:3,padding:{x:5,y:2},
    }).setOrigin(.5,0).setDepth(1),
  )];
}
