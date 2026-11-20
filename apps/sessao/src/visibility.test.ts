import {expect,test} from 'bun:test';
import {findRoute} from './navigation';
import {npcs,treasurer} from './npcs';
import {stations} from './plenary';
import {shadowOutline,wallVision,wallLight} from './visibility';
import {canStand,obstacleBetween,wallBetween,characterVisible,roomAt} from './map';

test('the light ends at the first wall edge and preserves unobstructed rays',()=>{
  const player = {x:140,y:146,barriers:[[153,135,3,25]] as const};
  expect(wallBetween(player,{x:170,y:146})).toBe(true);
  const east = wallVision(player,35).find(point=>Math.abs(point.y)<1e-8 && point.x>0);
  const unblocked = wallVision({x:140,y:146},35).find(point=>Math.abs(point.y)<1e-8 && point.x>0);
  expect(east?.x).toBeCloseTo(13);
  expect(unblocked?.x).toBeCloseTo(35);
});

test('shadow starts at the first wall edge with no opening for the avatar',()=>{
  const origin = {x:140,y:146,barriers:[[153,135,3,25]] as const};
  const rays = wallVision(origin,35);
  const east = rays.findIndex(point=>Math.abs(point.dy)<1e-8 && point.dx>0);
  const outline = shadowOutline(rays,origin.x,origin.y,4000);
  expect(outline[rays.length+1+rays.length-east]).toEqual({x:153,y:146});
  expect(outline[east]).toEqual({x:4140,y:146});
  expect(outline[rays.length]).toEqual(outline[0]);
});

test('light does not run along a wall viewed end-on',()=>{
  const origin = {x:140,y:146,barriers:[[153,144,45,4]] as const};
  const east = wallVision(origin,60).find(point=>Math.abs(point.dy)<1e-8 && point.dx>0);
  expect(east?.x).toBeCloseTo(13);
});

test('a perpendicular wall does not light up beyond the corridor junction',()=>{
  const origin = {x:191,y:145};
  const south = wallVision(origin,50).find(point=>Math.abs(point.dx)<1e-8 && point.dy>0);
  expect(south?.y).toBeCloseTo(16);

  const besideJunction = {x:180,y:145};
  const exposedFace = wallVision(besideJunction,50).find(point=>Math.abs(point.dx)<1e-8 && point.dy>0);
  expect(exposedFace?.y).toBeCloseTo(16);
});

test('corridor rays hit a straight edge across the wall and continue through its doorway',()=>{
  const origin = {x:140,y:146,barriers:[[100,155,29,8],[144,155,36,8]] as const};
  const rays = wallVision(origin,30);
  const throughDoor = rays.filter(point=>point.dy>.5 && point.dx<0 &&
    140+9*point.dx/point.dy>129 && 140+9*point.dx/point.dy<144);
  const rightWall = rays.filter(point=>point.dy>.5 &&
    140+9*point.dx/point.dy>145 && 140+9*point.dx/point.dy<160);
  expect(throughDoor.length).toBeGreaterThan(1);
  expect(rightWall.length).toBeGreaterThan(1);
  for (const point of throughDoor) expect(point.y).toBeGreaterThan(9);
  for (const point of rightWall) expect(point.y).toBeCloseTo(9);
});

test('furniture blocks movement but does not hide a character on illuminated floor',()=>{
  const observer = {x:30,y:197};
  const npc = {x:30,y:229};
  expect(canStand(observer.x,observer.y) && canStand(npc.x,npc.y)).toBe(true);
  expect(obstacleBetween(observer,npc)).toBe(true);
  const south = wallVision(observer,40).find(ray=>Math.abs(ray.dx)<1e-8 && ray.dy>0);
  expect(south?.y).toBeGreaterThan(npc.y-observer.y);
  expect(characterVisible(observer,npc,40)).toBe(true);
  expect(characterVisible({...observer,barriers:[[24,210,12,3]]},npc,40)).toBe(false);
});

test('the reprography entrance opens south without leaking into the office 05 corner',()=>{
  const observer = {x:800,y:390};
  const straightThrough = {x:800,y:414};
  const acrossCorner = {x:820,y:408};
  expect(wallBetween(observer,straightThrough)).toBe(false);
  expect(canStand(straightThrough.x,396)).toBe(true);
  expect(wallBetween(observer,acrossCorner)).toBe(true);
  expect(characterVisible(observer,acrossCorner,40)).toBe(false);
});


test('the library and luxury shop have separate entrances and a continuous dividing wall',()=>{
  expect(roomAt({x:403,y:486})).toBe('Biblioteca');
  expect(roomAt({x:427,y:361})).toBe('Tesouraria');
  expect(roomAt({x:530,y:466})).toBe('Gabinete de Luxo');
  expect(canStand(423,396)).toBe(true);
  expect(canStand(506,396)).toBe(true);
  expect(canStand(463,486)).toBe(false);
  expect(wallBetween({x:450,y:486},{x:475,y:486})).toBe(true);
});

test('the lower luxury shop doorway is centered inside the room',()=>{
  expect(roomAt({x:530,y:524})).toBe('Gabinete de Luxo');
  expect(canStand(530,535)).toBe(true);
  expect(canStand(455,535)).toBe(false);
  expect(wallBetween({x:530,y:519},{x:530,y:548})).toBe(false);
});


test('the relocated services can all be reached from the Secretariat',()=>{
  for (const [point,room] of [
    [npcs.protocol.interaction,'Protocolo'],
    [stations.archive,'Arquivo'],
    [treasurer.interaction,'Tesouraria'],
    [stations.library,'Biblioteca'],
  ] as const) {
    expect(roomAt(point)).toBe(room);
    expect(findRoute(stations.secretary,point).at(-1)).toEqual(point);
  }
});


function illuminated(origin:Parameters<typeof wallLight>[0],radius:number,x:number,y:number) {
  const px=x-origin.x, py=y-origin.y;
  if (Math.hypot(px,py)>=radius) return false;
  return wallLight(origin,radius).some(polygon=>{
    let inside=false;
    for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const a=polygon[i],b=polygon[j];
      if ((a.y>py)!==(b.y>py) && px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x) inside=!inside;
    }
    return inside;
  });
}

test('corridor light reveals the upper wall face but keeps the lower room wall face dark',()=>{
  const origin = {x:5020,y:5030,barriers:[[5000,5010,60,8],[5000,5040,60,8]] as const};
  for (const x of [5002,5010,5020,5030,5050]) {
    expect(illuminated(origin,60,x,5011)).toBe(true);
    expect(illuminated(origin,60,x,5017)).toBe(true);
    expect(illuminated(origin,60,x,5041)).toBe(false);
    expect(illuminated(origin,60,x,5047)).toBe(false);
  }
  expect(illuminated(origin,60,5020,5009)).toBe(false);
  expect(illuminated(origin,10,5020,5011)).toBe(false);
  expect(characterVisible(origin,{x:5020,y:5000},60)).toBe(false);
});

test('the horizontal face becomes visible from its own room to the south',()=>{
  const barriers = [[5000,5010,60,8]] as const;
  expect(illuminated({x:5020,y:5000,barriers},60,5020,5014)).toBe(false);
  expect(illuminated({x:5020,y:5030,barriers},60,5020,5014)).toBe(true);
});

test('a divider ending in the upper wall cannot shadow its corridor-facing surface',()=>{
  const horizontal = [5000,5010,60,8] as const;
  const divider = [5030,4980,4,38] as const;
  for (const barriers of [[horizontal,divider],[divider,horizontal]] as const) {
    const origin = {x:5020,y:5040,barriers};
    for (const x of [5028,5031,5033,5036,5040]) {
      expect(illuminated(origin,60,x,5011)).toBe(true);
      expect(illuminated(origin,60,x,5017)).toBe(true);
    }
    expect(illuminated(origin,60,5032,5000)).toBe(false);
  }
});

test('a divider protruding into the corridor still blocks the upper wall face',()=>{
  const origin = {x:5020,y:5040,barriers:[[5000,5010,60,8],[5018,5000,4,30]] as const};
  expect(illuminated(origin,60,5020,5014)).toBe(false);
});

test('lateral doorway shadows start at the near jamb corners while the wall faces stay lit',()=>{
  const barriers = [[5030,4980,10,30],[5030,5030,10,30]] as const;
  for (const x of [5010,5060]) {
    const origin = {x,y:5020,barriers};
    // Both ends of each wall face stay illuminated through their full thickness.
    for (const wx of [5031,5035,5039]) {
      expect(illuminated(origin,100,wx,5009)).toBe(true);
      expect(illuminated(origin,100,wx,5031)).toBe(true);
    }
    // On the floor beyond the doorway, shadows retain the physical near corner.
    const behind = x<5030 ? 5050 : 5020;
    expect(illuminated(origin,100,behind,4999)).toBe(false);
    expect(illuminated(origin,100,behind,5041)).toBe(false);
    expect(illuminated(origin,100,behind,5020)).toBe(true);
  }
});

test('an intervening wall hides the lateral face instead of illuminating the entire divider',()=>{
  const origin = {x:5000,y:5020,barriers:[[5010,5000,5,40],[5030,5000,10,40]] as const};
  expect(illuminated(origin,60,5012,5020)).toBe(true);
  expect(illuminated(origin,60,5035,5020)).toBe(false);
});

test('an upper doorway illuminates both jamb faces without shifting the cone inside the room',()=>{
  const origin = {x:5020,y:5040,barriers:[[4980,5010,30,8],[5030,5010,30,8]] as const};
  for (const x of [5008,5032]) for (const y of [5011,5014,5017]) {
    expect(illuminated(origin,100,x,y)).toBe(true);
  }
  // Near corners bound the opening; wall artwork must not widen its light cone.
  expect(illuminated(origin,100,5020,4990)).toBe(true);
  expect(illuminated(origin,100,4996,4990)).toBe(false);
  expect(illuminated(origin,100,5044,4990)).toBe(false);
  expect(characterVisible(origin,{x:4996,y:4990},100)).toBe(false);
  // From inside the room these south-facing surfaces remain hidden.
  const inside = {...origin,y:4990};
  expect(illuminated(inside,100,5008,5014)).toBe(false);
  expect(illuminated(inside,100,5032,5014)).toBe(false);
});


test('the overlapping Cafezinho corner leaves all adjacent room floor visible',()=>{
  const origin = {x:247,y:196};
  for (let y=172.5;y<181;y++) for (let x=196.5;x<211;x++) {
    expect(illuminated(origin,100,x,y)).toBe(true);
  }
  expect(illuminated(origin,100,195.5,175)).toBe(true); // visible vertical face
  expect(characterVisible(origin,{x:190,y:175},100)).toBe(false);
});

test('overlapping wall intersections contribute corners regardless of rectangle order',()=>{
  const horizontal = [5000,5010,60,10] as const;
  const vertical = [5010,5010,10,50] as const;
  for (const barriers of [[horizontal,vertical],[vertical,horizontal]] as const) {
    const origin = {x:5040,y:5040,barriers};
    for (let y=5020.5;y<5025;y++) for (let x=5020.5;x<5025;x++) {
      expect(illuminated(origin,60,x,y)).toBe(true);
    }
    expect(illuminated(origin,60,5021,5005)).toBe(false);
  }
});

test('infirmary doorway faces stay lit continuously while walking south into the corridor',()=>{
  for (const x of [233,235,240]) for (let y=126;y<=150;y++) {
    const origin = {x,y};
    for (const wx of [171.5,198,210,270,280,302]) {
      if (Math.hypot(wx-x,122.5-y)<86*.8) {
        expect(illuminated(origin,86,wx,122.5)).toBe(true);
      }
    }
  }
});

test('a long wall face remains illuminated when both endpoints are outside vision range',()=>{
  const barriers = [[4900,5010,240,10]] as const;
  for (let y=5021;y<=5050;y++) {
    const origin = {x:5020,y,barriers};
    for (const wx of [5005,5020,5035]) {
      expect(illuminated(origin,40,wx,5019)).toBe(true);
    }
    expect(illuminated(origin,40,5020,5009)).toBe(false);
  }
});
