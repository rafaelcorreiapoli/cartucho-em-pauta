import {expect,test} from 'bun:test';
import {findRoute} from './navigation';
import {npcs,treasurer} from './npcs';
import {stations} from './plenary';
import {shadowOutline,wallVision} from './visibility';
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


test('visual light reveals the wall above the player without exposing floor behind it',()=>{
  const origin = {x:140,y:146,barriers:[[120,130,40,8]] as const};
  const north = wallVision(origin,35,true).find(ray=>Math.abs(ray.dx)<1e-8 && ray.dy<0);
  expect(north?.y).toBeCloseTo(-16);
  expect(wallBetween(origin,{x:140,y:125})).toBe(true);
  expect(characterVisible(origin,{x:140,y:125},35)).toBe(false);
  const limited = wallVision(origin,10,true).find(ray=>Math.abs(ray.dx)<1e-8 && ray.dy<0);
  expect(limited?.y).toBeCloseTo(-10);
});

test('visual light reveals vertical thickness but stops at walls viewed end-on',()=>{
  const origin = {x:140,y:146,barriers:[[153,135,3,25]] as const};
  const east = wallVision(origin,60,true).find(ray=>Math.abs(ray.dy)<1e-8 && ray.dx>0);
  expect(east?.x).toBeCloseTo(16);
  const endOn = wallVision({x:140,y:146,barriers:[[153,144,45,4]]},60,true)
    .find(ray=>Math.abs(ray.dy)<1e-8 && ray.dx>0);
  expect(endOn?.x).toBeCloseTo(13);
});


test('corridor light reveals the upper wall face but keeps the lower room wall face dark',()=>{
  const origin = {x:140,y:146,barriers:[[120,130,40,8],[120,155,40,8]] as const};
  const rays = wallVision(origin,35,true);
  const north = rays.find(ray=>Math.abs(ray.dx)<1e-8 && ray.dy<0);
  const south = rays.find(ray=>Math.abs(ray.dx)<1e-8 && ray.dy>0);
  expect(north?.y).toBeCloseTo(-16);
  expect(south?.y).toBeCloseTo(9);
  // Oblique rays must not produce lit triangles inside the lower wall either.
  for (const ray of rays.filter(ray=>ray.dy>0 && Math.abs(ray.dx/ray.dy)<1)) {
    expect(ray.y).toBeCloseTo(9);
  }
});

test('the same horizontal wall face becomes visible from its own room to the south',()=>{
  // Outside the map so existing dividers cannot mask this two-sided fixture.
  const wall = [[5000,5010,40,8]] as const;
  const north = {x:5020,y:5000,barriers:wall};
  const south = {x:5020,y:5030,barriers:wall};
  const northSide = wallVision(north,35,true)
    .find(ray=>Math.abs(ray.dx)<1e-8 && ray.dy>0);
  const southSide = wallVision(south,35,true)
    .find(ray=>Math.abs(ray.dx)<1e-8 && ray.dy<0);
  expect(north.y+northSide!.y).toBeCloseTo(5010);
  expect(south.y+southSide!.y).toBeCloseTo(5010);
  expect(characterVisible(north,south,35)).toBe(false);
});


test('a divider ending in the upper wall cannot shadow its corridor-facing surface',()=>{
  const horizontal = [5000,5010,60,8] as const;
  const divider = [5030,4980,4,38] as const;
  const origin = {x:5020,y:5040};
  for (const barriers of [[horizontal,divider],[divider,horizontal]] as const) {
    const rays = wallVision({...origin,barriers},60,true);
    const baseline = wallVision({...origin,barriers:[horizontal]},60,true);
    for (const ray of rays.filter(ray=>ray.dy<0)) {
      const atFront = origin.x+(5018-origin.y)*ray.dx/ray.dy;
      const atBack = origin.x+(5010-origin.y)*ray.dx/ray.dy;
      if (atFront>5000 && atFront<5060 && atBack>5000 && atBack<5060) {
        expect(origin.y+ray.y).toBeCloseTo(5010);
      }
    }
    const north = rays.find(ray=>Math.abs(ray.dx)<1e-8 && ray.dy<0);
    expect(north?.y).toBeCloseTo(baseline.find(ray=>Math.abs(ray.dx)<1e-8 && ray.dy<0)!.y);
    expect(characterVisible({...origin,barriers},{x:5032,y:5000},60)).toBe(false);
  }
});

test('a divider protruding into the corridor still blocks the upper wall face',()=>{
  const origin = {x:5020,y:5040,barriers:[[5000,5010,60,8],[5018,5000,4,30]] as const};
  const north = wallVision(origin,60,true).find(ray=>Math.abs(ray.dx)<1e-8 && ray.dy<0);
  expect(north?.y).toBeCloseTo(-10);
});
