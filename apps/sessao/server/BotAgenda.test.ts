import {expect,test} from 'bun:test';
import type {Player} from '../src/map';
import {privateOffices} from '../src/private-offices';
import {npcs} from '../src/npcs';
import {INVENTORY_SLOTS,type GameplayAction} from '../src/gameplay';
import {BotAgenda} from './BotAgenda';
import {Gameplay} from './Gameplay';
import {PlenaryMatch} from './PlenaryMatch';

function scenario(random:()=>number=()=>0) {
  const player:Player = {id:'bot',nick:'Bot',bot:true,character:0,direction:0,moving:false,x:140,y:146};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  const office = privateOffices.find(office=>office.id===game.view(player,match.gameplayWorld([player],0,()=>false)).ownOffice)!;
  const agenda = new BotAgenda(random,0);
  const actions:GameplayAction[] = [];
  let now = 0;
  const world = ()=>match.gameplayWorld([player],now,()=>false);
  return {player,match,game,office,actions,
    step(at:number) {
      now = at;
      const state = game.view(player,world());
      agenda.tick(player,match.view(player.id,[player.id],now),{...state,ground:[]},game,world(),
        point=>Object.assign(player,point),()=>{player.moving=false;},action=>{actions.push(action);game.act(player,action,world());},()=>{});
    },
    wallet:()=>match.view(player.id,[player.id],now).politics!.wallet,
  };
}

test('a bot can decide to buy insurance, pay the vendor and install it in its own safe without buying duplicates',()=>{
  const {step,player,game,office,actions,wallet} = scenario();
  const before = wallet();
  for (let time=45_000;time<=52_000;time+=1000) step(time);
  expect(actions).toContainEqual(expect.objectContaining({kind:'shop-buy',target:'safeTrap'}));
  expect(actions).toContainEqual(expect.objectContaining({kind:'office-trap-safe',place:office.id}));
  expect(wallet()).toBe(before-3);
  expect(game.hasSafeInsurance(player.id)).toBe(true);
  for (let time=100_000;time<=110_000;time+=1000) step(time);
  expect(actions.filter(action=>action.kind==='shop-buy' && action.target==='safeTrap')).toHaveLength(1);
});

test('a bot installs insurance already in its inventory before considering another purchase',()=>{
  const {step,player,game,actions} = scenario();
  game.giveTrainingItem(player.id,'safeTrap');
  for (let time=0;time<5000;time+=1000) step(time);
  expect(game.hasSafeInsurance(player.id)).toBe(true);
  expect(actions.some(action=>action.kind==='shop-buy')).toBe(false);
});

test('a bot without enough money does not try to buy insurance',()=>{
  const {step,player,match,actions,wallet} = scenario();
  const world = match.gameplayWorld([player],0,()=>false);
  expect(world.spend?.(player.id,wallet())).toBe(true);
  Object.assign(player,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  for (let time=90_000;time<=100_000;time+=1000) step(time);
  expect(actions.some(action=>action.kind==='shop-buy' && action.target==='safeTrap')).toBe(false);
});

test('insurance remains an optional decision instead of a compulsory purchase',()=>{
  const {step,actions} = scenario(()=>.9);
  for (let time=90_000;time<=100_000;time+=1000) step(time);
  expect(actions.some(action=>action.kind==='shop-buy' && action.target==='safeTrap')).toBe(false);
});

test('a bot with a full backpack keeps its money instead of retrying an impossible purchase',()=>{
  const {step,player,game,actions,wallet} = scenario();
  for (let slot=0;slot<INVENTORY_SLOTS;slot++) game.giveTrainingItem(player.id,'lockpick');
  const before = wallet();
  for (let time=90_000;time<=100_000;time+=1000) step(time);
  expect(actions.some(action=>action.kind==='shop-buy' && action.target==='safeTrap')).toBe(false);
  expect(wallet()).toBe(before);
});
