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
  const view = (at:number)=>match.view(player.id,[player.id],at);
  const before = view(0);
  match.politics({...player,...stations.cabinet},{kind:'grant',diverted:3},[player],1);
  match.roomActivity({...player,...stations.coffee},'coffee',2);
  const after = view(2);
  const gains = rewardGains(before,after,false);
  expect(gains).toEqual({income:3,xp:20});

  const head = {x:340,y:210};
  const markup = renderToStaticMarkup(<RewardEffects finish={()=>{}} effects={[
    {kind:'income',amount:gains.income,sequence:1,head},
    {kind:'xp',amount:gains.xp,sequence:2,head},
  ]}/>);
  expect(markup).toContain('<strong>+R$ 30 mil</strong>');
  expect(markup).toContain('left:340px;top:210px');
  expect(markup).toContain('aria-hidden="true" style="left:340px;top:210px">+20 XP');
  expect(rewardGains(undefined,after,false)).toEqual({income:0,xp:0});
  expect(rewardGains(before,after,true)).toEqual({income:3,xp:0});

  match.politics({...player,...stations.cabinet},{kind:'grant',diverted:3},[player],3);
  match.roomActivity({...player,...stations.coffee},'coffee',4);
  expect(rewardGains(after,view(4),false)).toEqual({income:0,xp:0});
});
