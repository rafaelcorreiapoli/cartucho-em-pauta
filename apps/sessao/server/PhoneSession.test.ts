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

test('only connected, present players in articulation receive bounded mission time',()=>{
  const phone = new PhoneSession();
  const caller:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const receiver:Player = {...caller,id:'b',nick:'Bia'};
  const events:GameplayEvent[] = [];
  let connected = true;
  const world = {players:[caller,receiver],now:10,voice:()=>true,present:()=>connected,
    hasMission:()=>true,publish:(event:GameplayEvent)=>events.push(event)};
  phone.act(caller,{kind:'call',target:receiver.id},world);
  world.now = 1000;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='call-time')).toEqual([]);
  expect(phone.act(receiver,{kind:'answer'},world)).toBe('Ligação atendida.');
  world.now += 4000;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='call-time').map(event=>[event.actor,event.target,event.duration]))
    .toEqual([['a','b',100],['b','a',100]]);
  connected = false;
  world.now += 50;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='call-time')).toHaveLength(2);
  connected = true;
  world.now += 50;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='call-time')).toHaveLength(2);
  world.now += 50;
  phone.tick(world,true);
  expect(events.filter(event=>event.type==='call-time').slice(2).map(event=>event.duration)).toEqual([50,50]);
  phone.tick(world,false);
  expect(phone.callPeer(caller.id)).toBeUndefined();
});

test('the open phone is visible until the screen closes, the player leaves or articulation ends',()=>{
  const phone = new PhoneSession();
  const player:Player = {id:'a',nick:'Alice',character:0,x:140,y:146,direction:0,moving:false};
  const world = {players:[player],now:10,voice:()=>true,publish:()=>{}};
  phone.act(player,{kind:'phone-open'},world);
  expect(phone.activity(player.id)).toBe('open');
  phone.act(player,{kind:'game-start'},world);
  expect(phone.activity(player.id)).toBe('game');
  phone.act(player,{kind:'game-stop'},world);
  expect(phone.activity(player.id)).toBe('open');
  phone.act(player,{kind:'phone-close'},world);
  expect(phone.activity(player.id)).toBeUndefined();
  phone.act(player,{kind:'phone-open'},world);
  phone.tick(world,false);
  expect(phone.activity(player.id)).toBeUndefined();
  phone.act(player,{kind:'phone-open'},world);
  phone.leave(player,world);
  expect(phone.activity(player.id)).toBeUndefined();
});
