import { expect, test } from 'bun:test';
import { Gameplay } from './Gameplay';
import { PersonalAgenda } from './PersonalAgenda';
import { PoliticalEconomy } from './PoliticalEconomy';
import type { GameplayWorld } from './gameplay-world';
import { terminals, type GameplayEvent } from '../src/gameplay';
import type { Player } from '../src/map';
import { npcs } from '../src/npcs';

const metrics = {wallet:8,popularity:40};

function event(type:GameplayEvent['type'], extra:Partial<GameplayEvent> = {}):GameplayEvent {
  return {type,actor:'a',at:1,position:{x:0,y:0},witnesses:[],...extra};
}

test('two different signers must sign the same document after assignment',()=>{
  const economy = new PoliticalEconomy();
  const players:Player[] = ['a','b','c'].map((id,index)=>({
    ...terminals.secretary.point,x:terminals.secretary.point.x+index*8,
    id,nick:id,moving:false,direction:0,character:index,
  }));
  const [owner,b,c] = players;
  economy.reset(players.map(({id,nick:name})=>({id,name})),()=>.09);
  const view = (id:string) => economy.view(id,[],0,false,()=>true)!;
  expect(view(owner.id).missions.active.some(mission=>mission.kind==='assinaturas')).toBe(true);

  const game = new Gameplay();
  const world:GameplayWorld = {players,now:0,voice:()=>true,office:()=>undefined,
    earn:()=>{},publish:entry=>economy.recordGameplay(entry)};
  game.act(owner,{kind:'supply',place:'secretary',target:'queue'},world);
  const [document] = game.view(owner,world).inventory;
  const sign = (signer:Player) => {
    game.act(owner,{kind:'sign-request',target:signer.id,item:document.id},world);
    const [request] = game.view(signer,world).requests;
    game.act(signer,{kind:'accept',item:request.id},world);
    game.act(signer,{kind:'accept',item:request.id},world);
  };
  sign(b);
  economy.recordGameplay(event('signed',{actor:c.id,target:owner.id,item:document.id+100}));
  expect(view(owner.id).missions.active.find(mission=>mission.kind==='assinaturas')?.current).toBe(1);
  sign(c);
  expect(view(owner.id)).toMatchObject({wallet:10,missions:{completed:[{kind:'assinaturas'}]}});
  expect(view(owner.id).missions.active).toHaveLength(3);
  expect(view(b.id).missions.completed).toEqual([]);
});

test('a real pizza purchase and consumption produce different agenda results',()=>{
  const economy = new PoliticalEconomy();
  const player:Player = {...npcs.snackVendor.interaction,id:'a',nick:'A',direction:0,moving:false,character:0};
  const game = new Gameplay();
  economy.reset([{id:'a',name:'A'}],()=>0);
  const view = () => economy.view('a',[],0,false,()=>true)!;
  const world:GameplayWorld = {players:[player],now:1,voice:()=>true,office:()=>undefined,
    earn:()=>{},spend:(id,price)=>economy.spend(id,price),publish:entry=>economy.recordGameplay(entry)};
  game.act(player,{kind:'talk',target:'snackVendor'},world);
  game.act(player,{kind:'dialogue-choice',target:'products',token:game.view(player,world).dialogue?.token},world);
  game.act(player,{kind:'shop-buy',target:'pizza',token:game.view(player,world).dialogue?.token},world);
  expect(view().missions.completed).toEqual([]);
  const [pizza] = game.view(player,world).inventory;
  game.act(player,{kind:'use',item:pizza.id},world);
  expect(view()).toMatchObject({wallet:6,walletIncome:0,progression:{xp:20},missions:{completed:[{kind:'pizza'}]}});
  expect(view().missions.active).toHaveLength(3);
});

test('hidden play counts only witnessed-free gameplay time and duplicate samples do not count',()=>{
  const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
  // Advance the real deck without mutating active objectives directly.
  agenda.progress(metrics,{cafe:1,protocolo:1,pizza:1});
  while (!agenda.hasActive('jogarOculto')) {
    const active = agenda.view(metrics).active;
    if (active.some(mission=>mission.id>60)) throw new Error('Hidden play did not become eligible');
    agenda.progress(metrics,Object.fromEntries(active.map(mission=>[mission.kind,mission.target])));
  }
  const hidden = () => agenda.view(metrics).active.find(mission=>mission.kind==='jogarOculto');
  agenda.recordGameplay(metrics,event('game-played',{at:2,duration:100,witnesses:['b']}),false);
  expect(hidden()?.current).toBe(0);
  for (let i=0;i<300;i++) {
    const sample = event('game-played',{at:3+i*100,duration:100});
    agenda.recordGameplay(metrics,sample,false);
    agenda.recordGameplay(metrics,sample,false);
    if (i===149) expect(hidden()?.current).toBe(15_000);
  }
  expect(agenda.view(metrics).completed.at(-1)?.kind).toBe('jogarOculto');
  expect(agenda.view(metrics).active).toHaveLength(3);
  expect(hidden()).toBeUndefined();
});

test('the phone only emits play time after input and uses observer visibility through walls',()=>{
  const player:Player = {id:'a',nick:'A',x:130,y:60,direction:0,moving:false,character:0};
  const observer:Player = {...player,id:'b',x:158};
  const samples:GameplayEvent[] = [];
  const world:GameplayWorld = {players:[player,observer],now:0,voice:()=>true,office:()=>undefined,
    earn:()=>{},hasMission:()=>true,publish:entry=>{if (entry.type==='game-played') samples.push(entry);}};
  const game = new Gameplay();
  game.act(player,{kind:'game-start'},world);
  world.now = 100;
  game.tick(world,true);
  expect(samples).toEqual([]);
  game.act(player,{kind:'game-turn',direction:'right'},world);
  world.now = 150;
  game.tick(world,true);
  expect(samples.at(-1)).toMatchObject({duration:50,witnesses:[]});
  observer.x = 108;
  world.now = 200;
  game.tick(world,true);
  expect(samples.at(-1)).toMatchObject({duration:50,witnesses:['b']});
});
