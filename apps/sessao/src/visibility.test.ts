import {expect,test} from 'bun:test';
import {shadowOutline,wallVision} from './visibility';
import {wallBetween} from './map';

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
