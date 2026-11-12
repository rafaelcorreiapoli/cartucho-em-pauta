import { expect, test } from 'bun:test';
import { Combat } from './Combat';
import { Gameplay } from './Gameplay';
import type { GameplayWorld } from './gameplay-world';
import type { GameplayEvent } from '../src/gameplay';
import { canStand, VISION_RADIUS, type Player } from '../src/map';
import { findRoute } from '../src/navigation';
import { npcs } from '../src/npcs';
import { applyInput } from '../src/movement';

function player(id:string, x:number, y:number, character=0):Player {
  return {id,nick:id,x,y,character,direction:0,moving:false};
}

function setup() {
  const alice = player('Alice',631,197);
  const bob = player('Bob',640,197,1);
  const game = new Gameplay();
  const events:GameplayEvent[] = [];
  const balance = new Map([[alice.id,12],[bob.id,5]]);
  const world:GameplayWorld = {
    players:[alice,bob],now:100,voice:()=>true,earn:()=>{},office:()=>undefined,
    wallet:id=>balance.get(id) ?? 0,
    spend(id,amount) {
      const funds = balance.get(id) ?? 0;
      if (amount>funds) return false;
      balance.set(id,funds-amount);
      return true;
    },
    publish:event=>events.push(event),
  };
  const openShop = (buyer:Player) => {
    game.act(buyer,{kind:'talk',target:'vendor'},world);
    const token = game.view(buyer,world).dialogue?.token;
    game.act(buyer,{kind:'dialogue-choice',target:'products',token},world);
    return game.view(buyer,world).dialogue?.token;
  };
  return {alice,bob,game,events,balance,world,openShop};
}

test('the vendor is reachable, maintains separate dialogue sessions and accepts each purchase token once', () => {
  const {alice,bob,game,events,balance,world,openShop} = setup();
  expect(canStand(npcs.vendor.x,npcs.vendor.y)).toBe(false);
  expect(findRoute({x:140,y:146},{x:alice.x,y:alice.y}).at(-1)).toEqual({x:alice.x,y:alice.y});
  expect(game.act(alice,{kind:'shop-buy',target:'baton',token:1},world)).toBe('Abra o catálogo do vendedor.');

  const token = openShop(alice);
  expect(token).toBeDefined();
  expect(game.view(bob,world).dialogue).toBeUndefined();
  const other = openShop(bob);
  expect(other).not.toBe(token);
  expect(game.act(bob,{kind:'shop-buy',target:'vest',token},world)).toBe('Abra o catálogo do vendedor.');
  expect(game.act(alice,{kind:'shop-buy',target:'baton',token},world)).toBe('Compra guardada no inventário.');
  expect(game.act(alice,{kind:'shop-buy',target:'vest',token},world)).toBe('Abra o catálogo do vendedor.');
  expect(balance.get(alice.id)).toBe(10);
  expect(game.view(alice,world).inventory.map(item=>item.kind)).toEqual(['baton']);
  expect(events.filter(event=>event.type==='purchased')).toHaveLength(1);

  bob.x = 740;
  expect(game.act(bob,{kind:'shop-buy',target:'vest',token:other},world)).toBe('Abra o catálogo do vendedor.');
  expect(balance.get(bob.id)).toBe(5);
  expect(game.view(bob,world).dialogue).toBeUndefined();
  game.tick(world,false);
  expect(game.view(alice,world).dialogue).toBeUndefined();
});

test('equipping changes custody, binocular range and voice battery without stacking bonuses', () => {
  const {alice,game,world,openShop} = setup();
  game.act(alice,{kind:'shop-buy',target:'binoculars',token:openShop(alice)},world);
  const binocular = game.view(alice,world).inventory[0];
  game.act(alice,{kind:'equip',item:binocular.id},world);
  expect(game.view(alice,world).inventory).toEqual([]);
  expect(game.view(alice,world).equipped).toEqual([binocular]);
  expect(game.vision(alice.id)).toBe(VISION_RADIUS+2);
  expect(game.act(alice,{kind:'shop-buy',target:'binoculars',token:openShop(alice)},world)).toBe('Você já tem este equipamento.');
  game.act(alice,{kind:'unequip',item:binocular.id},world);
  expect(game.vision(alice.id)).toBe(VISION_RADIUS);

  game.act(alice,{kind:'shop-buy',target:'voiceModulator',token:openShop(alice)},world);
  const modulator = game.view(alice,world).inventory.find(item=>item.kind==='voiceModulator')!;
  game.act(alice,{kind:'equip',item:modulator.id},world);
  game.act(alice,{kind:'toggle-modulator'},world);
  expect(game.view(alice,world).modulator).toEqual({active:true,battery:25,recharge:0});
  world.now += 25_000;
  expect(game.view(alice,world).modulator).toEqual({active:false,battery:0,recharge:45});
  expect(game.act(alice,{kind:'toggle-modulator'},world)).toBe('Modulador recarregando.');
  world.now += 45_000;
  expect(game.act(alice,{kind:'toggle-modulator'},world)).toBe('Modulador ligado.');
  game.act(alice,{kind:'unequip',item:modulator.id},world);
  expect(game.view(alice,world).modulator).toBeUndefined();
});

test('the shop does not debit rejected purchases and only equipped weapons can hit', () => {
  const {alice,bob,game,balance,events,world,openShop} = setup();
  balance.set(alice.id,1);
  expect(game.act(alice,{kind:'shop-buy',target:'baton',token:openShop(alice)},world)).toBe('Saldo insuficiente.');
  expect(balance.get(alice.id)).toBe(1);
  expect(game.view(alice,world).inventory).toEqual([]);

  balance.set(alice.id,12);
  expect(game.act(alice,{kind:'shop-buy',target:'baton',token:openShop(alice)},world)).toBe('Compra guardada no inventário.');
  const weapon = game.view(alice,world).inventory[0];
  expect(game.act(alice,{kind:'attack',target:bob.id},world)).toBe('Equipe um porrete.');
  expect(game.act(bob,{kind:'equip',item:weapon.id},world)).toBe('O equipamento não está com você.');
  expect(game.act(alice,{kind:'equip',item:weapon.id},world)).toBe('Equipado.');
  expect(game.act(alice,{kind:'attack',target:bob.id},world)).toBe('Acertou · 26 de dano');
  expect(game.view(bob,world).vitality?.hp).toBe(74);
  expect(events.filter(event=>event.type==='hit')).toHaveLength(1);
});

test('combat respects armor, obstacles, cooldown, aid, recovery protection and the plenary transition', () => {
  const alice = player('Alice',140,146);
  const bob = player('Bob',152,146,1);
  const combat = new Combat();
  expect(combat.attack(alice,bob,true,1).damage).toBe(17);
  expect(combat.view(bob,1).hp).toBe(83);
  expect(combat.attack(alice,bob,false,2).error).toBe('O porrete está em recarga.');
  for (const now of [1300,2600,3900,5200]) combat.attack(alice,bob,false,now);
  expect(combat.view(bob,5200).hp).toBe(0);
  expect(bob.knockedOut).toBe(true);
  const movement = {player:bob,route:[{x:164,y:146}],ack:0};
  applyInput(movement,{seq:1,motion:{x:1,y:0}});
  expect(movement.route).toEqual([]);
  expect(bob.x).toBe(152);
  expect(combat.aid(alice,bob,5250)).toBe(true);
  expect(combat.view(bob,5250).hp).toBe(45);
  expect(combat.attack(alice,bob,false,6500).error).toBe('Alvo indisponível.');
  combat.attack(alice,bob,false,9500);
  combat.attack(alice,bob,false,10800);
  expect(bob.knockedOut).toBe(true);
  combat.tick([alice,bob],11000,false);
  expect(bob.knockedOut).toBeUndefined();
  expect(combat.view(bob,11000).hp).toBe(45);
  Object.assign(alice,{x:620,y:206});
  Object.assign(bob,{x:642,y:206});
  expect(combat.attack(alice,bob,false,16_000).error).toBe('Aproxime-se do alvo.');
});
