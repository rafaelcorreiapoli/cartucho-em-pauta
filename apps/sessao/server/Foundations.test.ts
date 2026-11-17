import {marketPurchaseSlot} from '../src/market-catalog';

import {megaphone} from '../src/equipment';
import { expect, test } from 'bun:test';
import { Combat } from './Combat';
import { Gameplay } from './Gameplay';
import type { GameplayWorld } from './gameplay-world';
import { INVENTORY_SLOTS, type GameplayEvent } from '../src/gameplay';
import { canStand, movementSpeed, roomAt, worldVisible, PLENARY_DOORS, VISION_RADIUS, type Player } from '../src/map';
import { infirmary, recoveryRules } from '../src/medical';
import { findRoute } from '../src/navigation';
import { npcs, snackBar, type NpcId } from '../src/npcs';
import { weapons } from '../src/weapons';
import { applyInput, restMovement, STEP_MS } from '../src/movement';
import { foods } from '../src/food';
import { policyDuration, recoveryPolicy } from '../src/plenary';

function player(id:string, x:number, y:number, character=0):Player {
  return {id,nick:id,x,y,character,direction:0,moving:false};
}

function setup() {
  const alice = {...player('Alice',631,197),direction:1};
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
  const openShop = (buyer:Player, target:NpcId='vendor') => {
    game.act(buyer,{kind:'talk',target},world);
    const token = game.view(buyer,world).dialogue?.token;
    game.act(buyer,{kind:'dialogue-choice',target:'products',token},world);
    return game.view(buyer,world).dialogue?.token;
  };
  const buyGear = (buyer:Player,target:string) => {
    const position = {x:buyer.x,y:buyer.y};
    Object.assign(buyer,{x:npcs.vendor.x,y:npcs.vendor.y+11});
    const result = game.act(buyer,{kind:'shop-buy',target,token:openShop(buyer)},world);
    Object.assign(buyer,position);
    return result;
  };
  return {alice,bob,game,events,balance,world,openShop,buyGear};
}

test('the vendor is reachable, maintains separate dialogue sessions and accepts each purchase token once', () => {
  const {alice,bob,game,events,balance,world,openShop} = setup();
  Object.assign(alice,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  Object.assign(bob,{x:npcs.vendor.x+9,y:alice.y});
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

test('the Lanchonete is reachable and each vendor sells only its own catalog', () => {
  const {alice,game,world,openShop,balance} = setup();
  const counter = npcs.snackVendor.interaction;
  expect(roomAt(counter)).toBe(snackBar.name);
  expect(findRoute({x:140,y:146},counter).at(-1)).toEqual(counter);
  expect(canStand(npcs.snackVendor.x,npcs.snackVendor.y)).toBe(false);
  Object.assign(alice,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  const gearToken = openShop(alice);
  expect(game.act(alice,{kind:'shop-buy',target:'pizza',token:gearToken},world)).toBe('Este produto não é vendido aqui.');
  expect(game.act(alice,{kind:'talk',target:'snackVendor'},world)).toBe('Aproxime-se para conversar.');
  Object.assign(alice,counter);
  const foodToken = openShop(alice,'snackVendor');
  expect(game.view(alice,world).dialogue?.npc).toBe('snackVendor');
  expect(game.act(alice,{kind:'shop-buy',target:'baton',token:foodToken},world)).toBe('Este produto não é vendido aqui.');
  expect(balance.get(alice.id)).toBe(12);
  expect(game.act(alice,{kind:'shop-buy',target:'pizza',token:foodToken},world)).toBe('Compra guardada no inventário.');
  expect(game.view(alice,world).inventory.map(item=>item.kind)).toEqual(['pizza']);
});

test('Palmirinha opens the shop from behind and across the counter',()=>{
  const {alice,game,world} = setup();
  const vendor = npcs.snackVendor;
  const behind = {x:vendor.x,y:vendor.y-12};
  expect(canStand(behind.x,behind.y)).toBe(true);
  expect(canStand(vendor.x,vendor.y-4)).toBe(false);
  let previousToken: number | undefined;
  for (const point of [behind,vendor.interaction]) {
    Object.assign(alice,point);
    expect(game.view(alice,world).npcNearby).toContain('snackVendor');
    expect(game.act(alice,{kind:'open-shop',target:'snackVendor'},world)).toBeUndefined();
    const dialogue = game.view(alice,world).dialogue;
    expect(dialogue).toMatchObject({npc:'snackVendor',shop:true});
    expect(dialogue!.token).not.toBe(previousToken);
    previousToken = dialogue!.token;
    game.act(alice,{kind:'dialogue-close'},world);
  }
  Object.assign(alice,{x:vendor.x,y:vendor.y+37});
  expect(game.view(alice,world).npcNearby).not.toContain('snackVendor');
});

test('equipping changes custody, binocular range and voice battery without stacking bonuses', () => {
  const {alice,game,world,buyGear} = setup();
  buyGear(alice,'binoculars');
  const binocular = game.view(alice,world).inventory[0];
  game.act(alice,{kind:'equip',item:binocular.id},world);
  expect(game.view(alice,world).inventory).toEqual([]);
  expect(game.view(alice,world).equipped).toEqual([binocular]);
  expect(game.view(alice,world).equipmentCooldowns).toEqual({});
  expect(game.vision(alice.id,world.now)).toBe(VISION_RADIUS);
  game.act(alice,{kind:'use-binoculars'},world);
  expect(game.vision(alice.id,world.now)).toBe(VISION_RADIUS*1.65);
  expect(game.view(alice,world).binocularSeconds).toBe(10);
  expect(game.act(alice,{kind:'use-binoculars'},world)).toContain('recarga');
  world.now += 10_000;
  expect(game.vision(alice.id,world.now)).toBe(VISION_RADIUS);
  expect(game.view(alice,world).equipmentCooldowns?.[binocular.id]).toBe(30);
  world.now += 30_000;
  expect(game.act(alice,{kind:'use-binoculars'},world)).toContain('ativo');
  expect(buyGear(alice,'binoculars')).toBe('Você já tem este equipamento.');
  game.act(alice,{kind:'unequip',item:binocular.id},world);
  expect(game.vision(alice.id,world.now)).toBe(VISION_RADIUS);

  buyGear(alice,'voiceModulator');
  const modulator = game.view(alice,world).inventory.find(item=>item.kind==='voiceModulator')!;
  game.act(alice,{kind:'equip',item:modulator.id},world);
  game.act(alice,{kind:'toggle-modulator'},world);
  world.now += 70_000;
  expect(game.view(alice,world).modulator).toEqual({active:true});
  expect(game.act(alice,{kind:'toggle-modulator'},world)).toBe('Modulador desligado.');
  expect(game.view(alice,world).modulator).toEqual({active:false});
  expect(game.act(alice,{kind:'toggle-modulator'},world)).toBe('Modulador ligado.');
  game.act(alice,{kind:'unequip',item:modulator.id},world);
  expect(game.view(alice,world).modulator).toBeUndefined();
});

test('the shop does not debit rejected purchases and only equipped weapons can hit', () => {
  const {alice,bob,game,balance,events,world,buyGear} = setup();
  balance.set(alice.id,1);
  expect(buyGear(alice,'baton')).toBe('Saldo insuficiente.');
  expect(balance.get(alice.id)).toBe(1);
  expect(game.view(alice,world).inventory).toEqual([]);

  balance.set(alice.id,12);
  expect(buyGear(alice,'baton')).toBe('Compra guardada no inventário.');
  const weapon = game.view(alice,world).inventory[0];
  expect(game.act(alice,{kind:'attack',target:bob.id},world)).toBe('Equipe uma arma.');
  expect(game.act(bob,{kind:'equip',item:weapon.id},world)).toBe('O equipamento não está com você.');
  expect(game.act(alice,{kind:'equip',item:weapon.id},world)).toBe('Equipado.');
  expect(game.act(alice,{kind:'attack'},world)).toBeUndefined();
  expect(game.view(bob,world).vitality?.hp).toBe(100);
  expect(game.view(alice,world).vitality?.hp).toBe(120);
  expect(game.view(alice,world).equipmentCooldowns).toEqual({[weapon.id]:.4});
  expect(game.view(bob,world).equipmentCooldowns).toEqual({});
  expect((alice as Player).swing).toEqual({weapon:'baton',startedAt:world.now,angle:0});
  world.now += weapons.baton.impactMs;
  game.tick(world,true);
  expect(game.view(bob,world).vitality?.hp).toBe(74);
  world.now += weapons.baton.swingMs;
  game.tick(world,true);
  expect((alice as Player).swing).toBeUndefined();
  expect(events.filter(event=>event.type==='hit')).toHaveLength(1);
  world.now += weapons.baton.swingMs;
  expect(game.view(alice,world).equipmentCooldowns).toEqual({});
});

test('combat respects armor, obstacles, cooldown, aid, recovery protection and the plenary transition', () => {
  const alice = player('Alice',140,146);
  const bob = player('Bob',152,146,1);
  const combat = new Combat();
  alice.direction = 1;
  const strike = (now:number,armor=false) => {
    expect(combat.attack(alice,now)).toBeUndefined();
    combat.tick([alice,bob],now+weapons.baton.impactMs,true,{armored:()=>armor});
  };
  strike(1,true);
  expect(combat.view(bob,141).hp).toBe(83);
  expect(combat.attack(alice,142)).toBe('A arma está em recarga.');
  for (const now of [1300,2600,3900,5200]) strike(now);
  expect(combat.view(bob,5340)).toMatchObject({hp:0,recovery:recoveryRules.knockoutMs/1000});
  expect(bob.knockedOut).toBe(true);
  const movement = {player:bob,route:[{x:164,y:146}],ack:0};
  applyInput(movement,{seq:1,motion:{x:1,y:0}});
  expect(movement.route).toEqual([]);
  expect(bob.x).toBe(152);
  expect(combat.aid(alice,bob,5400)).toBe(true);
  expect(combat.view(bob,5400).hp).toBe(45);
  expect(bob.recoveryProtected).toBe(true);
  strike(6500);
  expect(combat.view(bob,6640).hp).toBe(45);
  strike(9500);
  expect(bob.recoveryProtected).toBeUndefined();
  strike(10800);
  expect(bob.knockedOut).toBe(true);
  combat.tick([alice,bob],11000,false);
  expect(bob.knockedOut).toBeUndefined();
  expect(combat.view(bob,11000).hp).toBe(45);
  Object.assign(alice,{x:663,y:230});
  Object.assign(bob,{x:685,y:230});
  strike(16_000);
  expect(combat.view(bob,16_140).hp).toBe(45);
});


function knockOut(match:ReturnType<typeof setup>) {
  const {alice,bob,game,world,buyGear} = match;
  buyGear(alice,'baton');
  game.act(alice,{kind:'equip',item:game.view(alice,world).inventory[0].id},world);
  for (const now of [100,1400,2700,4000]) {
    world.now = now;
    game.act(alice,{kind:'attack'},world);
    world.now += weapons.baton.impactMs;
    game.tick(world,true);
  }
}

test('the camera cannot count a disconnected player awaiting reconnection',()=>{
  const {alice,bob,game,world} = setup();
  const connectedWorld = {...world,present:(id:string)=>id===alice.id};
  expect(game.act(alice,{kind:'selfie'},connectedWorld)).toBe('Foto guardada no álbum.');
  expect(game.photoView(alice.id,world.now).album[0]?.photo.people.map(person=>person.id)).toEqual([alice.id]);
  expect(world.players).toContain(bob);
});

test('transport is exclusive, follows authoritative movement and drops on valid floor', () => {
  const match = setup();
  const {alice,bob,game,world,events} = match;
  const carol = player('Carol',642,196);
  world.players.push(carol);
  knockOut(match);
  expect(game.act(alice,{kind:'carry',target:bob.id},world)).toBe('Jogador carregado.');
  expect(game.act(carol,{kind:'carry',target:bob.id},world)).toBe('Esse jogador não pode ser carregado agora.');
  expect(game.act(carol,{kind:'release'},world)).toBeUndefined();
  expect(game.act(alice,{kind:'attack',target:carol.id},world)).toBe('Solte o jogador primeiro.');
  const start = alice.x;
  const control = {player:alice,route:[],ack:0};
  applyInput(control,{seq:1,destination:{x:650,y:197}});
  expect(alice.x-start).toBeCloseTo(movementSpeed(alice)*.05);
  expect(movementSpeed(alice)).toBeCloseTo(88*.65);
  game.tick(world,true);
  expect(bob).toMatchObject({x:alice.x,y:alice.y,direction:1,carried:true});
  applyInput(control,{seq:2,motion:{x:-1,y:0}});
  game.tick(world,true);
  expect(bob).toMatchObject({x:alice.x,y:alice.y,direction:3,carried:true});
  game.act(carol,{kind:'photo'},world);
  expect(game.photoView(carol.id,world.now).album[0]?.photo.people.find(person=>person.id===bob.id))
    .toMatchObject({knockedOut:true,carried:true});

  expect(game.act(alice,{kind:'release'},world)).toBe('Jogador colocado no chão.');
  expect(game.act(alice,{kind:'release'},world)).toBeUndefined();
  expect(canStand(bob.x,bob.y)).toBe(true);
  expect(bob.carried).toBeUndefined();
  expect(bob.knockedOut).toBe(true);
  expect(alice.carrying).toBeUndefined();
  expect(events.filter(event=>event.type==='character-dropped')).toHaveLength(1);
});

test('transport ends on disconnect, natural recovery and plenary transition', () => {
  for (const reason of ['disconnect','recovery','plenary'] as const) {
    const match = setup();
    const {alice,bob,game,world,events} = match;
    knockOut(match);
    game.act(alice,{kind:'carry',target:bob.id},world);
    if (reason==='disconnect') {
      game.leave(bob,world,false);
      world.present = id=>id!==bob.id;
      expect(game.act(alice,{kind:'carry',target:bob.id},world)).toBe('Esse jogador não pode ser carregado agora.');
      world.present = ()=>true;
      expect(game.act(alice,{kind:'carry',target:bob.id},world)).toBe('Jogador carregado.');
      game.leave(alice,world,false);
    } else {
      if (reason==='recovery') world.now = 12_140;
      game.tick(world,reason==='recovery');
      expect(bob.knockedOut).toBeUndefined();
      expect(events.filter(event=>event.type==='character-recovered')).toHaveLength(1);
    }
    expect(alice.carrying).toBeUndefined();
    expect(bob.carried).toBeUndefined();
    expect(canStand(bob.x,bob.y)).toBe(true);
  }
});

test('the infirmary can treat a passenger and heals only after a valid payment', () => {
  const match = setup();
  const {alice,bob,game,world,balance,events} = match;
  knockOut(match);
  expect(game.act(alice,{kind:'treat'},world)).toBe('Atendimento indisponível.');
  expect(findRoute({x:140,y:146},{x:infirmary.x,y:infirmary.y}).at(-1)).toMatchObject({x:infirmary.x,y:infirmary.y});
  game.act(alice,{kind:'carry',target:bob.id},world);
  Object.assign(alice,{x:803,y:461});
  expect(game.act(alice,{kind:'treat'},world)).toBe('Atendimento indisponível.');
  Object.assign(alice,{x:infirmary.x,y:infirmary.y});
  game.tick(world,true);
  balance.set(alice.id,0);
  expect(game.view(alice,world).treatment).toEqual({target:bob.id,price:infirmary.price,affordable:false});
  expect(game.act(alice,{kind:'treat'},world)).toBe('Saldo insuficiente para o atendimento.');
  expect(game.view(bob,world).vitality?.hp).toBe(0);
  expect(bob.carried).toBe(true);

  balance.set(alice.id,infirmary.price);
  expect(game.view(alice,world).treatment).toEqual({target:bob.id,price:infirmary.price,affordable:true});
  expect(game.act(alice,{kind:'treat'},world)).toBe('Atendimento concluído.');
  expect(game.view(bob,world).vitality?.hp).toBe(80);
  expect(bob.carried).toBeUndefined();
  expect(game.act(alice,{kind:'treat'},world)).toBe('Atendimento indisponível.');
  expect(balance.get(alice.id)).toBe(0);
  expect(game.view(bob,world).treatment).toEqual({target:undefined,price:infirmary.price,affordable:true});
  expect(game.act(bob,{kind:'treat'},world)).toBe('Atendimento concluído.');
  expect(game.view(bob,world).treatment).toBeUndefined();
  expect(game.view(bob,world).vitality?.hp).toBe(100);
  expect(game.act(bob,{kind:'treat'},world)).toBe('Atendimento indisponível.');
  expect(balance.get(bob.id)).toBe(4);
  expect(events.filter(event=>event.type==='treated')).toHaveLength(2);
});


test('dialogue eligibility is private and checked again when the player chooses', () => {
  const {alice,bob,game,world} = setup();
  world.office = id=>id===alice.id ? 'president' : undefined;
  world.hasMission = (id,mission)=>id===alice.id && mission==='cafe';
  world.hasEvidence = (id,kind)=>id===alice.id && kind==='clandestine-transfer';
  Object.assign(alice, {x:240,y:250});
  game.act(alice,{kind:'supply',place:'coffee'},world);
  Object.assign(alice,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  Object.assign(bob,{x:npcs.vendor.x+9,y:alice.y});
  for (const player of [alice,bob]) game.act(player,{kind:'talk',target:'vendor'},world);
  const options = (player:Player)=>game.view(player,world).dialogue?.options.map(choice=>choice.id);
  expect(options(alice)).toEqual(expect.arrayContaining(['coffee','president','evidence','mission']));
  expect(options(bob)).toEqual(['products','promotion','budget','leave']);
  const token = game.view(alice,world).dialogue?.token;
  world.hasMission = ()=>false;
  expect(game.act(alice,{kind:'dialogue-choice',target:'mission',token},world)).toBe('Opção indisponível.');
  game.act(alice,{kind:'dialogue-choice',target:'president',token},world);
  expect(game.view(alice,world).dialogue?.text).toContain('Presidência');
});

test('modulator switches off when another player collects and equips it', () => {
  const {alice,bob,game,world,buyGear} = setup();
  buyGear(alice,'voiceModulator');
  const {id} = game.view(alice,world).inventory[0];
  game.act(alice,{kind:'equip',item:id},world);
  game.act(alice,{kind:'toggle-modulator'},world);
  game.act(alice,{kind:'unequip',item:id},world);
  game.act(alice,{kind:'drop',item:id},world);
  game.act(bob,{kind:'collect',item:id},world);
  game.act(bob,{kind:'equip',item:id},world);
  expect(game.view(bob,world).modulator).toEqual({active:false});
  expect(game.act(bob,{kind:'toggle-modulator'},world)).toBe('Modulador ligado.');
});

test('doors, furniture and actors without a player session use the shared world rules', () => {
  const [left,,width] = PLENARY_DOORS[1];
  const center = left+width/2;
  const alice = player('Alice',center,520);
  const passage = {player:alice,route:[],ack:0};
  applyInput(passage,{seq:1,door:1});
  expect(alice.y).toBeGreaterThan(520);
  const closed = {player:player('Bia',center,554),route:[],ack:0,plenary:true};
  applyInput(closed,{seq:1,door:1,plenary:true});
  expect(closed.player.y).toBe(554);
  expect(worldVisible({x:675,y:201},{x:675,y:249},VISION_RADIUS+2)).toBe(false);
  expect(worldVisible({x:550,y:195},{x:550,y:282},VISION_RADIUS+2)).toBe(false);
  expect(worldVisible({x:500,y:140},{x:587,y:140})).toBe(false);
  expect(worldVisible({x:500,y:140},{x:587,y:140},VISION_RADIUS+2)).toBe(true);
  const npc = {id:'npc:treino',character:0,x:151,y:146};
  const combat = new Combat();
  const attacker = {...player('Treino',140,146),direction:1};
  combat.attack(attacker,100);
  combat.tick([attacker,npc],100+weapons.baton.impactMs,true);
  expect(combat.view(npc,240).hp).toBe(94);
});


test('a swing can miss or hit the closest player in its arc at the impact frame', () => {
  const attacker = {...player('Alice',140,146),direction:1};
  const behind = player('Atrás',129,146);
  const ahead = player('À frente',161,146);
  const closer = player('Mais perto',150,146);
  const combat = new Combat();
  const hits:string[] = [];
  const callbacks = {hit:(_attacker:Player,target:Player)=>hits.push(target.id)};

  combat.attack(attacker,100);
  expect((attacker as Player).swing?.angle).toBe(0);
  combat.tick([attacker,behind],240,true,callbacks);
  expect(hits).toEqual([]);
  expect(behind.hit).toBeUndefined();

  combat.attack(attacker,1400);
  combat.tick([attacker,behind,ahead],1450,true,callbacks);
  expect(hits).toEqual([]);
  combat.tick([attacker,behind,ahead,closer],1540,true,callbacks);
  combat.tick([attacker,behind,ahead,closer],1590,true,callbacks);
  expect(hits).toEqual([closer.id]);
  expect(combat.view(ahead,1590).hp).toBe(120);
  expect(combat.view(closer,1590).hp).toBe(94);
});

test('the visible tip of the baton hits beyond the old range and misses beyond the sprite', () => {
  const attacker = {...player('Alice',140,146),direction:1};
  const target = player('Alvo',181,146);
  const combat = new Combat();

  combat.attack(attacker,100);
  combat.tick([attacker,target],240,true);
  expect(combat.view(target,240).hp).toBe(94);

  target.x = 194;
  combat.attack(attacker,1400);
  combat.tick([attacker,target],1540,true);
  expect(combat.view(target,1540).hp).toBe(94);
  expect(target.hit).toBeUndefined();
});


const consumableCases:[keyof typeof foods,number,number][] = [
  ['pizza',57,40], ['chocolates',62,40], ['condensedMilk',82,40],
  ['coxinha',42,40], ['coffee',22,70], ['energyDrink',22,40], ['mortadellaRoll',47,50],
  ['lobster',100,40], ['picanha',92,40],
];

for (const [kind,hp,stamina] of consumableCases) {
  test(`${kind} can be bought and consumed once by its owner`,()=>{
    const {alice,bob,game,world,openShop,buyGear,balance,events} = setup();
    balance.set(bob.id,12);
    buyGear(alice,'baton');
    game.act(alice,{kind:'equip',item:game.view(alice,world).inventory[0].id},world);
    for (let strike=0;strike<3;strike++) {
      game.act(alice,{kind:'attack'},world);
      world.now += weapons.baton.impactMs;
      game.tick(world,true);
      world.now += weapons.baton.swingMs;
      game.tick(world,true);
    }
    expect(game.view(bob,world).vitality?.hp).toBe(22);
    bob.speed = 88;
    bob.stamina = 40;
    Object.assign(bob,npcs.snackVendor.interaction);
    const token = openShop(bob,'snackVendor');
    const buy = {kind:'shop-buy',target:kind,token} as const;
    expect(game.act(bob,buy,world)).toBe('Compra guardada no inventário.');
    expect(game.act(bob,buy,world)).toBe('Abra o catálogo do vendedor.');
    expect(balance.get(bob.id)).toBeCloseTo(12-foods[kind].price,5);
    const [item] = game.view(bob,world).inventory;
    expect(item.kind).toBe(kind);
    const use = {kind:'use',item:item.id} as const;
    expect(game.act(alice,use,world)).toBe('O objeto não está com você.');
    expect(game.act(bob,use,world)).toBe(kind==='coffee' ? 'Café bebido.' : 'Objeto utilizado.');
    expect(game.act(bob,use,world)).toBe('Objeto indisponível.');
    expect(game.view(bob,world).inventory).toEqual([]);
    expect(game.view(bob,world).vitality?.hp).toBe(hp);
    expect(bob.stamina).toBe(stamina);
    expect(events.filter(event=>event.type==='used' && event.item===item.id)).toHaveLength(1);

    if (kind==='condensedMilk') {
      const {factor,durationMs} = foods.condensedMilk.effect.speed;
      expect(movementSpeed(bob)).toBeCloseTo(88*factor);
      for (let t=0;t<durationMs;t+=STEP_MS) restMovement(bob);
      expect(movementSpeed(bob)).toBe(88);
    }
    if (kind==='energyDrink') {
      const {factor,durationMs} = foods.energyDrink.effect.staminaRegen;
      restMovement(bob);
      expect(bob.stamina).toBe(40+factor);
      for (let t=STEP_MS;t<durationMs;t+=STEP_MS) restMovement(bob);
      bob.stamina = 40;
      restMovement(bob);
      expect(bob.stamina).toBe(41);
    }
  });
}

test('fôlego expands sprint capacity and shoes increase walking and sprinting speed',()=>{
  const {alice:runner,bob,game,world,buyGear} = setup();
  runner.stamina = 90;
  game.applyAttribute(runner,'stamina');
  expect(runner).toMatchObject({stamina:140,staminaMax:150});

  const move = {player:runner,route:[],ack:0};
  const motion = {x:1,y:0};
  const walkingSpeed = movementSpeed(runner);
  applyInput(move,{seq:1,motion,sprint:true});
  expect(runner).toMatchObject({sprinting:true,stamina:138.75});
  const sprintingSpeed = movementSpeed(runner);
  for (let i=0;i<30;i++) restMovement(runner);
  expect(runner.stamina).toBe(150);

  buyGear(runner,'runningShoes');
  const shoes = game.view(runner,world).inventory.find(item=>item.kind==='runningShoes')!;
  expect(game.act(runner,{kind:'equip',item:shoes.id},world)).toBe('Equipado.');
  expect(movementSpeed(runner)).toBeCloseTo(walkingSpeed*1.25);
  applyInput(move,{seq:2,motion,sprint:true});
  expect(movementSpeed(runner)).toBeCloseTo(sprintingSpeed*1.25);
  expect(runner.stamina).toBe(148.75);
  expect(game.act(runner,{kind:'unequip',item:shoes.id},world)).toBe('Guardado no inventário.');
  expect(movementSpeed(runner)).toBeCloseTo(sprintingSpeed);
  game.reset(world.now,()=>0,[runner,bob],()=>0);
  expect(runner).toMatchObject({stamina:100,staminaMax:undefined,runningShoes:undefined});
});

test('megaphone reserves one channel, keeps the modulator active and releases on timeout or plenary',()=>{
  const {alice,bob,game,world,buyGear} = setup();
  const feedback:string[] = [];
  world.feedback = (_,message)=>feedback.push(message);
  const toggle = {kind:'toggle-megaphone'} as const;
  expect(game.act(alice,toggle,world)).toContain('Equipe');
  const buyAndEquip = (owner:Player,kind:'megaphone'|'voiceModulator') => {
    expect(buyGear(owner,kind)).toBe('Compra guardada no inventário.');
    const item = game.view(owner,world).inventory.find(item=>item.kind===kind)!;
    expect(game.act(owner,{kind:'equip',item:item.id},world)).toBe('Equipado.');
    return item.id;
  };
  const a = buyAndEquip(alice,'megaphone');
  const b = buyAndEquip(bob,'megaphone');
  buyAndEquip(alice,'voiceModulator');
  game.act(alice,{kind:'toggle-modulator'},world);
  expect(game.act(alice,toggle,world)).toBe('Megafone ativo.');
  expect(game.megaphoneSpeaker()).toBe(alice.id);
  expect(game.view(alice,world)).toMatchObject({megaphoneSeconds:megaphone.duration/1000,modulator:{active:true}});
  expect(game.act(bob,toggle,world)).toBe('Canal de Megafone ocupado.');
  expect(game.view(bob,world).equipmentCooldowns?.[b]).toBeUndefined();
  world.now += megaphone.duration-1;
  game.tick(world,true);
  expect(game.megaphoneSpeaker()).toBe(alice.id);
  world.now++;
  game.tick(world,true);
  expect(game.megaphoneSpeaker()).toBeUndefined();
  expect(game.view(alice,world).equipmentCooldowns?.[a]).toBe(megaphone.cooldown/1000);
  expect(game.act(alice,toggle,world)).toBe('Megafone em recarga.');
  expect(game.act(bob,toggle,world)).toBe('Megafone ativo.');
  game.tick(world,false);
  expect(game.megaphoneSpeaker()).toBeUndefined();
  expect(game.view(bob,world).equipmentCooldowns?.[b]).toBe(megaphone.cooldown/1000);
  world.now += megaphone.cooldown-1;
  game.tick(world,true);
  expect(game.act(alice,toggle,world)).toBe('Megafone em recarga.');
  world.now++;
  game.tick(world,true);
  expect(feedback).toContain('Megafone pronto.');
  expect(game.act(alice,toggle,world)).toBe('Megafone ativo.');
  game.stopMegaphone(alice.id,world);
  expect(game.megaphoneSpeaker()).toBeUndefined();
  expect(game.view(alice,world).equipmentCooldowns?.[a]).toBe(megaphone.cooldown/1000);
});

test('attacks spend stamina exactly once and insufficient stamina does not start cooldown',()=>{
  const {alice,game,world,buyGear} = setup();
  buyGear(alice,'baton');
  const weapon = game.view(alice,world).inventory[0];
  game.act(alice,{kind:'equip',item:weapon.id},world);
  alice.stamina = weapons.baton.staminaCost-1;
  expect(game.act(alice,{kind:'attack'},world)).toContain('Stamina insuficiente');
  expect(game.view(alice,world).equipmentCooldowns?.[weapon.id]).toBeUndefined();
  alice.stamina = weapons.baton.staminaCost;
  expect(game.act(alice,{kind:'attack'},world)).toBeUndefined();
  expect(alice.stamina).toBe(0);
  expect(game.act(alice,{kind:'attack'},world)).toContain('recarga');
  expect(alice.stamina).toBe(0);
});

test('first aid kits heal the owner once, cap healing and are kept at full health',()=>{
  const {alice,bob,game,balance,events,world,buyGear} = setup();
  expect(buyGear(bob,'firstAidKit')).toBe('Compra guardada no inventário.');
  expect(balance.get(bob.id)).toBe(3.5);
  const kit = game.view(bob,world).inventory[0];
  const use = {kind:'use',item:kit.id} as const;
  expect(game.act(bob,use,world)).toBe('Seus PV já estão cheios.');
  expect(game.view(bob,world).inventory).toEqual([kit]);

  buyGear(alice,'baton');
  game.act(alice,{kind:'equip',item:game.view(alice,world).inventory[0].id},world);
  game.act(alice,{kind:'attack'},world);
  world.now += weapons.baton.impactMs;
  game.tick(world,true);
  expect(game.view(bob,world).vitality?.hp).toBe(74);
  game.act(alice,use,world);
  expect(game.view(bob,world).inventory).toEqual([kit]);

  expect(game.act(bob,use,world)).toBe('Primeiros socorros aplicados.');
  expect(game.view(bob,world).vitality?.hp).toBe(100);
  game.act(bob,use,world);
  expect(game.view(bob,world).inventory).toEqual([]);
  expect(events.filter(event=>event.type==='used')).toHaveLength(1);
});

test('identical snacks share a slot and support partial offers and drops',()=>{
  const {alice,bob,game,world,openShop,balance,events} = setup();
  Object.assign(alice,npcs.snackVendor.interaction);
  const buy = (buyer:Player) => game.act(buyer,{kind:'shop-buy',target:'coxinha',token:openShop(buyer,'snackVendor')},world);
  for (let index=0;index<5;index++) expect(buy(alice)).toBe('Compra guardada no inventário.');
  expect(balance.get(alice.id)).toBe(9.5);
  const inventory = (who:Player) => game.view(who,world).inventory;
  expect(inventory(alice)).toHaveLength(1);
  const {id:item} = inventory(alice)[0];
  expect(inventory(alice)[0].quantity).toBe(5);
  const purchases = events.filter(event=>event.type==='purchased');
  expect(new Set(purchases.map(event=>event.item)).size).toBe(5);
  expect(purchases.map(event=>event.inventoryItem)).toEqual(Array(5).fill(item));
  expect(game.act(alice,{kind:'use',item,quantity:5},world)).toBe('Objeto utilizado.');
  expect(inventory(alice)[0].quantity).toBe(4);

  Object.assign(bob,npcs.snackVendor.interaction);
  expect(buy(bob)).toBe('Compra guardada no inventário.');
  const offer = {kind:'offer',item,target:bob.id} as const;
  expect(game.act(alice,{...offer,quantity:5},world)).toBe('Quantidade indisponível.');
  expect(game.act(alice,{...offer,quantity:2},world)).toBe('Pedido enviado.');
  const request = game.view(bob,world).requests[0];
  expect(request.item.quantity).toBe(2);
  expect(inventory(alice)[0].quantity).toBe(4);
  const accept = {kind:'accept',item:request.id} as const;
  expect(game.act(bob,accept,world)).toBe('Objeto recebido.');
  expect(game.act(bob,accept,world)).toBe('Pedido indisponível.');
  expect(inventory(alice)[0].quantity).toBe(2);
  expect(inventory(bob)).toHaveLength(1);
  expect(inventory(bob)[0].quantity).toBe(3);
  const received = events.filter(event=>event.type==='item-received');
  expect(received).toEqual([expect.objectContaining({
    actor:bob.id,target:alice.id,kind:'coxinha',inventoryItem:inventory(bob)[0].id,witnesses:[],
  })]);
  expect(received[0].item).not.toBe(inventory(bob)[0].id);


  expect(game.act(alice,{kind:'drop',item,quantity:1},world)).toBe('Objeto largado.');
  expect(inventory(alice)[0].quantity).toBe(1);
  const dropped = game.view(bob,world).nearby.find(entry=>entry.kind==='coxinha')!;
  expect(dropped.quantity).toBe(1);
  expect(game.act(bob,{kind:'collect',item:dropped.id},world)).toBe('Objeto recolhido.');
  expect(inventory(bob)[0].quantity).toBe(4);
});

test('hands, torso and feet are independent of the two accessory spaces',()=>{
  const {alice,game,world,buyGear,balance} = setup();
  balance.set(alice.id,20);
  const equip = (kind:string) => {
    expect(buyGear(alice,kind)).toBe('Compra guardada no inventário.');
    const item = game.view(alice,world).inventory.find(item=>item.kind===kind)!;
    return game.act(alice,{kind:'equip',item:item.id},world);
  };
  for (const kind of ['baton','runningShoes','binoculars','megaphone']) expect(equip(kind)).toBe('Equipado.');
  expect(equip('vest')).toBe('Equipado.');
  expect(equip('voiceModulator')).toBe('Os dois espaços de acessórios estão ocupados.');
  expect(game.view(alice,world).equipped).toHaveLength(5);
});

test('direct shop equips into free slots and swaps only the confirmed accessory',()=>{
  const {alice,game,balance,world} = setup();
  Object.assign(alice,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  balance.set(alice.id,30);
  game.act(alice,{kind:'open-shop',target:'vendor'},world);
  const view = ()=>game.view(alice,world);
  expect(view().dialogue?.shop).toBe(true);
  const buy = (target:string)=>game.act(alice,{kind:'shop-buy',target,token:view().dialogue?.token},world);
  expect(buy('binoculars')).toBe('Compra equipada.');
  expect(buy('vest')).toBe('Compra equipada.');
  expect(buy('voiceModulator')).toBe('Compra equipada.');
  expect(buy('megaphone')).toBe('Compra guardada no inventário.');
  const [binocular,vest] = view().equipped!;
  const [megaphone] = view().inventory;
  expect(view().equipped?.map(item=>item.kind)).toEqual(['binoculars','vest','voiceModulator']);
  expect(game.act(alice,{kind:'replace-gear',item:megaphone.id,token:vest.id},world)).toBe('O equipamento neste espaço mudou.');
  expect(game.act(alice,{kind:'replace-gear',item:megaphone.id,token:binocular.id},world)).toBe('Equipado.');
  expect(view().inventory.map(item=>item.kind)).toEqual(['binoculars']);
  expect(view().equipped?.map(item=>item.kind)).toEqual(['vest','voiceModulator','megaphone']);
  expect(balance.get(alice.id)).toBe(18);
});

test('plenary voting allows weapon hits against players in the chamber',()=>{
  const {alice,bob,game,world,buyGear,events} = setup();
  buyGear(alice,'baton');
  game.act(alice,{kind:'equip',item:game.view(alice,world).inventory[0].id},world);
  Object.assign(alice,{x:470,y:665,direction:1});
  Object.assign(bob,{x:484,y:665});
  game.act(alice,{kind:'attack'},world);
  world.now += weapons.baton.impactMs;
  game.tick(world,false,true);
  expect(events.filter(event=>event.type==='hit').map(event=>event.target)).toEqual([bob.id]);
  expect(game.view(bob,world).vitality?.hp).toBeLessThan(100);
});

test('Bolsa Churrasco restores HP once per second while the policy is active',()=>{
  const {alice,bob,game,world,buyGear} = setup();
  buyGear(alice,'baton');
  game.act(alice,{kind:'equip',item:game.view(alice,world).inventory[0].id},world);
  game.act(alice,{kind:'attack'},world);
  world.now += weapons.baton.impactMs;
  game.tick(world,true);
  expect(game.view(bob,world).vitality?.hp).toBe(74);
  world.hasMandate = id=>id===bob.id;
  world.policies = {recovery:policyDuration};
  world.now = recoveryPolicy.tickMs-1;
  game.tick(world,true);
  expect(game.view(bob,world).vitality?.hp).toBe(74);
  world.now++;
  game.tick(world,true);
  game.tick(world,true);
  expect(game.view(bob,world).vitality?.hp).toBe(74+recoveryPolicy.hpPerTick);
  world.policies = {};
  world.now += recoveryPolicy.tickMs;
  game.tick(world,true);
  expect(game.view(bob,world).vitality?.hp).toBe(74+recoveryPolicy.hpPerTick);
});

test('the catalog and gameserver agree on purchases with a full inventory',()=>{
  const {alice,game,balance,world,openShop} = setup();
  balance.set(alice.id,50);
  Object.assign(alice,npcs.snackVendor.interaction);
  openShop(alice,'snackVendor');
  const view = ()=>game.view(alice,world);
  const buy = (target:string)=>game.act(alice,{kind:'shop-buy',target,token:view().dialogue?.token},world);
  expect(buy('coxinha')).toBe('Compra guardada no inventário.');
  for (let slot=1;slot<INVENTORY_SLOTS;slot++) expect(buy('pizza')).toBe('Compra guardada no inventário.');
  const slotFor = (kind:'baton'|'coxinha'|'pizza'|'binoculars'|'xray'|'megaphone')=>{
    const snapshot = view();
    return marketPurchaseSlot(kind,snapshot.inventory,snapshot.equipped ?? [],snapshot.dialogue?.direct!==false);
  };
  expect(slotFor('coxinha')).toBe('inventory');
  expect(buy('coxinha')).toBe('Compra guardada no inventário.');
  expect(view().inventory.find(item=>item.kind==='coxinha')?.quantity).toBe(2);
  expect(slotFor('pizza')).toBeUndefined();
  expect(buy('pizza')).toBe('Inventário cheio.');

  Object.assign(alice,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  openShop(alice);
  const before = balance.get(alice.id);
  expect(view().dialogue?.direct).toBe(false);
  expect(slotFor('baton')).toBeUndefined();
  expect(buy('baton')).toBe('Inventário cheio.');
  expect(balance.get(alice.id)).toBe(before);

  game.act(alice,{kind:'open-shop',target:'vendor'},world);
  expect(view().dialogue?.direct).toBe(true);
  for (const item of ['baton','binoculars','xray'] as const) {
    expect(slotFor(item)).toBe('equipped');
    expect(buy(item)).toBe('Compra equipada.');
    expect(view().equipped?.some(entry=>entry.kind===item)).toBe(true);
  }
  expect(view().inventory).toHaveLength(INVENTORY_SLOTS);
  expect(slotFor('megaphone')).toBeUndefined();
  expect(buy('megaphone')).toBe('Inventário cheio.');
});
