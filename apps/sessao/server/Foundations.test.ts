import { expect, test } from 'bun:test';
import { Combat } from './Combat';
import { Gameplay } from './Gameplay';
import type { GameplayWorld } from './gameplay-world';
import type { GameplayEvent } from '../src/gameplay';
import { canStand, movementSpeed, worldVisible, VISION_RADIUS, type Player } from '../src/map';
import { infirmary } from '../src/medical';
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
  expect(alice.swing).toEqual({weapon:'baton',startedAt:world.now,angle:0});
  world.now += 320;
  game.tick(world,true);
  expect(alice.swing).toBeUndefined();
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


function knockOut(match:ReturnType<typeof setup>) {
  const {alice,bob,game,world,openShop} = match;
  game.act(alice,{kind:'shop-buy',target:'baton',token:openShop(alice)},world);
  game.act(alice,{kind:'equip',item:game.view(alice,world).inventory[0].id},world);
  for (const now of [100,1400,2700,4000]) {
    world.now = now;
    game.act(alice,{kind:'attack',target:bob.id},world);
  }
}

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
  expect(bob).toMatchObject({x:alice.x,y:alice.y,carried:true});
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
      if (reason==='recovery') world.now = 12_000;
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
  Object.assign(alice,{x:infirmary.x,y:infirmary.y});
  game.tick(world,true);
  balance.set(alice.id,0);
  expect(game.act(alice,{kind:'treat'},world)).toBe('Saldo insuficiente para o atendimento.');
  expect(game.view(bob,world).vitality?.hp).toBe(0);
  expect(bob.carried).toBe(true);

  balance.set(alice.id,2);
  expect(game.act(alice,{kind:'treat'},world)).toBe('Atendimento concluído.');
  expect(game.view(bob,world).vitality?.hp).toBe(80);
  expect(bob.carried).toBeUndefined();
  expect(game.act(alice,{kind:'treat'},world)).toBe('Atendimento indisponível.');
  expect(balance.get(alice.id)).toBe(1);
  expect(game.act(bob,{kind:'treat'},world)).toBe('Atendimento concluído.');
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
  Object.assign(alice, {x:631,y:197});
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

test('modulator recharge follows the item when another player collects and equips it', () => {
  const {alice,bob,game,world,openShop} = setup();
  game.act(alice,{kind:'shop-buy',target:'voiceModulator',token:openShop(alice)},world);
  const {id} = game.view(alice,world).inventory[0];
  game.act(alice,{kind:'equip',item:id},world);
  game.act(alice,{kind:'toggle-modulator'},world);
  game.act(alice,{kind:'unequip',item:id},world);
  game.act(alice,{kind:'drop',item:id},world);
  game.act(bob,{kind:'collect',item:id},world);
  game.act(bob,{kind:'equip',item:id},world);
  expect(game.act(bob,{kind:'toggle-modulator'},world)).toBe('Modulador recarregando.');
  world.now += 45_000;
  expect(game.act(bob,{kind:'toggle-modulator'},world)).toBe('Modulador ligado.');
});

test('doors, furniture and actors without a player session use the shared world rules', () => {
  const alice = player('Alice',480,520);
  const passage = {player:alice,route:[],ack:0};
  applyInput(passage,{seq:1,door:1});
  expect(alice.y).toBeGreaterThan(520);
  const closed = {player:player('Bia',480,554),route:[],ack:0,plenary:true};
  applyInput(closed,{seq:1,door:1,plenary:true});
  expect(closed.player.y).toBe(554);
  expect(worldVisible({x:625,y:201},{x:625,y:249},VISION_RADIUS+2)).toBe(false);
  expect(worldVisible({x:550,y:195},{x:550,y:282},VISION_RADIUS+2)).toBe(false);
  expect(worldVisible({x:500,y:140},{x:587,y:140})).toBe(false);
  expect(worldVisible({x:500,y:140},{x:587,y:140},VISION_RADIUS+2)).toBe(true);
  const npc = {id:'npc:treino',character:0,x:151,y:146};
  const combat = new Combat();
  expect(combat.attack(player('Treino',140,146),npc,false,100).damage).toBe(26);
  expect(combat.view(npc,100).hp).toBe(94);
});
