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

  drawPlenaryDetails(scene);

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

function drawPlenaryDetails(scene:Phaser.Scene) {
  const key = 'plenary-details-hd';
  const scale = 4;
  const [left,top,width,height] = [278,550,404,193];
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key,width*scale,height*scale)!;
    const ctx = texture.context;
    ctx.scale(scale,scale);
    ctx.translate(-left,-top);
    const gradient = (y:number,h:number,colors:string[])=>{
      const fill = ctx.createLinearGradient(0,y,0,y+h);
      colors.forEach((color,i)=>fill.addColorStop(i/(colors.length-1),color));
      return fill;
    };
    const box = (x:number,y:number,w:number,h:number,r:number,fill:string|CanvasGradient,edge?:string)=>{
      ctx.beginPath();
      ctx.roundRect(x,y,w,h,r);
      ctx.fillStyle = fill;
      ctx.fill();
      if (edge) {
        ctx.lineWidth = .65;
        ctx.strokeStyle = edge;
        ctx.stroke();
      }
    };
    box(314,550,332,28,1,gradient(550,28,['#393f33','#101814']),'#a4956a');
    for (let x=319;x<645;x+=5.5) {
      box(x,551,.8,26,.2,gradient(551,26,['#eee1b6','#8f7c58','#d1bc86']));
      box(x+1.6,555,2.1,3,.3,'#87a064');
      box(x+1.6,563,2.1,3,.3,'#d4be56');
    }
    for (const x of [282,650]) {
      box(x,552,30,22,1.4,'#111b17','#a4956a');
      box(x+2,554,26,17,1,gradient(554,17,['#a3c2c6','#426366','#223937']));
      box(x+7,562,16,.65,.25,'#c0dbd7');
      box(x+9,565,12,.65,.25,'#83a7a8');
    }
    for (const x of [327,617]) {
      box(x,569,1,31,.4,'#bca36b');
      box(x+1,572,15,10,1,'#327446');
      ctx.fillStyle = '#e2bd50';
      ctx.beginPath();
      ctx.moveTo(x+2,577);ctx.lineTo(x+8.5,573);ctx.lineTo(x+15,577);ctx.lineTo(x+8.5,581);
      ctx.fill();
      box(x+6.4,575,4.2,4.2,2.1,'#2f537e');
      box(x-3,600,7,2,1,'#8d744a');
    }

    box(412,590,136,18,5,'#211910','#806646');
    box(414,586,132,15,5,gradient(586,15,['#bea16b','#855626','#604020']),'#d0ad75');
    box(422,599,116,7,2,gradient(599,7,['#344538','#19291f']),'#947046');
    box(477,600,6,5,2,'#c6a560');
    for (const x of [436,458,480,502,524]) {
      box(x-6,579,12,11,2.4,gradient(579,11,['#586451','#26332a']),'#87774f');
      box(x-4,589,8,3,.6,'#1b2727','#887659');
      box(x+5,589,2.5,3,.4,'#dbcca7');
    }

    for (let i=0;i<PLENARY_SEATS.length;i+=3) {
      const [first,middle,last] = PLENARY_SEATS.slice(i,i+3);
      const rail = (offset:number,color:string,lineWidth:number)=>{
        ctx.beginPath();
        ctx.moveTo(first.x-20,first.y+offset);
        ctx.quadraticCurveTo(middle.x,middle.y+offset,last.x+20,last.y+offset);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      };
      rail(-15,'#231c15',7);
      rail(-16,'#ad8f59',3);
      rail(-17,'#d1b477',.7);
    }
    for (const {x,y} of PLENARY_SEATS) {
      box(x-11,y+2,22,12,2.5,'#131d18','#7c7860');
      box(x-9,y+3,18,8,2,gradient(y+3,8,['#71806b','#35463b']));
      box(x-17,y-23,34,8,1.8,gradient(y-23,8,['#d7b77c','#946533','#563a23']),'#e1c38a');
      box(x-5,y-22,10,4,.8,'#26383b','#6c7770');
      box(x-3.5,y-21,7,.5,.2,'#a8c9bc');
      box(x+7,y-22,5,3,.5,'#d9cea9');
    }
    texture.refresh();
  }
  scene.add.image(left,top,key).setOrigin(0).setDisplaySize(width,height).setDepth(.25);
}
