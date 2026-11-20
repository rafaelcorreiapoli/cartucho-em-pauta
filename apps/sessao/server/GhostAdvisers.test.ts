import {expect,test} from 'bun:test';
import {GhostAdvisers} from './GhostAdvisers';
import {Gameplay} from './Gameplay';
import type {GameplayWorld} from './gameplay-world';
import {ghostAdviserRules as rules} from '../src/ghost-advisers';
import {canStand,isolationRoom,roomAt,type Player} from '../src/map';
import {npcs} from '../src/npcs';
import {weapons} from '../src/weapons';

test('unlimited independent advisers spawn on walkable floors, wander, charge until killed and reset',()=>{
  const advisers=new GhostAdvisers();
  advisers.reset(0);
  const players=Array.from({length:20},()=>advisers.hire());
  expect(new Set(players.map(player=>player.id)).size).toBe(20);
  for (const player of players) {
    expect(canStand(player.x,player.y)).toBe(true);
    expect(roomAt(player)).not.toBe(isolationRoom.name);
  }
  expect(new Set(players.map(player=>`${player.x},${player.y}`)).size).toBeGreaterThan(1);
  let cost=0;
  advisers.tick(rules.tick,true,amount=>cost+=amount);
  expect(cost).toBe(20*rules.expense);
  advisers.kill(players[0].id);
  advisers.tick(rules.tick*2,true,amount=>cost+=amount);
  expect(cost).toBe(39*rules.expense);
  expect(advisers.players.some(player=>player.moving)).toBe(true);
  advisers.reset(0);
  advisers.tick(rules.tick*3,true,amount=>cost+=amount);
  expect(advisers.players).toHaveLength(0);
  expect(cost).toBe(39*rules.expense);
});

test('new hires get their full first interval and paused time is not billed',()=>{
  const advisers=new GhostAdvisers();
  advisers.reset(0);
  advisers.hire(5000);
  let cost=0;
  const spend=(amount:number)=>cost+=amount;
  advisers.tick(6000,true,spend);
  expect(cost).toBe(0);
  advisers.tick(16000,false,spend);
  advisers.tick(21000,true,spend);
  expect(cost).toBe(1);
});

function setup() {
  const game=new Gameplay();
  const actor:Player={id:'a',nick:'A',character:0,direction:1,moving:false,x:npcs.vendor.x,y:npcs.vendor.y+11};
  game.reset(0,Math.random,[actor]);
  let wallet=rules.price*2;
  let infiltrator=false;
  let expense=0;
  const world:GameplayWorld={players:[actor],now:0,voice:()=>true,office:()=>undefined,earn:()=>{},publish:()=>{},
    isInfiltrator:()=>infiltrator,incidentExpense:amount=>expense+=amount,
    spend:(_,amount)=>{ if (wallet<amount) return false; wallet-=amount; return true; }};
  const buy=()=>{
    game.act(actor,{kind:'talk',target:'vendor'},world);
    let token=game.view(actor,world).dialogue?.token;
    game.act(actor,{kind:'dialogue-choice',target:'products',token},world);
    token=game.view(actor,world).dialogue?.token;
    return game.act(actor,{kind:'shop-buy',target:'ghostAdviser',token},world);
  };
  return {game,actor,world,buy,authorize:()=>infiltrator=true,wallet:()=>wallet,expense:()=>expense};
}

test('shop enforces role and wallet on the server, allows repeat hires and does not create inventory items',()=>{
  const s=setup();
  expect(s.buy()).toContain('exclusiva');
  expect(s.wallet()).toBe(rules.price*2);
  expect(s.game.ghostAdvisers.players).toHaveLength(0);
  s.authorize();
  expect(s.buy()).toBe('Assessor fantasma contratado.');
  expect(s.buy()).toBe('Assessor fantasma contratado.');
  expect(s.buy()).toBe('Saldo insuficiente.');
  expect(s.wallet()).toBe(0);
  expect(s.game.ghostAdvisers.players).toHaveLength(2);
  expect(s.game.view(s.actor,s.world).inventory.some(item=>item.kind==='ghostAdviser')).toBe(false);
});

test('real baton hits kill an adviser permanently and stop only its charges',()=>{
  const s=setup();
  s.authorize(); s.buy(); s.buy();
  const [target,other]=s.game.ghostAdvisers.players;
  Object.assign(s.actor,{x:631,y:197,direction:1});
  Object.assign(target,{x:640,y:197});
  Object.assign(other,{x:140,y:146});
  s.world.players=[s.actor,target,other];
  s.game.distributeProjectItems(s.actor.id,'baton',1);
  const baton=s.game.view(s.actor,s.world).inventory.find(item=>item.kind==='baton')!;
  s.game.act(s.actor,{kind:'equip',item:baton.id},s.world);
  for(let i=0;i<6 && s.game.ghostAdvisers.has(target.id);i++) {
    s.world.now=i*1000;
    s.actor.stamina=100;
    Object.assign(target,{x:640,y:197});
    s.game.act(s.actor,{kind:'attack'},s.world);
    s.world.now+=weapons.baton.impactMs;
    s.game.tick(s.world,true);
  }
  expect(s.game.ghostAdvisers.has(target.id)).toBe(false);
  expect(s.game.ghostAdvisers.has(other.id)).toBe(true);
  s.world.players=[s.actor,other];
  s.world.now=rules.tick;
  s.game.tick(s.world,true);
  expect(s.expense()).toBe(1);
  s.world.now=rules.tick*20;
  s.game.tick(s.world,true);
  expect(s.game.ghostAdvisers.has(target.id)).toBe(false);
});
