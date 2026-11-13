import {expect,test} from 'bun:test';
import {PhoneSession} from './PhoneSession';
import type {GameplayEvent} from '../src/gameplay';
import type {Player} from '../src/map';

test('phone invitations expire and release both lines without connecting',()=>{
  const phone = new PhoneSession();
  const caller:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const receiver:Player = {...caller,id:'b',nick:'Bia'};
  const events:GameplayEvent[] = [];
  const world = {players:[caller,receiver],now:10,voice:()=>true,publish:(event:GameplayEvent)=>events.push(event)};
  expect(phone.act(caller,{kind:'call',target:receiver.id},world)).toBe('Chamando…');
  expect(phone.callPeer(caller.id)).toBeUndefined();
  world.now += 20_000;
  expect(phone.act(receiver,{kind:'answer'},world)).toBe('Chamada indisponível.');
  phone.tick(world,true);
  expect(phone.view(caller.id,world.players).call).toBeUndefined();
  expect(phone.view(receiver.id,world.players).call).toBeUndefined();
  expect(events).toEqual([]);
  expect(phone.act(receiver,{kind:'call',target:caller.id},world)).toBe('Chamando…');
});
