import {expect,test} from 'bun:test';
import {Fire} from './Fire';
import {fireRules,fireSites} from '../src/fire';
import type {Player} from '../src/map';

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

test('moving interrupts installation and only completing it spends the device',()=>{
  const fire = new Fire();
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,...fireSites[0]};
  let spent = 0;
  const consume = ()=>{ spent++; return true; };
  expect(fire.plant(player,0,1,0)).toBe(true);
  expect(fire.plant({...player,id:'b'},0,2,0)).toBe(false);
  expect(fire.updateInstallation({...player,moving:true},100,()=>true,consume)).toBe('Instalação interrompida.');
  expect(spent).toBe(0);
  expect(fire.plant(player,0,1,100)).toBe(true);
  expect(fire.updateInstallation(player,3100,()=>true,consume)).toBe('Incendiário instalado.');
  expect(spent).toBe(1);
  expect(fire.plant(player,0,2,3100)).toBe(false);
  fire.advance(fireRules.fuse-fireRules.smoke-1,true);
  expect(fire.smoke).toBeUndefined();
  expect(fire.disarm(0)).toBe(false);
  fire.advance(fireRules.fuse-fireRules.smoke,true);
  expect(fire.option({...player,id:'b'},false,false)).toMatchObject({kind:'disarm',site:0});
  expect(fire.disarm(0)).toBe(true);
  fire.advance(fireRules.fuse,true);
  expect(fire.view(true)).toBeUndefined();
});
