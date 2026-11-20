import { expect, test } from 'bun:test';
import { CharacterProgression } from './CharacterProgression';
import { PoliticalEconomy } from './PoliticalEconomy';
import { agendas, missionReward, type Agenda } from '../src/politics';
import { readAttributeRequest } from '../src/progression';

test('cumulative XP grants every crossed level, caps points and keeps excess XP',()=>{
  const progression = new CharacterProgression(1);
  expect(progression.view()).toMatchObject({level:1,xp:0,nextLevelXp:70,available:0});
  progression.earn(80);
  progression.earn(35);
  expect(progression.view()).toMatchObject({level:2,xp:115,nextLevelXp:168,available:1});
  progression.earn(315);
  expect(progression.view()).toMatchObject({level:4,xp:430,levelStart:294,available:3});
  progression.earn(1000);
  expect(progression.view()).toMatchObject({level:6,xp:1430,available:5});
  expect(progression.view().nextLevelXp).toBeUndefined();
  expect((Object.keys(agendas) as Agenda[]).every(kind=>missionReward(kind).xp>0)).toBe(true);
});

test.each([70,168,294,455,665])('levels up exactly at the reduced %i XP threshold',threshold=>{
  const progression = new CharacterProgression(1);
  progression.earn(threshold-1);
  const before = progression.view();
  progression.earn(1);
  expect(progression.view()).toMatchObject({
    xp:threshold,level:before.level+1,levelStart:threshold,available:before.available+1,
  });
});

test('attribute requests cannot be replayed, forged or carried across matches',()=>{
  const economy = new PoliticalEconomy();
  const players = [{id:'a',name:'A'},{id:'b',name:'B'}];
  const view = (id='a')=>economy.view(id,[],0,false,()=>true)!.progression;
  economy.reset(players,()=>0);
  const firstMatch = view().matchId;
  expect(economy.allocate('a',{attribute:'burglary',matchId:firstMatch,revision:0})).toBe(false);
  const worldEvent = {actor:'a',position:{x:0,y:0},witnesses:[]};
  economy.recordGameplay({...worldEvent,type:'filed',at:1,item:1,kind:'document'});
  economy.recordGameplay({...worldEvent,type:'filed',at:1,item:1,kind:'document'});
  economy.recordGameplay({...worldEvent,type:'money-pocketed',at:2,item:2,kind:'briefcase'});
  const coffee = {type:'used',kind:'coffee',...worldEvent,at:1} as const;
  economy.recordGameplay(coffee);
  economy.recordGameplay(coffee);
  expect(view()).toMatchObject({xp:110,available:1});
  expect(view('b')).toMatchObject({xp:0,available:0});
  const request = {attribute:'burglary',matchId:firstMatch,revision:0} as const;
  for (const attribute of ['__proto__','agility','stamina']) {
    expect(readAttributeRequest({...request,attribute})).toBeUndefined();
  }
  expect(economy.allocate('a',request)).toBe(true);
  expect(economy.allocate('a',request)).toBe(false);
  expect(view()).toMatchObject({invested:{burglary:1},available:0,revision:1});
  economy.reset(players,()=>0);
  expect(view()).toMatchObject({xp:0,level:1,available:0,invested:{burglary:0}});
  expect(economy.allocate('a',request)).toBe(false);
});
