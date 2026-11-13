import type Phaser from 'phaser';
import { snackBar, treasurer, treasuryLayout } from './npcs';
import { eastAnnex, officeFixtures, privateOffices, type OfficeLayout } from './private-offices';
import { infirmary } from './medical';
import { desks, furnishings, rooms, walls, reprographyEntrance, PLENARY_DOORS, PLENARY_SEATS, WIDTH, HEIGHT, type Rect } from './map';

export function drawMap(scene: Phaser.Scene,
  officeFixture?:(art:Phaser.GameObjects.Image,office:OfficeLayout,kind:'safe'|'cabinet')=>void) {
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

  fill(0x172722,0,0,960,541);
  floor([10,108,eastAnnex.right-10,64],0x757f78,23,18);
  floor([10,259,940,11],0x757f78,23,11);
  floor([10,392,940,11],0x757f78,23,11);
  rug(14,130,eastAnnex.right-28,23);
  rooms.forEach(({bounds,color}) => floor(bounds,color,24,8));
  rug(156,16,168,95);
  // Plenary finishes echo the Câmara: pale stone, brass railings and dark seating.
  floor([278,550,404,193],0x363c35,24,10);
  floor([445,611,70,132],0xc8bca0,24,12);
  fill(0xb19762,300,575,360,47);
  fill(0xd5c7a6,305,575,350,43);
  fill(0x202722,315,550,330,25);
  for (let x=320;x<645;x+=6) {
    fill(0xa19777,x,550,1,25);
    fill(x%12===2 ? 0xcbbb51 : 0x749160,x+1,557,3,4);
  }
  for (const x of [282,650]) {
    fill(0x101916,x,553,30,20);
    fill(0x79999d,x+2,555,26,15);
    fill(0xc4d9d4,x+4,557,22,1,.7);
  }
  for (const x of [323,620]) {
    fill(0xb99b60,x,570,1,34);
    fill(0x337147,x+1,572,17,11);
    graphics.fillStyle(0xe3bd52).beginPath().moveTo(x+3,577.5).lineTo(x+9.5,573)
      .lineTo(x+16,577.5).lineTo(x+9.5,582).closePath().fillPath();
    graphics.fillStyle(0x2b4c7d).fillCircle(x+9.5,577.5,2.6);
    fill(0x8d744a,x-3,603,7,2);
  }
  const wings = [PLENARY_SEATS.slice(0,3),PLENARY_SEATS.slice(3,6),PLENARY_SEATS.slice(6,9),PLENARY_SEATS.slice(9,12)];
  for (const wing of wings) {
    graphics.lineStyle(5,0x201b15).beginPath();
    wing.forEach(({x,y},index)=>{ if (index===0) graphics.moveTo(x-20,y-15); graphics.lineTo(x,y-15); });
    const last = wing[wing.length-1];
    graphics.lineTo(last.x+20,last.y-15).strokePath();
    graphics.lineStyle(2,0xb89454).beginPath();
    wing.forEach(({x,y},index)=>{ if (index===0) graphics.moveTo(x-20,y-16); graphics.lineTo(x,y-16); });
    graphics.lineTo(last.x+20,last.y-16).strokePath();
  }
  for (const {x,y} of PLENARY_SEATS) {
    fill(0x171e1a,x-12,y+3,24,10);
    fill(0x576452,x-10,y+3,20,7);
    fill(0x5e482c,x-16,y-22,32,7);
    fill(0xc5a76c,x-15,y-22,30,4);
    fill(0x283b3e,x-4,y-21,8,3);
  }
  rug(617,418,184,102);
  const [doorX,doorY,doorW,doorH] = infirmary.door;
  fill(0x9b8d6d,doorX,doorY,doorW,doorH);
  rug(78,306,135,75);
  rug(725,32,197,73);
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
  const [snackX,snackY,snackWidth] = snackBar.door;
  for (const [x,y,w] of [
    [177,114,26],[217,114,46],[277,114,26],...PLENARY_DOORS.map(([x,y,w]) => [x,y,w]),[69,161,36],[218,161,44],
    [545,114,41],[821,114,43],[550,161,41],[785,161,42],[221,259,40],[658,259,44],
    [115,392,41],[400,392,46],treasuryLayout.luxuryDoor,reprographyEntrance,[snackX,snackY,snackWidth],
  ]) {
    fill(0x9b8d6d,x,y+3,w,3);
  }

  for (const office of privateOffices) {
    const [dx,dy,dw,dh] = office.door;
    fill(0x757f78,dx,dy,dw,dh);
    fill(0x9b8d6d,dx,dy+3,dw,3);
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

  for (const [x,y] of desks) {
    if ((x!==treasurer.counter.x || y!==treasurer.counter.y)) prop(2,x+13,y-17,19,23,y+1);
    prop(1,x,y-3,45,23,y+20);
  }
  for (const furnishing of furnishings) {
    const [x,y,w,h] = furnishing.area;
    if (furnishing.texture) scene.add.image(x,y,furnishing.texture).setOrigin(0).setDisplaySize(w,h).setDepth(y+h);
    else if (furnishing.frame!==undefined) prop(furnishing.frame,x,y,w,h,y+h);
  }

  const tribune = scene.add.text(570,591,'TRIBUNA',{
    fontFamily:'system-ui',fontSize:'5px',color:'#fff4dc',backgroundColor:'#263a31',resolution:3,
  }).setOrigin(.5,0).setDepth(HEIGHT+20);
  const doctor = scene.add.text(infirmary.doctor.x,infirmary.doctor.y+2,infirmary.doctor.name,{
    fontFamily:'system-ui',fontSize:'5px',fontStyle:'bold',color:'#eef6df',
    backgroundColor:'#203b33',padding:{x:2,y:1},resolution:3,
  }).setOrigin(.5,0).setDepth(1);
  return [tribune,doctor,...rooms.filter(room=>!privateOffices.some(office=>office.name===room.name)).map(({name,bounds:[x,y,w]}) =>
    scene.add.text(x+w/2,y+4,name.toUpperCase(),{
      fontFamily:'system-ui',fontSize:name==='Plenário' ? '11px' : name===infirmary.name ? '6px' : '8px',fontStyle:'bold',color:'#fff4dc',
      backgroundColor:'#263a31aa',resolution:3,padding:{x:5,y:2},
    }).setOrigin(.5,0).setDepth(1),
  )];
}
