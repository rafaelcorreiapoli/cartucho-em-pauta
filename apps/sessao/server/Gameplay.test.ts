import { expect, test } from 'bun:test';
import { Gameplay, type GameplayWorld } from './Gameplay';
import { terminals, type GameplayEvent } from '../src/gameplay';
import type { Player } from '../src/map';

function setup() {
  const player = (id:string,x:number,y:number):Player => ({id,nick:id,x,y,moving:false,direction:0,character:0});
  const alice = player('Alice',240,250), bob = player('Bob',250,250), watcher = player('Clara',228,240);
  const events:GameplayEvent[] = [];
  const game = new Gameplay();
  const world:GameplayWorld = {players:[alice,bob,watcher],now:0,voice:()=>true,office:()=>undefined,
    cashVisible:()=>[],earn:()=>{},publish:event=>events.push(event)};
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
  expect(game.view(alice,world).inventory[0].photo?.people.map(person=>person.id)).toEqual([alice.id,watcher.id]);
  game.tick(world,false);
  expect(game.callPeer(alice.id)).toBeUndefined();
  expect(game.view(bob,world).call).toBeUndefined();
});
