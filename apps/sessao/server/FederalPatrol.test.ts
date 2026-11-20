import {expect,test} from 'bun:test';
import {federalBreachArt,federalPatrolRules} from '../src/federal-patrol';
import {canStand,roomAt,type Player} from '../src/map';
import {officeDoorPoint,officeRules,privateOffices} from '../src/private-offices';
import {FederalPatrol} from './FederalPatrol';
import {Gameplay} from './Gameplay';
import {PlenaryMatch} from './PlenaryMatch';
import {PrivateOffices} from './PrivateOffices';
import type {WorldItem} from '../src/gameplay';

const people = ():Player[]=>Array.from({length:6},(_,i)=>({id:`p${i}`,nick:`Pessoa ${i}`,character:i,x:140,y:146,direction:0,moving:false}));

function setup() {
  const players = people();
  const match = new PlenaryMatch(1);
  expect(match.start(players[0].id,players,0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.5,players,()=>0);
  game.enableFederalPatrol(true);
  const world = (now:number)=>({...match.gameplayWorld([...players,...game.federalPlayers],now,()=>false),present:()=>true});
  const create = (kind:WorldItem['kind'],holder:string,storage?:string)=>
    Reflect.get(game,'create').call(game,kind,storage ? {storage} : {holder}) as WorldItem;
  const [owner] = players;
  const [home] = privateOffices;
  Object.assign(owner,home.safe);
  Object.assign(game.federalPlayers[0],officeDoorPoint(home,-16));
  const cash = create('briefcase',owner.id);
  world(0).cashFlow?.('spawned',3);
  const tickPatrol = (now:number,seconds=.05)=>game.tickFederalPatrol(world(now),seconds,true,()=>0);
  return {game,match,players,owner,home,cash,world,create,tickPatrol};
}

test('patrol is opt-in, persistent, paused with exploration, and reset between matches',()=>{
  const game = new Gameplay();
  game.reset(0);
  expect(game.federalPlayers).toEqual([]);
  game.enableFederalPatrol(true);
  const [player] = game.federalPlayers;
  expect(player).toMatchObject({npc:true,visitor:'japones-federal',nick:'Japonês da Federal'});
  const before = {x:player.x,y:player.y};
  game.tickFederalPatrol({players:[player],now:5000,office:()=>undefined,voice:()=>false,earn:()=>{},publish:()=>{}},1,false);
  expect(player).toMatchObject({...before,moving:false});
  game.reset(6000);
  expect(game.federalPlayers).toEqual([]);
});

test.each(privateOffices.map((_,i)=>i))('patrol opens a closed door and enters office %i only once before leaving',index=>{
  const offices = new PrivateOffices(); offices.reset(people(),()=>0);
  const patrol = new FederalPatrol(offices); patrol.reset(true);
  const home = privateOffices[index];
  const state = offices.offices.get(home.id)!; state.door = 'closed';
  const player = patrol.players[0];
  Object.assign(player,officeDoorPoint(home,-16));
  const entries:string[] = [];
  for (let now=0;now<2000 && !entries.length;now+=50) {
    patrol.tick(now,.05,true,office=>entries.push(office.id),()=>index/6+.01);
  }
  expect(state).toMatchObject({door:'open'});
  expect(entries).toEqual([home.id]);
  expect(roomAt(player)).toBe(home.name);
  for (let now=2000;now<2500;now+=50) patrol.tick(now,.05,true,office=>entries.push(office.id),()=>0);
  expect(entries).toEqual([home.id]);
  expect(roomAt(player)).not.toBe(home.name);
  expect(canStand(player.x,player.y)).toBe(true);
});

test.each([1,4,5])('locked door level %i delays entry by the existing max-level tool time',level=>{
  const offices = new PrivateOffices(); offices.reset(people(),()=>0);
  const patrol = new FederalPatrol(offices); patrol.reset(true);
  const home = privateOffices[0],state = offices.offices.get(home.id)!;
  Object.assign(state,{door:'locked',doorLevel:level});
  const player = patrol.players[0]; Object.assign(player,officeDoorPoint(home,-16));
  let entries = 0;
  const tick = (now:number)=>patrol.tick(now,.05,true,()=>entries++,()=>0);
  tick(0);
  expect(player.breachingDoor).toBe(true);
  const duration = offices.breachTime(state,'door',officeRules.maxSecurity,0)!;
  tick(duration-1);
  expect(entries).toBe(0);
  expect(roomAt(player)).not.toBe(home.name);
  expect(state.doorUntil).toBe(0);
  tick(duration);
  expect(state.doorUntil).toBe(duration+officeRules.breachMs);
  expect(state.doorBreachedBy).toBe(player.id);
  for (let now=duration+50;now<duration+2000 && !entries;now+=50) tick(now);
  expect(entries).toBe(1);
});

test('unlocking during a breach admits the inspector without a stale breach completing',()=>{
  const offices = new PrivateOffices(); offices.reset(people(),()=>0);
  const patrol = new FederalPatrol(offices); patrol.reset(true);
  const home = privateOffices[0],state = offices.offices.get(home.id)!;
  state.door = 'locked';
  const player = patrol.players[0]; Object.assign(player,officeDoorPoint(home,-16));
  patrol.tick(0,.05,true,()=>{},()=>0);
  expect(player.breachingDoor).toBe(true);
  state.door = 'open';
  patrol.tick(100,.05,true,()=>{},()=>0);
  expect(player.breachingDoor).toBeUndefined();
  expect(player.moving).toBe(true);
  expect(state.doorUntil).toBe(0);
});

test('flagrant entry confiscates all carried briefcases, interrupts pocketing and waits at the scene before ten seconds of detention',()=>{
  const {game,match,players,owner,home,cash,world,create,tickPatrol} = setup();
  const second = create('briefcase',owner.id);
  world(0).cashFlow?.('spawned',3);
  const personal = create('portrait',owner.id);
  const stored = create('briefcase',owner.id,`office:${home.id}`);
  world(0).cashFlow?.('spawned',3);
  const popularity = match.view(owner.id,players.map(p=>p.id),0).politics?.popularity;
  game.act(owner,{kind:'office-cash',place:home.id,item:cash.id},world(0));
  expect(game.hasOfficeChannel(owner.id)).toBe(true);
  let caughtAt = 0;
  for (let now=50;now<=2000;now+=50) {
    tickPatrol(now);
    if (match.isolated(owner.id)) { caughtAt = now; break; }
  }
  expect(caughtAt).toBeGreaterThan(0);
  expect(game.hasOfficeChannel(owner.id)).toBe(false);
  expect(owner.pocketing).toBeUndefined();
  const inventory = game.view(owner,world(caughtAt)).inventory;
  expect(inventory.map(item=>item.id)).toContain(personal.id);
  expect(inventory.some(item=>item.id===cash.id || item.id===second.id)).toBe(false);
  Object.assign(owner,home.cabinet);
  expect(game.view(owner,world(caughtAt)).officeStash?.items.some(item=>item.id===stored.id)).toBe(true);
  expect(match.canHandleObjects(owner.id,caughtAt)).toBe(false);
  expect(match.view(owner.id,players.map(p=>p.id),caughtAt)).toMatchObject({isolationSeconds:10,isolationReason:'federal'});
  expect(match.view(owner.id,players.map(p=>p.id),caughtAt).politics?.popularity).toBe(popularity);
  expect(match.economySummary(game.physicalCash()).discrepancy).toBe(0);
  const delay=federalPatrolRules.flagrantPauseMs;
  expect(match.federalTransferPending(owner.id,caughtAt+delay-1)).toBe(true);
  expect(match.federalTransferPending(owner.id,caughtAt+delay)).toBe(false);
  expect(match.view(owner.id,players.map(p=>p.id),caughtAt+delay).isolationSeconds).toBe(10);
  match.advance(caughtAt+delay+9999);
  expect(match.isolated(owner.id)).toBe(true);
  match.advance(caughtAt+delay+10000);
  expect(match.isolated(owner.id)).toBe(false);
  const inspector = game.federalPlayers[0];
  for (let i=0;i<15;i++) tickPatrol(caughtAt+delay+10000+i*50);
  expect(roomAt(inspector)).not.toBe(home.name);
});

test('pocketing started after entry is not caught by proximity',()=>{
  const {game,match,owner,home,cash,world,tickPatrol} = setup();
  for (let now=0;roomAt(game.federalPlayers[0])!==home.name && now<2000;now+=50) tickPatrol(now);
  expect(roomAt(game.federalPlayers[0])).toBe(home.name);
  game.act(owner,{kind:'office-cash',place:home.id,item:cash.id},world(2000));
  for (let now=2000;now<2200;now+=50) tickPatrol(now);
  expect(match.isolated(owner.id)).toBe(false);
  expect(game.hasOfficeChannel(owner.id)).toBe(true);
});

test('cash conversion finishing before or at entry escapes the flagrant, including a locked door delay',()=>{
  const {game,match,owner,home,cash,world,tickPatrol} = setup();
  const offices:PrivateOffices = Reflect.get(game,'privateOffices');
  offices.offices.get(home.id)!.door = 'locked';
  game.act(owner,{kind:'office-cash',place:home.id,item:cash.id},world(0));
  tickPatrol(0);
  expect(game.federalPlayers[0].breachingDoor).toBe(true);
  const cashBefore = match.view(owner.id,[owner.id],0).politics!.wallet;
  tickPatrol(officeRules.cashMs);
  game.tick(world(officeRules.cashMs),true);
  for (let now=officeRules.cashMs+50;now<officeRules.cashMs+1500;now+=50) tickPatrol(now);
  expect(match.isolated(owner.id)).toBe(false);
  expect(match.view(owner.id,[owner.id],officeRules.cashMs).politics!.wallet).toBe(cashBefore+3);
  expect(game.hasOfficeChannel(owner.id)).toBe(false);
});

test('directional breach art uses each explicit row and respects reduced motion',()=>{
  for (let direction=0;direction<4;direction++) {
    expect(federalBreachArt(direction,400,false)).toMatchObject({frame:direction*4+2});
    expect(federalBreachArt(direction,400,true)).toMatchObject({frame:direction*4});
  }
  expect(federalPatrolRules.detentionMs).toBe(10_000);
});

test('finishing on the exact entrance tick is not a flagrant',()=>{
  const {game,match,owner,home,cash,world,tickPatrol} = setup();
  game.act(owner,{kind:'office-cash',place:home.id,item:cash.id},world(0));
  tickPatrol(officeRules.cashMs,.5);
  expect(roomAt(game.federalPlayers[0])).toBe(home.name);
  expect(match.isolated(owner.id)).toBe(false);
  game.tick(world(officeRules.cashMs),true);
  expect(game.hasOfficeChannel(owner.id)).toBe(false);
  expect(game.view(owner,world(officeRules.cashMs)).inventory.some(item=>item.id===cash.id)).toBe(false);
});

test.each(privateOffices.map((_,i)=>i))('patrol breaches locked office %i with the correct facing',index=>{
  const offices = new PrivateOffices(); offices.reset(people(),()=>0);
  const patrol = new FederalPatrol(offices); patrol.reset(true);
  const home = privateOffices[index],state = offices.offices.get(home.id)!;
  state.door = 'locked'; state.doorLevel = 5;
  const player = patrol.players[0]; Object.assign(player,officeDoorPoint(home,-16));
  const expectedDirection = home.inside.x ? home.inside.x>0 ? 1 : 3 : home.inside.y>0 ? 0 : 2;
  let entered = false;
  patrol.tick(0,.05,true,()=>{entered=true;},()=>index/6+.01);
  expect(player).toMatchObject({breachingDoor:true,direction:expectedDirection});
  for (let now=50;now<17000 && !entered;now+=50) patrol.tick(now,.05,true,()=>{entered=true;},()=>index/6+.01);
  expect(entered).toBe(true);
});

test('Federal detention uses real seconds through ballots and stale releases cannot free a later detainee',()=>{
  const {match,owner,players} = setup();
  const ids = players.map(player=>player.id);
  const world = match.gameplayWorld(players,1000,()=>false);
  expect(world.detain?.(owner.id,10_000,1000)).toBe(true);
  Reflect.get(match,'openVote').call(match,'ballot',2000,2000,30_000);
  expect(match.view(owner.id,ids,7000)).toMatchObject({isolationReason:'federal',isolationSeconds:4});
  match.advance(11_000);
  expect(match.isolated(owner.id)).toBe(true);
  world.releaseDetention?.(owner.id,11_000);
  expect(match.isolated(owner.id)).toBe(false);
  expect(match.view(owner.id,ids,11_000).isolationSeconds).toBeUndefined();
  expect(world.detain?.(owner.id,10_000,12_000)).toBe(true);
  world.releaseDetention?.(owner.id,11_000);
  expect(match.isolated(owner.id)).toBe(true);
  world.releaseDetention?.(owner.id,22_000);
  expect(match.isolated(owner.id)).toBe(false);
});


test('the pre-transfer pause and ten-second detention follow real time even during a ballot',()=>{
  const {match,owner,players}=setup();
  const world=match.gameplayWorld(players,1000,()=>false);
  const delay=federalPatrolRules.flagrantPauseMs;
  expect(world.detain?.(owner.id,10_000,1000,delay)).toBe(true);
  Reflect.get(match,'openVote').call(match,'ballot',2000,2000,30_000);
  expect(match.federalTransferPending(owner.id,1000+delay-1)).toBe(true);
  expect(match.federalTransferPending(owner.id,1000+delay)).toBe(false);
  expect(match.view(owner.id,players.map(player=>player.id),1000+delay).isolationSeconds).toBe(10);
  world.releaseDetention?.(owner.id,11000);
  expect(match.isolated(owner.id)).toBe(true);
  world.releaseDetention?.(owner.id,11000+delay);
  expect(match.isolated(owner.id)).toBe(false);
});
