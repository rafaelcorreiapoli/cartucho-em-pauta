import type Phaser from 'phaser';
import { desks, walls, WIDTH as width, HEIGHT as height } from './map';

export function drawMap(scene: Phaser.Scene) {
  const floor = scene.add.graphics();
  const fill = (color: number,x: number,y: number,w: number,h: number) => floor.fillStyle(color).fillRect(x,y,w,h);
  const tile = (sx: number,sy: number,w: number,h: number,x: number,y: number) => scene.add.image(x,y,'office').setOrigin(0)
    .setCrop(sx,sy,w,h).setDisplayOrigin(sx,sy);
  const wall = (x: number,y: number,w: number,h: number) => {
    fill(0x233735,x,y,w,h);
    fill(0x829088,x,y,w,3);
    fill(0x536660,x,y+3,w,Math.min(5,h-3));
  };
  const desk = (x: number,y: number) => {
    tile(17,75,45,21,x,y);
    tile(0,70,16,26,x+15,y-20);
  };
  const caption = (text: string,x: number,y: number) => scene.add.text(x,y,text,{
    fontFamily:'system-ui',fontSize:'9px',color:'#eef1d8',backgroundColor:'#273d39',padding:{x:4,y:1}
  }).setOrigin(.5,0);
  fill(0x213632,0,0,width,height);
  for(let y=9;y<258;y+=12) {
    for(let x=11;x<470;x+=12) {
      fill((x+y)%5===0 ? 0xada290 : 0xb8ae9b,x,y,11,11);
    }
  }
  fill(0x5d7a63,152,20,176,102);
  fill(0x3f604e,155,23,170,96);
  for(let y=24;y<119;y+=4) fill(0x466852,156,y,168,1);
  fill(0x789284,12,125,456,36);
  fill(0x48665d,12,128,456,30);
  fill(0x6d8e7f,12,132,456,1);
  fill(0x6d8e7f,12,155,456,1);

  walls.forEach(rect => wall(...rect));

  tile(144,0,130,46,146,10).setDepth(1);
  tile(368,0,31,46,29,14);
  tile(399,0,17,46,430,15);
  tile(415,0,34,47,105,23);
  tile(415,0,34,47,352,23);
  tile(399,0,17,46,30,188);
  tile(415,0,34,47,426,184);
  tile(80,65,32,31,229,216);
  desks.forEach(([x,y]) => desk(x,y));
  caption('GABINETE A',75,19);
  caption('PLENÁRIO',239,25).setDepth(2);
  caption('GABINETE B',401,19);
  caption('SECRETARIA',95,177);
  caption('CAFEZINHO',240,177);
  caption('GABINETE C',385,177);
}
