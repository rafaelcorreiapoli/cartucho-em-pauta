import type Phaser from 'phaser';
import { desks, furnishings, walls, WIDTH, HEIGHT, type Rect } from './map';

const rooms = [
  {name:'Gabinete A', bounds:[10,10,129,104], color:0xb69c75},
  {name:'Plenário', bounds:[148,10,184,104], color:0x3e6154},
  {name:'Gabinete B', bounds:[341,10,129,104], color:0xaf9a79},
  {name:'Secretaria', bounds:[10,172,177,87], color:0x858c80},
  {name:'Cafezinho', bounds:[196,172,86,87], color:0xb09d80},
  {name:'Gabinete C', bounds:[291,172,179,87], color:0xa38863},
] satisfies {name:string; bounds:[number,number,number,number]; color:number}[];

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

  fill(0x172722,0,0,WIDTH,HEIGHT);
  floor([10,114,460,58],0x757f78,23,18);
  rug(14,130,452,23);
  rooms.forEach(({bounds,color},index) => floor(bounds,color,index===1?18:24,index===1?13:8));
  rug(156,16,168,95);
  for (const [x,y,w,h] of walls) {
    fill(0x172723,x,y,w,h);
    fill(0x9aa296,x,y,w,Math.min(2,h));
    fill(0x526b5d,x,y+2,w,Math.min(3,h-2));
    fill(0x2c453b,x,y+5,w,h-5);
    fill(0x162b24,x,y+h-1,w,1);
  }
  for (const [x,y] of [[59,114],[217,114],[384,114],[69,161],[218,161],[368,161]]) {
    fill(0x9b8d6d,x,y+3,x===217||x===218?44:34,3);
  }

  for (const [x,y] of desks) {
    prop(2,x+13,y-17,19,23,y+1);
    prop(1,x,y-3,45,23,y+20);
  }
  for (const {frame,area:[x,y,w,h]} of furnishings) {
    prop(frame,x,y,w,h,y+h);
  }

  for (const {name,bounds:[x,y,w]} of rooms) {
    scene.add.text(x+w/2,y+4,name.toUpperCase(),{
      fontFamily:'system-ui',fontSize:'8px',fontStyle:'bold',color:'#fff4dc',
      backgroundColor:'#263a31',resolution:3,padding:{x:5,y:2},
    }).setOrigin(.5,0).setDepth(300);
  }
}
