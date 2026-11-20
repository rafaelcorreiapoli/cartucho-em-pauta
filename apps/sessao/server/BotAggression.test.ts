import {expect,test} from 'bun:test';
import {BotAggression} from './BotAggression';
import {Gameplay} from './Gameplay';
import {PlenaryMatch} from './PlenaryMatch';
import {stations} from '../src/plenary';
import type {Player} from '../src/map';
import type {GameplayAction} from '../src/gameplay';

function scenario(armed=true,random=()=>0) {
  const player:Player = {id:'bot',nick:'Bot',bot:true,character:0,...stations.press,direction:0,moving:false};
  const target:Player = {...player,id:'target',nick:'Alvo',bot:undefined,x:player.x+50};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player,target],0,()=>.9);
  const gameplay = new Gameplay();
  gameplay.reset(0,()=>.9,[player,target]);
  if (armed) gameplay.giveTrainingItem(player.id,'baton');
  const aggression = new BotAggression(random,0);
  const actions:GameplayAction[] = [];
  const destinations:string[] = [];
  const step = (now:number,visible=[target])=>{
    const world = {...match.gameplayWorld([player,target,...visible.filter(p=>p!==target)],now,()=>false),wallet:()=>100,hasMandate:()=>true};
    return aggression.tick(player,gameplay.view(player,world),visible,world,
      point=>destinations.push(JSON.stringify({x:point.x,y:point.y})),()=>{},action=>{actions.push(action);gameplay.act(player,action,world);});
  };
  return {player,target,actions,destinations,step};
}

test('equips a baton, follows the same target and gives up at exactly 30 seconds',()=>{
  const s = scenario();
  expect(s.step(30_000)).toBe(true);
  expect(s.actions[0]?.kind).toBe('equip');
  s.step(31_000);
  const other = {...s.target,id:'other',x:s.player.x+1};
  s.target.x+=10;
  s.step(59_999,[other,s.target]);
  expect(s.destinations.at(-1)).toBe(JSON.stringify({x:s.target.x,y:s.target.y}));
  expect(s.step(60_000)).toBe(false);
  expect(s.step(61_000)).toBe(false);
});

test('attacks nearby targets and resumes routine after knockout',()=>{
  const s = scenario();
  s.target.x = s.player.x+18;
  s.step(30_000);
  s.step(31_000);
  expect(s.actions.at(-1)?.kind).toBe('attack');
  expect(s.player.direction).toBe(1);
  s.target.knockedOut = true;
  expect(s.step(32_000)).toBe(false);
  expect(s.step(33_000)).toBe(false);
});

test('occasionally seeks a vendor to buy a baton',()=>{
  const s = scenario(false);
  expect(s.step(30_000)).toBe(true);
  expect(s.destinations).toHaveLength(1);
  expect(s.actions.some(action=>action.kind==='attack')).toBe(false);
});

test('can decline aggression and ignores downed or distant targets',()=>{
  expect(scenario(true,()=>.9).step(60_000)).toBe(false);
  const s = scenario();
  s.target.knockedOut = true;
  expect(s.step(30_000)).toBe(false);
  s.target.knockedOut = undefined;
  s.target.x+=1000;
  expect(s.step(60_000)).toBe(false);
});

test('searches the last seen position instead of tracking an invisible target',()=>{
  const s = scenario();
  s.step(30_000);
  s.step(31_000);
  const lastSeen = s.destinations.at(-1);
  s.target.x+=200;
  s.step(32_000,[]);
  expect(s.destinations.at(-1)).toBe(lastSeen);
  expect(s.step(60_000,[])).toBe(false);
});
