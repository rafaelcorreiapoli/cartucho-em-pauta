import {expect,test} from 'bun:test';
import {PlenaryMatch} from '../server/PlenaryMatch';
import {Gameplay} from '../server/Gameplay';
import {publishProjectFiling} from '../server/project-test-fixture';
import type {Player} from './map';
import {BALLOT_MS,NEGOTIATION_MS,stations} from './plenary';
import {attributePlayerView,canSelectAttribute} from './progression-hud';

test('the attribute player projection ignores movement and subunit stamina',()=>{
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,stamina:89.9,...stations.coffee};
  expect(attributePlayerView({...player,x:player.x+10,direction:2,moving:true,stamina:89.1}))
    .toEqual(attributePlayerView(player));
  expect(attributePlayerView({...player,stamina:88.9})).not.toEqual(attributePlayerView(player));
  expect(attributePlayerView({...player,carried:true}).unavailable).toBe(true);
});

test('the attribute panel and gameserver deny upgrades while carried or in the ballot countdown',()=>{
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,...stations.coffee};
  const ids = [player.id];
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  publishProjectFiling(match,player);
  game.reset(0,()=>.9,[player]);
  const economy = Reflect.get(match,'economy');
  const {progression} = Reflect.get(economy,'accounts').get(player.id);
  progression.earn(100);
  const view = (now:number)=>{
    const world = match.gameplayWorld([player],now,()=>false);
    return {...match.view(player.id,ids,now),gameplay:game.view(player,world)};
  };
  const allowed = (now:number)=>canSelectAttribute(view(now),attributePlayerView(player));
  const request = {attribute:'stamina',revision:0,matchId:view(1).politics!.progression.matchId} as const;
  expect(allowed(1)).toBe(true);

  player.carried = true;
  expect(allowed(2)).toBe(false);
  expect(match.allocateAttribute(player,request,2)).toBe(false);
  player.carried = undefined;
  economy.suspend(player.id,100);
  expect(view(3).isolationSeconds).toBeGreaterThan(0);
  expect(allowed(3)).toBe(false);
  expect(match.allocateAttribute(player,request,3)).toBe(false);
  match.advance(100);
  expect(allowed(100)).toBe(true);
  const countdown = NEGOTIATION_MS-1;
  expect(view(countdown).ballotCountdown).toBeDefined();
  expect(allowed(countdown)).toBe(false);
  expect(match.allocateAttribute(player,request,countdown)).toBe(false);
  expect(view(countdown).politics?.progression.available).toBe(1);

  match.advance(NEGOTIATION_MS);
  const next = NEGOTIATION_MS+BALLOT_MS;
  match.advance(next);
  expect(allowed(next)).toBe(true);
  expect(match.allocateAttribute(player,request,next)).toBe(true);
  game.applyAttribute(player,request.attribute);
  expect(view(next).politics?.progression).toMatchObject({available:0,revision:1,invested:{stamina:1}});
  expect(player.staminaMax).toBe(110);
});
