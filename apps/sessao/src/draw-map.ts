import type Phaser from 'phaser';
import { desks, furnishings, walls, PLENARY_BOUNDS, PLENARY_DOORS, WIDTH, HEIGHT, type Rect } from './map';

const rooms = [
  {name:'Gabinete A', bounds:[10,10,129,104], color:0xb69c75},
  {name:'Antecâmara', bounds:[148,10,184,104], color:0x3e6154},
  {name:'Plenário', bounds:PLENARY_BOUNDS, color:0x3e6154},
  {name:'Gabinete B', bounds:[341,10,129,104], color:0xaf9a79},
  {name:'Secretaria', bounds:[10,172,177,87], color:0x858c80},
  {name:'Cafezinho', bounds:[196,172,86,87], color:0xb09d80},
  {name:'Gabinete C', bounds:[291,172,179,87], color:0xa38863},
  {name:'Arquivo', bounds:[480,10,223,104], color:0x81897a},
  {name:'Controladoria', bounds:[713,10,237,104], color:0x527473},
  {name:'Apoio Técnico', bounds:[480,172,223,87], color:0x777d75},
  {name:'Sala de Imprensa', bounds:[713,172,237,87], color:0xa58b66},
  {name:'Protocolo', bounds:[10,270,306,122], color:0x858c80},
  {name:'Biblioteca', bounds:[326,270,266,122], color:0x9b8161},
  {name:'Comissões', bounds:[602,270,348,122], color:0x637b69},
  {name:'Credenciamento', bounds:[10,403,306,127], color:0x8c846d},
  {name:'Hall das Bancadas', bounds:[326,403,266,127], color:0x7c8a7e},
  {name:'Galeria', bounds:[602,403,348,127], color:0x56736e},
] satisfies {name:string; bounds:Rect; color:number}[];

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
  rug(617,418,316,102);
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
    prop(2,x+13,y-17,19,23,y+1);
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
      fontFamily:'system-ui',fontSize:name==='Plenário' ? '11px' : '8px',fontStyle:'bold',color:'#fff4dc',
      backgroundColor:'#263a31',resolution:3,padding:{x:5,y:2},
    }).setOrigin(.5,0).setDepth(HEIGHT+20),
  )];
}
