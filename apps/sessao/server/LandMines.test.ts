import {expect,test} from 'bun:test';
import {Gameplay} from './Gameplay';
import type {GameplayWorld} from './gameplay-world';
import {consumableAction,type GameplayEvent} from '../src/gameplay';
import {canStand,type Player} from '../src/map';
import {npcs,treasurer} from '../src/npcs';
import {landMine} from '../src/land-mines';
import {marketProduct,equipmentCategoryKinds} from '../src/market-catalog';
function setup() {
  const players:Player[] = ['owner','victim'].map(id=>({id,nick:id,character:0,x:140,y:146,direction:0,moving:false}));
  const events:GameplayEvent[] = [];
  const world:GameplayWorld = {players,now:0,voice:()=>true,office:()=>undefined,earn:()=>{},publish:event=>events.push(event)};
  const game = new Gameplay();
  game.reset(0,()=>.5,players);
  const [owner,victim] = players;
  game.giveTrainingItem(owner.id,'landMine');
  const item = game.view(owner,world).inventory.find(item=>item.kind==='landMine')!;
  const plant = ()=>game.act(owner,consumableAction(item)!.action,world);
  return {game,world,events,owner,victim,item,plant};
}
test('mine is sold as sabotage; planting consumes the held item and arms after a delay',()=>{
  expect(marketProduct('equipment','landMine')?.price).toBe(landMine.price);
  expect(equipmentCategoryKinds('sabotage')).toContain('landMine');
  const {game,world,owner,victim,plant,item} = setup();
  plant();
  expect(game.view(owner,world).inventory.some(entry=>entry.id===item.id)).toBe(false);
  expect(game.view(owner,world).mines).toEqual([{id:item.id,x:140,y:146}]);
  world.now=landMine.armingMs-1;
  game.tick(world,true);
  expect(victim.knockedOut).toBeFalsy();
  owner.x+=50;
  world.now++;
  game.tick(world,true);
  expect(victim.knockedOut).toBe(true);
  expect(game.view(victim,world).vitality?.hp).toBe(0);
  expect(game.view(victim,world).mines).toEqual([]);
});
test('single-use explosion drops cash and normal knockout recovery still works',()=>{
  const {game,world,events,owner,victim,plant} = setup();
  game.giveTrainingItem(victim.id,'briefcase');
  plant();
  owner.x+=50;
  world.now=landMine.armingMs;
  game.tick(world,true);
  expect(events.filter(event=>event.type==='mine-triggered')).toHaveLength(1);
  expect(game.view(victim,world).inventory.some(item=>item.kind==='briefcase')).toBe(false);
  world.now+=100;
  game.tick(world,true);
  expect(events.filter(event=>event.type==='mine-triggered')).toHaveLength(1);
  world.now+=9000;
  game.tick(world,true);
  expect(victim.knockedOut).toBeFalsy();
});
test('owner can trigger their mine; paused play and absent or carried players cannot',()=>{
  const {game,world,owner,victim,plant} = setup();
  plant();
  victim.x+=100;
  world.now=landMine.armingMs;
  game.tick(world,false);
  expect(owner.knockedOut).toBeFalsy();
  world.present=()=>false;
  game.tick(world,true);
  expect(owner.knockedOut).toBeFalsy();
  world.present=()=>true;
  owner.carried=true;
  game.tick(world,true);
  expect(owner.knockedOut).toBeFalsy();
  owner.carried=undefined;
  game.tick(world,true);
  expect(owner.knockedOut).toBe(true);
});
test('ownership is enforced, reset removes mines, distant players cannot see the mark',()=>{
  const {game,world,owner,victim,item,plant} = setup();
  game.act(victim,{kind:'plant-mine',item:item.id},world);
  expect(game.view(owner,world).mines).toEqual([]);
  plant();
  victim.x=1000;
  expect(game.view(victim,world).mines).toEqual([]);
  game.reset(world.now,()=>.5,world.players);
  expect(game.view(owner,world).mines).toEqual([]);
});

for (const [id,npc] of Object.entries({...npcs,treasurer})) {
  test(`mine planting rejects the ${id} interaction area with map error feedback and keeps the item`,()=>{
    const {game,world,owner,item,plant} = setup();
    const failures:{id:string;message:string}[] = [];
    world.actionFailed=(id,message)=>failures.push({id,message});
    const point = 'interaction' in npc ? npc.interaction : {x:npc.x,y:npc.y+11};
    Object.assign(owner,point);
    expect(canStand(owner.x,owner.y)).toBe(true);
    const message = plant();
    expect(message).toBe('Não é possível implantar minas em áreas de interação com NPCs.');
    expect(failures).toEqual([{id:owner.id,message:message!}]);
    expect(game.view(owner,world).inventory.some(entry=>entry.id===item.id)).toBe(true);
    expect(game.view(owner,world).mines).toEqual([]);
    Object.assign(owner,{x:140,y:146});
    expect(plant()).toBe('Mina instalada. Afaste-se: ela arma em 1,5 s.');
  });
}
