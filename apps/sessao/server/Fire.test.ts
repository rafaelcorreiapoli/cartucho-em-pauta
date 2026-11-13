import {expect,test} from 'bun:test';
import {Fire} from './Fire';
import {fireRules,fireSites} from '../src/fire';
import {canStand} from '../src/map';

test('fires apply stability losses only during articulation and extinguishing schedules the next fire',()=>{
  const fire = new Fire();
  fire.reset(0);
  const start = fireRules.firstAfter;
  expect(fire.advance(start,true)).toBe(0);
  const active = fire.view(true)!;
  expect(active.remaining).toBe(36);
  expect(fire.advance(start+3000,true)).toBe(0);
  expect(fire.advance(start+33_000,false)).toBe(0);
  expect(fire.view(false)).toMatchObject({paused:true,remaining:33});
  expect(fire.advance(start+36_000,true)).toBe(2);
  expect(fire.extinguish((active.site+1)%fireSites.length)).toBe(false);
  expect(fire.extinguish(active.site)).toBe(true);
  expect(fire.extinguish(active.site)).toBe(false);
  expect(fire.view(true)).toBeUndefined();
  fire.increaseSafety();
  fire.advance(start+36_000+fireRules.cooldown,true);
  expect(fire.view(true)).toBeUndefined();
  fire.advance(start+36_000+fireRules.cooldown+fireRules.safetyDelay,true);
  expect(fire.view(true)).toBeDefined();
});

test('each fixed extinguisher is on walkable map floor',()=>{
  for (const {extinguisher:{x,y}} of fireSites) expect(canStand(x,y)).toBe(true);
});
