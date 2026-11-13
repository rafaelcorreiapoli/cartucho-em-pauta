import {expect,test} from 'bun:test';
import {shadowOutline,wallVision} from './visibility';
import {wallBetween} from './map';

test('the light includes the visible wall face while the barrier still blocks visibility',()=>{
  const player = {x:140,y:146,barriers:[[153,135,3,25]] as const};
  expect(wallBetween(player,{x:170,y:146})).toBe(true);
  const east = wallVision(player,35).find(point=>Math.abs(point.y)<1e-8 && point.x>0);
  const unblocked = wallVision({x:140,y:146},35).find(point=>Math.abs(point.y)<1e-8 && point.x>0);
  expect(east?.x).toBeCloseTo(16);
  expect(unblocked?.x).toBeCloseTo(35);
});

test('shadow starts at the far wall face with no opening for the avatar',()=>{
  const origin = {x:140,y:146,barriers:[[153,135,3,25]] as const};
  const rays = wallVision(origin,35);
  const east = rays.findIndex(point=>Math.abs(point.dy)<1e-8 && point.dx>0);
  const outline = shadowOutline(rays,origin.x,origin.y,4000);
  expect(outline[rays.length+1+rays.length-east]).toEqual({x:156,y:146});
  expect(outline[east]).toEqual({x:4140,y:146});
  expect(outline[rays.length]).toEqual(outline[0]);
});
