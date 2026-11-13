import {expect,test} from 'bun:test';
import {wallVision} from './visibility';
import {wallBetween} from './map';

test('the illuminated floor stops at the same dynamic barrier that blocks visibility',()=>{
  const player = {x:140,y:146,barriers:[[153,135,3,25]] as const};
  expect(wallBetween(player,{x:170,y:146})).toBe(true);
  const east = wallVision(player,35).find(point=>Math.abs(point.y)<1e-8 && point.x>0);
  const unblocked = wallVision({x:140,y:146},35).find(point=>Math.abs(point.y)<1e-8 && point.x>0);
  expect(east?.x).toBeCloseTo(13);
  expect(unblocked?.x).toBeCloseTo(35);
});
