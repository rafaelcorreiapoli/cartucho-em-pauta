import {expect,test} from 'bun:test';
import {Gameplay} from '../server/Gameplay';
import {PlenaryMatch} from '../server/PlenaryMatch';
import type {Player} from './map';
import {appForKey,hudAppStatus,launchHudApp,type HudApp} from './hud-apps';

test('keyboard commands and the app menu share availability derived from a gameserver snapshot',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,x:140,y:146,moving:false,direction:0};
  const match = new PlenaryMatch(1);
  expect(hudAppStatus(match.view(player.id,[player.id],0),true)).toEqual({});
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  const view = match.view(player.id,[player.id],1);
  const game = new Gameplay();
  view.gameplay = game.view(player,match.gameplayWorld([player],1,()=>false));
  const channel = {id:1,name:'Escuta',room:'Arquivo',kind:'wiretap' as const,active:true,removed:false,alerts:false};
  view.gameplay.surveillance = {channels:[channel],options:[],muted:false};
  const {progression} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(player.id);
  progression.earn(100);
  view.politics = match.view(player.id,[player.id],1).politics;
  const status = hudAppStatus(view,true);
  expect(status).toMatchObject({bag:{},phone:{},surveillance:{badge:'1'},attributes:{badge:'1'}});

  const launched:HudApp[] = [];
  const commands:Record<HudApp,()=>void> = {
    bag:()=>launched.push('bag'),attributes:()=>launched.push('attributes'),phone:()=>launched.push('phone'),
    settings:()=>launched.push('settings'),equipment:()=>launched.push('equipment'),
    surveillance:()=>launched.push('surveillance'),microphone:()=>launched.push('microphone'),
  };
  expect(launchHudApp(hudAppStatus(view,false),commands,appForKey('v')!)).toBe(false);
  for (const key of ['v','o','p','i']) expect(launchHudApp(status,commands,appForKey(key)!)).toBe(true);
  expect(launched).toEqual(['surveillance','bag','attributes','attributes']);
  expect(appForKey('w')).toBeUndefined();
});
