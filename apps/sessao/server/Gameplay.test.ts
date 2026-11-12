import { npcs } from '../src/npcs';
import { expect, test } from 'bun:test';
import { Gameplay } from './Gameplay';
import type { GameplayWorld } from './gameplay-world';
import { terminals, type GameplayEvent } from '../src/gameplay';
import type { Player } from '../src/map';

function setup() {
  const player = (id:string,x:number,y:number):Player => ({id,nick:id,x,y,moving:false,direction:0,character:0});
  const alice = player('Alice',240,250), bob = player('Bob',250,250), watcher = player('Clara',228,240);
  const events:GameplayEvent[] = [];
  const game = new Gameplay();
  const world:GameplayWorld = {players:[alice,bob,watcher],now:0,voice:()=>true,office:()=>undefined,
    earn:()=>{},publish:event=>events.push(event)};
  return {alice,bob,watcher,events,game,world};
}

test('custody moves exactly once and requests are private', () => {
  const {alice,bob,watcher,events,game,world} = setup();
  game.act(alice,{kind:'supply',place:'coffee'},world);
  const [coffee] = game.view(alice,world).inventory;
  game.act(alice,{kind:'offer',item:coffee.id,target:bob.id},world);
  expect(game.view(watcher,world).requests).toEqual([]);
  const [offer] = game.view(bob,world).requests;
  expect(game.act(watcher,{kind:'accept',item:offer.id},world)).toBe('Pedido indisponível.');
  game.act(bob,{kind:'accept',item:offer.id},world);
  game.act(bob,{kind:'accept',item:offer.id},world);
  expect(game.view(alice,world).inventory).toEqual([]);
  expect(game.view(bob,world).inventory).toEqual([coffee]);
  expect(events.filter(event=>event.type==='transferred')).toHaveLength(1);
  expect(events.at(-1)?.witnesses).toEqual([watcher.id]);
  game.act(bob,{kind:'drop',item:coffee.id},world);
  game.act(alice,{kind:'collect',item:coffee.id},world);
  game.act(watcher,{kind:'collect',item:coffee.id},world);
  expect(game.view(alice,world).inventory).toEqual([coffee]);
  expect(game.view(watcher,world).inventory).toEqual([]);
});

test('protocol checks requirements, signatures are unique and filing preserves the record', () => {
  const {alice,bob,game,world} = setup();
  Object.assign(alice,terminals.secretary.point);
  Object.assign(bob,{x:alice.x+12,y:alice.y});
  game.act(alice,{kind:'supply',place:'secretary'},world);
  const [doc] = game.view(alice,world).inventory;
  game.act(alice,{kind:'sign-request',item:doc.id,target:bob.id},world);
  const [request] = game.view(bob,world).requests;
  game.act(bob,{kind:'accept',item:request.id},world);
  game.act(bob,{kind:'accept',item:request.id},world);
  expect(doc.document?.signatures).toHaveLength(1);
  game.act(alice,{kind:'stamp',item:doc.id,place:'secretary'},world);
  Object.assign(alice,terminals.protocol.point);
  expect(game.act(alice,{kind:'file',item:doc.id,place:'protocol'},world)).toBe('Falta: Gabinete.');
  expect(game.view(alice,world).inventory).toHaveLength(1);
  Object.assign(alice,terminals.cabinet.point);
  game.act(alice,{kind:'stamp',item:doc.id,place:'cabinet'},world);
  Object.assign(alice,terminals.protocol.point);
  expect(game.act(alice,{kind:'file',item:doc.id,place:'protocol'},world)).toBe('Documento protocolado.');
  expect(game.view(alice,world).inventory).toEqual([]);
  expect(game.view(alice,world).filed).toEqual([doc]);
});

test('calls require consent and photos only list visible players', () => {
  const {alice,bob,watcher,game,world} = setup();
  Object.assign(bob,{x:900,y:220});
  game.act(alice,{kind:'call',target:bob.id},world);
  expect(game.callPeer(alice.id)).toBeUndefined();
  game.act(bob,{kind:'answer'},world);
  expect(game.callPeer(alice.id)).toBe(bob.id);
  expect(game.callPeer(watcher.id)).toBeUndefined();
  game.act(alice,{kind:'photo'},world);
  expect(game.photoView(alice.id,world.now).album[0].photo.people.map(person=>person.id)).toEqual([alice.id,watcher.id]);
  game.tick(world,false);
  expect(game.callPeer(alice.id)).toBeUndefined();
  expect(game.view(bob,world).call).toBeUndefined();
});

test('phone sessions keep Snake private and clear it when a player disconnects', () => {
  const {alice,bob,events,game,world} = setup();
  game.act(alice,{kind:'game-start'},world);
  game.act(alice,{kind:'game-start'},world);
  expect(game.phoneActivity(alice.id)).toBe('game');
  expect(game.view(alice,world).game?.status).toBe('ready');
  expect(game.view(bob,world).game).toBeUndefined();
  world.now = 1000;
  game.leave(alice,world,false);
  game.tick(world,true);
  expect(game.view(alice,world).game).toBeUndefined();
  expect(game.phoneActivity(alice.id)).toBeUndefined();
  expect(events.map(event=>event.type)).toEqual(['game-started','game-stopped']);
  expect(events.at(-1)?.duration).toBe(1000);
});

test('spawned and dropped cash share visibility, custody and redemption', () => {
  const {alice,bob,watcher,game,world} = setup();
  const values = [0,0,.14,.172,0];
  const credits:number[] = [];
  world.earn = (_id,amount) => credits.push(amount);
  Object.assign(alice,{x:140,y:146});
  Object.assign(bob,{x:151,y:146});
  Object.assign(watcher,{x:400,y:146});
  game.reset(1000,()=>values.shift() ?? .5);
  world.now = 4999;
  game.tick(world,true);
  expect(game.view(alice,world).ground).toEqual([]);

  world.now = 5000;
  game.tick(world,true);
  const [item] = game.view(alice,world).nearby;
  expect(item).toMatchObject({kind:'briefcase',x:151,y:146});
  expect(game.view(watcher,world).ground).toEqual([]);
  game.act(watcher,{kind:'use',item:item.id},world);
  expect(credits).toEqual([]);

  game.act(alice,{kind:'collect',item:item.id},world);
  expect(game.view(alice,world).inventory[0]?.id).toBe(item.id);
  expect(game.view(bob,world).ground).toEqual([]);
  game.act(alice,{kind:'drop',item:item.id},world);
  expect(game.view(bob,world).nearby[0]).toMatchObject({id:item.id,kind:item.kind,x:140,y:146});
  game.act(bob,{kind:'use',item:item.id},world);
  game.act(alice,{kind:'use',item:item.id},world);
  expect(credits).toEqual([3]);
  expect(game.view(bob,world).ground).toEqual([]);
});

test('cash on the ground expires after the same interval on spawn or drop', () => {
  const {alice,game,world} = setup();
  const values = [0,0,.14,.172,.99];
  Object.assign(alice,{x:140,y:146});
  game.reset(0,()=>values.shift() ?? .5);
  world.now = 4000;
  game.tick(world,true);
  const [item] = game.view(alice,world).nearby;
  expect(item.kind).toBe('bundle');
  world.now = 59000;
  expect(game.act(alice,{kind:'collect',item:item.id},world)).toBe('Objeto indisponível.');
  expect(game.view(alice,world).ground).toEqual([]);

  const nextValues = [0,0,.14,.172,.99];
  game.reset(0,()=>nextValues.shift() ?? .5);
  world.now = 4000;
  game.tick(world,true);
  const [next] = game.view(alice,world).nearby;
  game.act(alice,{kind:'collect',item:next.id},world);
  world.now = 10000;
  game.act(alice,{kind:'drop',item:next.id},world);
  world.now = 64999;
  expect(game.view(alice,world).nearby[0]?.id).toBe(next.id);
  world.now = 65000;
  expect(game.act(alice,{kind:'use',item:next.id},world)).toBe('Objeto indisponível.');
  expect(game.view(alice,world).ground).toEqual([]);
});

test('the camera freezes visible exposed objects and preserves permissions through show, copy and publish', () => {
  const {alice,bob,watcher,events,game,world} = setup();
  const values = [0,0,.14,.172,0];
  Object.assign(alice,{x:140,y:146});
  Object.assign(bob,{x:151,y:146});
  Object.assign(watcher,{x:155,y:113});
  game.reset(0,()=>values.shift() ?? .5);
  world.now = 4000;
  game.tick(world,true);
  const [briefcase] = game.view(bob,world).nearby;
  game.act(bob,{kind:'collect',item:briefcase.id},world);
  expect(game.visibleItem(bob.id)).toBeUndefined();
  expect(game.act(alice,{kind:'expose',item:briefcase.id},world)).toBe('O objeto não está com você.');
  game.act(bob,{kind:'expose',item:briefcase.id},world);
  game.act(alice,{kind:'selfie'},world);
  game.act(alice,{kind:'selfie'},world);
  const [entry] = game.photoView(alice.id,world.now).album;
  const {photo} = entry;
  expect(game.photoView(alice.id,world.now).album).toHaveLength(1);
  expect(photo.people.map(person=>person.id)).toEqual([alice.id,bob.id]);
  expect(photo.people[1].exposed).toEqual({id:briefcase.id,kind:'briefcase'});
  game.act(bob,{kind:'drop',item:briefcase.id},world);
  expect(game.visibleItem(bob.id)).toBeUndefined();
  expect(photo.people[1].exposed?.kind).toBe('briefcase');
  expect(game.photoView(bob.id,world.now).album).toEqual([]);
  expect(game.photoView(watcher.id,world.now).publicPhotos).toEqual([]);
  expect(game.act(watcher,{kind:'info-copy',item:photo.id,target:bob.id},world)).toBe('Foto indisponível.');

  game.act(alice,{kind:'info-show',item:photo.id,target:bob.id},world);
  const show = game.photoView(bob.id,world.now).request!;
  expect(game.photoView(watcher.id,world.now).request).toBeUndefined();
  expect(game.act(watcher,{kind:'info-accept',item:show.id},world)).toBe('Pedido indisponível.');
  game.act(bob,{kind:'info-accept',item:show.id},world);
  expect(game.photoView(bob.id,world.now).shown?.id).toBe(photo.id);
  expect(game.photoView(bob.id,world.now).album).toEqual([]);
  game.act(bob,{kind:'info-close'},world);
  expect(game.photoView(bob.id,world.now).shown).toBeUndefined();

  game.act(alice,{kind:'info-copy',item:photo.id,target:bob.id},world);
  const copy = game.photoView(bob.id,world.now).request!;
  game.act(bob,{kind:'info-accept',item:copy.id},world);
  game.act(bob,{kind:'info-accept',item:copy.id},world);
  expect(game.photoView(bob.id,world.now).album).toEqual([{photo,access:'copy'}]);
  game.act(alice,{kind:'photo-delete',item:photo.id},world);
  expect(game.photoView(alice.id,world.now).album).toEqual([]);
  game.leave(bob,world,false);
  expect(game.photoView(bob.id,world.now).album[0].photo.author.id).toBe(alice.id);
  expect(game.act(bob,{kind:'photo-publish',item:photo.id},world)).toBe('Divulgue pela Sala de Imprensa.');
  Object.assign(bob,{x:863,y:245});
  game.act(bob,{kind:'photo-publish',item:photo.id},world);
  game.act(bob,{kind:'photo-publish',item:photo.id},world);
  expect(game.photoView(watcher.id,world.now).publicPhotos).toEqual([photo]);
  expect(events.filter(event=>event.type==='photo-shared' || event.type==='photo-published')).toHaveLength(2);
});

test('installations validate location, keep one occupant and serve each diner once', () => {
  const {alice,bob,watcher,events,game,world} = setup();
  const purchases:number[] = [];
  world.spend = (_id,amount)=>{ purchases.push(amount); return true; };
  expect(game.act(alice,{kind:'buy',target:'pizza'},world)).toBe('Aproxime-se do balcão.');
  const coffeeRoom = {x:alice.x,y:alice.y};
  Object.assign(alice,npcs.snackVendor.interaction);
  game.act(alice,{kind:'talk',target:'snackVendor'},world);
  game.act(alice,{kind:'dialogue-choice',target:'products',token:game.view(alice,world).dialogue?.token},world);
  const purchase = {kind:'shop-buy',target:'pizza',token:game.view(alice,world).dialogue?.token} as const;
  game.act(alice,purchase,world);
  game.act(alice,purchase,world);
  expect(purchases).toEqual([2]);
  Object.assign(alice,coffeeRoom);
  const [pizza] = game.view(alice,world).inventory;
  expect(game.act(alice,{kind:'install',place:'hall',item:pizza.id},world)).toBe('Aproxime-se do local.');
  game.act(alice,{kind:'install',place:'pizza',item:pizza.id},world);
  game.act(bob,{kind:'slice',item:pizza.id},world);
  game.act(bob,{kind:'slice',item:pizza.id},world);
  expect(game.view(bob,world).interactive[0].slices).toBe(5);
  expect(events.filter(event=>event.type==='slice')).toHaveLength(1);

  Object.assign(alice,terminals.credentials.point);
  Object.assign(bob,terminals.credentials.point);
  game.act(alice,{kind:'buy',target:'portrait'},world);
  game.act(bob,{kind:'buy',target:'portrait'},world);
  const [first] = game.view(alice,world).inventory;
  const [second] = game.view(bob,world).inventory;
  Object.assign(alice,{x:465,y:414});
  Object.assign(bob,alice,{id:'Bob',nick:'Bob'});
  game.act(alice,{kind:'install',place:'hall',item:first.id},world);
  expect(game.view(watcher,world).decorations.map(item=>item.kind)).toEqual(['pizza']);
  game.act(bob,{kind:'mark',item:first.id},world);
  expect(game.view(alice,world).decorations[0].marked).toBe(true);
  game.act(bob,{kind:'install',place:'hall',item:second.id},world);
  expect(game.view(alice,world).interactive.map(item=>item.owner.id)).toEqual([bob.id]);
  expect(game.act(alice,{kind:'uninstall',item:first.id},world)).toBe('Aproxime-se do local.');
  game.act(alice,{kind:'uninstall',item:second.id},world);
  expect(game.view(alice,world).inventory[0].id).toBe(second.id);
  expect(game.view(alice,world).interactive).toEqual([]);
});
