import {Gameplay} from '../../server/Gameplay';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {stations} from '../plenary';
import {RewardEffects,rewardGains} from './reward-effects';

test('the HUD shows private wallet and XP gains from a new server snapshot once',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,x:0,y:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.4)).toBe(true);
  const game = new Gameplay();
  const view = (at:number)=>match.view(player.id,[player.id],at);
  const before = view(0);
  match.politics({...player,...stations.cabinet},{kind:'grant',area:'health',amount:6,diversion:50},[player],1);
  game.drinkStationCoffee({...player,...stations.coffee},match.gameplayWorld([player],2,()=>false));
  match.electionAction({...player,...stations.panel},{kind:'speech'},2,false);
  const after = view(2);
  const gains = rewardGains(before,after,false);
  expect(gains).toEqual({income:3,xp:20,popularity:3});

  const head = {x:340,y:210};
  const markup = renderToStaticMarkup(<RewardEffects finish={()=>{}} effects={[
    {kind:'income',amount:gains.income,sequence:1,head},
    {kind:'xp',amount:gains.xp,sequence:2,head},
    {kind:'popularity',amount:gains.popularity,sequence:3,head},
  ]}/>);
  expect(markup).toContain('<strong>+R$ 30 mil</strong>');
  expect(markup).toContain('+3 Popularidade');
  expect(markup).toContain('left:340px;top:210px');
  expect(markup).toContain('aria-hidden="true" style="left:340px;top:210px">+20 XP');
  expect(rewardGains(undefined,after,false)).toEqual({income:0,xp:0,popularity:0});
  expect(rewardGains(before,after,true)).toEqual({income:3,xp:0,popularity:0});

  match.politics({...player,...stations.cabinet},{kind:'grant',area:'health',amount:6,diversion:50},[player],3);
  game.drinkStationCoffee({...player,...stations.coffee},match.gameplayWorld([player],4,()=>false));
  expect(rewardGains(after,view(4),false)).toEqual({income:0,xp:0,popularity:0});
});

test('each portrait and VIP sign awards popularity on its first installation only',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,x:0,y:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>.4);
  const view = ()=>match.view(player.id,[player.id],10);
  const publish = match.gameplayWorld([player],10,()=>false).publish;
  const install = (kind:'portrait'|'vip',item:number,at:number)=>publish({
    type:'installed',kind,item,at,actor:player.id,position:player,witnesses:[],
  });
  const before = view();
  install('portrait',101,1);
  expect(rewardGains(before,view(),false).popularity).toBe(4);
  install('portrait',101,2);
  install('vip',102,3);
  expect(rewardGains(before,view(),false).popularity).toBe(6);
  install('portrait',103,4);
  expect(rewardGains(before,view(),false).popularity).toBe(10);
});
