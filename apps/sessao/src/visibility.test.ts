import {expect,test} from 'bun:test';
import {localPlayerLightMask,wallVision} from './visibility';
import {wallBetween} from './map';

test('the light includes the visible wall face while the barrier still blocks visibility',()=>{
  const player = {x:140,y:146,barriers:[[153,135,3,25]] as const};
  expect(wallBetween(player,{x:170,y:146})).toBe(true);
  const east = wallVision(player,35).find(point=>Math.abs(point.y)<1e-8 && point.x>0);
  const unblocked = wallVision({x:140,y:146},35).find(point=>Math.abs(point.y)<1e-8 && point.x>0);
  expect(east?.x).toBeCloseTo(16);
  expect(unblocked?.x).toBeCloseTo(35);
});

test('the local player light covers bars and labels independently of wall rays',()=>{
  expect(localPlayerLightMask(100,80,200,2)).toBe(
    'radial-gradient(ellipse 36px 60px at 100px 140px, transparent 100%, #000 calc(100% + 16px))',
  );
});
