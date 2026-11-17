import {expect,test} from 'bun:test';
import {Gameplay} from '../server/Gameplay';
import {PlenaryMatch} from '../server/PlenaryMatch';
import type {Player} from './map';
import {stations} from './plenary';
import {projectWorldSnapshot} from './world-snapshot';

test('the Phaser snapshot uses authoritative ground and office data and clears them on disconnect',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,direction:0,moving:false,...stations.coffee};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  Object.assign(player,stations.coffee);
  const world = match.gameplayWorld([player],1,()=>false);
  expect(game.act(player,{kind:'supply',place:'coffee'},world)).toBe('Objeto guardado no inventário.');
  const coffee = game.view(player,world).inventory.find(item=>item.kind==='coffee')!;
  game.act(player,{kind:'drop',item:coffee.id},world);

  const gameplay = game.view(player,world);
  const snapshot = projectWorldSnapshot({...match.view(player.id,[player.id],1),gameplay});
  expect(snapshot.ground).toBe(gameplay.ground);
  expect(snapshot.ground).toContainEqual(expect.objectContaining({id:coffee.id,kind:'coffee'}));
  expect(snapshot.decorations).toBe(gameplay.decorations);
  expect(snapshot.officeHolders.has(player.id)).toBe(true);
  expect(projectWorldSnapshot()).toEqual({ground:[],decorations:[],officeHolders:new Set()});
});
