import { xray } from '../src/equipment';
import { money } from '../src/politics';
import { contextActionKeys } from '../src/ui/context-action-keys';
import { xrayRechargeAction } from '../src/ui/xray-recharge-action';
import { Parliamentarians } from './Parliamentarians';
import { weapons } from '../src/weapons';
import { privateOffices } from '../src/private-offices';

import { npcs } from '../src/npcs';
import { expect, test } from 'bun:test';
import { Gameplay } from './Gameplay';
import type { GameplayWorld } from './gameplay-world';
import { INVENTORY_SLOTS, readGameplayAction, terminals, type GameplayEvent } from '../src/gameplay';
import { canStand, HEIGHT, rooms, WIDTH, type Player } from '../src/map';
import { photoMissions } from './photo-missions';
import { findRoute } from '../src/navigation';
import { installationBounds, overlaps } from '../src/map-props';
import { decorationActions, decorationInstallMs, installationSites } from '../src/installations';

function buyCredentialGood(game:Gameplay,player:Player,kind:'portrait'|'vip',world:GameplayWorld) {
  game.act(player,{kind:'open-shop',target:'credentialsVendor'},world);
  return game.act(player,{kind:'shop-buy',target:kind,token:game.view(player,world).dialogue?.token},world);
}

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

function submitAtProtocol(game:Gameplay,player:Player,item:number,world:GameplayWorld) {
  game.act(player,{kind:'talk',target:'protocol'},world);
  const dialogue = game.view(player,world).dialogue;
  return game.act(player,{kind:'dialogue-choice',target:`file-${item}`,token:dialogue?.token},world);
}

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
  expect(readGameplayAction({kind:'file',item:doc.id,place:'protocol'})).toBeUndefined();
  expect(game.act(alice,{kind:'dialogue-choice',target:`file-${doc.id}`,token:1},world)).toBe('Esta conversa já mudou.');
  expect(submitAtProtocol(game,alice,doc.id,world)).toBe('Falta: Gabinete.');
  expect(game.view(alice,world).dialogue?.feedback).toBe('Falta: Gabinete.');
  expect(game.view(alice,world).inventory).toHaveLength(1);
  Object.assign(alice,terminals.cabinet.point);
  game.act(alice,{kind:'stamp',item:doc.id,place:'cabinet'},world);
  Object.assign(alice,terminals.protocol.point);
  expect(submitAtProtocol(game,alice,doc.id,world)).toBe('Documento protocolado.');
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

test('spawned and dropped cash share visibility and custody without immediate redemption', () => {
  const {alice,bob,watcher,game,world} = setup();
  const values = [0,0,.117,.172,0];
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
  expect(credits).toEqual([]);
  expect(game.view(bob,world).ground[0]?.id).toBe(item.id);
});

test('cash skips reachable floor where the sprite would overlap a map prop', () => {
  const {alice,game,world} = setup();
  const blocked = [
    {x:520,y:46}, // Desk and chair in the Archive.
    {x:211,y:199}, // Plant in the Cafezinho.
    {x:600,y:240}, // Reserved chair, including when empty.
    {x:280,y:301}, // Portrait mount, including when empty.
  ];
  const clear = {x:151,y:146};
  const entrance = {x:140,y:146};
  for (const point of blocked) {
    expect(canStand(point.x-8,point.y+6) && canStand(point.x+8,point.y+6)).toBe(true);
    expect(findRoute(entrance,point).at(-1)).toEqual(point);
  }
  const values = [0,0,...[...blocked,clear].flatMap(({x,y})=>[
    (x-24+.5)/(WIDTH-48),(y-24+.5)/(HEIGHT-48),
  ])];
  game.reset(0,()=>values.shift() ?? .5);
  Object.assign(alice,entrance);
  world.now = 4000;
  game.tick(world,true);
  expect(game.view(alice,world).ground).toEqual([expect.objectContaining({...clear,kind:'briefcase'})]);
  expect(values).toEqual([]);
});

test('cash on the ground expires after the same interval on spawn or drop', () => {
  const {alice,game,world} = setup();
  const flows:string[] = [];
  world.cashFlow = (kind,amount)=>flows.push(kind+":"+amount);
  const values = [0,0,.117,.172,.99];
  Object.assign(alice,{x:140,y:146});
  game.reset(0,()=>values.shift() ?? .5);
  world.now = 4000;
  game.tick(world,true);
  const [item] = game.view(alice,world).nearby;
  expect(item.kind).toBe('briefcase');
  world.now = 59000;
  expect(game.act(alice,{kind:'collect',item:item.id},world)).toBe('Objeto indisponível.');
  expect(game.view(alice,world).ground).toEqual([]);

  game.tick(world,false);
  game.tick(world,false);
  expect(flows).toEqual(['spawned:3','expired:3']);

  const nextValues = [0,0,.117,.172,.99];
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
  game.tick(world,false);
  expect(flows).toEqual(['spawned:3','expired:3','spawned:3','expired:3']);
});

test('the camera freezes visible exposed objects and preserves permissions through show, copy and publish', () => {
  const {alice,bob,watcher,events,game,world} = setup();
  const values = [0,0,.117,.172,0];
  Object.assign(alice,{x:140,y:146});
  Object.assign(bob,{x:151,y:146});
  Object.assign(watcher,{x:155,y:113});
  game.reset(0,()=>values.shift() ?? .5);
  world.now = 4000;
  game.tick(world,true);
  const [briefcase] = game.view(bob,world).nearby;
  game.act(bob,{kind:'collect',item:briefcase.id},world);
  expect(game.visibleItems(bob.id)[0]?.id).toBe(briefcase.id);
  expect(game.act(alice,{kind:'expose',item:briefcase.id},world)).toBe('O objeto não está com você.');
  Object.assign(bob,terminals.secretary.point);
  game.act(bob,{kind:'supply',place:'secretary',target:'queue'},world);
  const document = game.view(bob,world).inventory.find(item=>item.kind==='document')!;
  Object.assign(bob,{x:151,y:146});
  expect(game.act(bob,{kind:'expose',item:document.id},world)).toBe('Objeto exposto.');
  expect(game.visibleItems(bob.id).map(item=>item.id)).toEqual([briefcase.id,document.id]);
  game.act(alice,{kind:'selfie'},world);
  game.act(alice,{kind:'selfie'},world);
  const [entry] = game.photoView(alice.id,world.now).album;
  const {photo} = entry;
  expect(game.photoView(alice.id,world.now).album).toHaveLength(1);
  expect(photo.people.map(person=>person.id)).toEqual([alice.id,bob.id]);
  expect(photo.people[1].exposed).toEqual([{id:briefcase.id,kind:'briefcase'},{id:document.id,kind:'document'}]);
  expect(game.act(bob,{kind:'conceal',item:document.id},world)).toBe('Objeto guardado.');
  expect(game.visibleItems(bob.id).map(item=>item.id)).toEqual([briefcase.id]);
  game.act(bob,{kind:'drop',item:briefcase.id},world);
  expect(game.visibleItems(bob.id)).toEqual([]);
  expect(photo.people[1].exposed?.[0]?.kind).toBe('briefcase');
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
  expect(game.act(alice,{kind:'open-shop',target:'credentialsVendor'},world)).toBe('Aproxime-se para conversar.');
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
  expect(game.view(alice,world).installable).toContain('pizza');
  game.act(alice,{kind:'install',place:'pizza',item:pizza.id},world);
  expect(game.view(bob,world).installable).not.toContain('pizza');
  game.act(bob,{kind:'slice',item:pizza.id},world);
  game.act(bob,{kind:'slice',item:pizza.id},world);
  expect(game.view(bob,world).interactive[0].slices).toBe(5);
  expect(events.filter(event=>event.type==='slice')).toHaveLength(1);

  Object.assign(alice,npcs.credentialsVendor.interaction);
  Object.assign(bob,npcs.credentialsVendor.interaction);
  buyCredentialGood(game,alice,'portrait',world);
  buyCredentialGood(game,bob,'portrait',world);
  const [first] = game.view(alice,world).inventory;
  const [second] = game.view(bob,world).inventory;
  Object.assign(alice,installationSites.hall.point);
  Object.assign(bob,alice,{id:'Bob',nick:'Bob'});
  game.act(alice,{kind:'install',place:'hall',item:first.id},world);
  world.now += decorationInstallMs;
  game.tick(world,true);
  expect(game.view(watcher,world).decorations.map(item=>item.kind)).toEqual(['pizza']);
  game.act(bob,{kind:'mark',item:first.id},world);
  expect(game.view(alice,world).decorations[0].marked).toBe(true);
  game.act(bob,{kind:'install',place:'hall',item:second.id},world);
  world.now += decorationInstallMs;
  game.tick(world,true);
  expect(game.view(alice,world).interactive.map(item=>item.owner.id)).toEqual([bob.id]);
  expect(game.act(alice,{kind:'uninstall',item:first.id},world)).toBe('Aproxime-se do local.');
  expect(game.act(alice,{kind:'uninstall',item:second.id},world)).toBe('Retrato arrancado e destruído.');
  expect(game.view(alice,world).inventory).toEqual([]);
  expect(game.view(bob,world).inventory).toEqual([]);
  expect(game.view(alice,world).interactive).toEqual([]);
});

test('public portrait and VIP sites are reachable and show the installer to other players', () => {
  const {alice,bob,game,world,events} = setup();
  world.spend = ()=>true;
  alice.character = 4;
  game.applyAttribute(alice,'agility');
  const duration = decorationInstallMs/1.25;
  for (const [place,site] of Object.entries(installationSites)) {
    if (site.kind==='pizza') continue;
    Object.assign(alice,npcs.credentialsVendor.interaction);
    expect(buyCredentialGood(game,alice,site.kind,world)).toBe('Compra guardada no inventário.');
    const [item] = game.view(alice,world).inventory;
    expect(game.act(alice,{kind:'install',place,item:item.id},world)).toBe('Aproxime-se do local.');
    const approach = {x:site.point.x,y:site.point.y+(place==='libraryPortrait' ? 30 : 10)};
    expect(canStand(approach.x,approach.y)).toBe(true);
    expect(findRoute({x:140,y:146},approach).at(-1)).toEqual(approach);
    if (site.kind==='portrait') {
      const {name,bounds:[x,y,width]} = rooms.find(room=>room.name===site.label)!;
      const titleWidth = name.length*8+10;
      expect(overlaps(installationBounds(site.point,site.kind),[x+(width-titleWidth)/2,y+4,titleWidth,14])).toBe(false);
    }
    Object.assign(alice,approach);
    Object.assign(bob,approach);
    const [install] = decorationActions(alice.id,game.view(alice,world));
    expect(install.action).toEqual({kind:'install',place,item:item.id});
    expect(game.act(alice,install.action,world)).toBe('Instalando decoração…');
    expect(game.view(alice,world).installationProgress).toEqual({elapsed:0,duration});
    alice.x++;
    game.tick(world,true);
    expect(game.view(alice,world).installationProgress).toBeUndefined();
    expect(game.view(alice,world).inventory).toContainEqual(item);
    Object.assign(alice,approach);
    expect(game.act(alice,install.action,world)).toBe('Instalando decoração…');
    world.now += duration-1;
    game.tick(world,true);
    expect(game.view(bob,world).decorations).toEqual([]);
    world.now++;
    game.tick(world,true);
    if (site.kind==='vip') expect(photoMissions.reserva.facts(events.at(-1)!)).toHaveLength(1);
    expect(game.view(bob,world).decorations).toContainEqual(expect.objectContaining({
      ...site.point, id:item.id,kind:site.kind,character:4,owner:{id:alice.id,name:alice.nick},
    }));
    const remove = decorationActions(bob.id,game.view(bob,world)).find(option=>option.action.kind==='uninstall')!;
    expect(remove.action).toEqual({kind:'uninstall',item:item.id});
    if (site.kind==='portrait') {
      expect(remove.label).toBe('Arrancar retrato');
      expect(game.act(bob,remove.action,world)).toBe('Retrato arrancado e destruído.');
      expect(game.view(bob,world).inventory).toEqual([]);
    } else {
      expect(game.act(bob,remove.action,world)).toBe('Objeto retirado.');
      game.act(bob,{kind:'drop',item:item.id},world);
    }
    expect(decorationActions(alice.id,game.view(alice,world))).toEqual([]);
  }
});

test('occupied installation sites expose only the actions the server accepts',()=>{
  const {alice,bob,game,world} = setup();
  world.spend = ()=>true;
  const place = 'technicalVip';
  const {point} = installationSites[place];
  const buy = (player:Player)=>{
    Object.assign(player,npcs.credentialsVendor.interaction);
    expect(buyCredentialGood(game,player,'vip',world)).toBe('Compra guardada no inventário.');
    const item = game.view(player,world).inventory.find(({kind})=>kind==='vip')!;
    Object.assign(player,point);
    return {kind:'install',place,item:item.id} as const;
  };

  const first = buy(alice);
  expect(game.act(alice,first,world)).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  const spare = buy(alice);
  const own = game.view(alice,world);
  expect(own.installable).not.toContain(place);
  expect(decorationActions(alice.id,own)).toEqual([{label:'Retirar placa VIP',action:{kind:'uninstall',item:first.item}}]);
  expect(game.act(alice,spare,world)).toBe('Você já ocupou este lugar.');
  expect(game.view(alice,world).inventory).toContainEqual(expect.objectContaining({id:spare.item}));

  const rival = buy(bob);
  const rivalView = game.view(bob,world);
  expect(rivalView.installable).toContain(place);
  expect(decorationActions(bob.id,rivalView)).toContainEqual({label:'Substituir placa VIP',action:rival});
  expect(game.act(bob,rival,world)).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  expect(game.view(alice,world).installable).toContain(place);
});

test('surveillance shops, races, discoveries, reconnection, audio and photo evidence stay private', () => {
  const {alice,bob,watcher,events,game,world} = setup();
  const feedback = new Map<string,string>();
  world.feedback = (id,message)=>{ feedback.set(id,message); };
  world.spend = ()=>true;
  const buy = (player:Player,kind:'wiretap'|'spyCamera'|'bugDetector')=>{
    Object.assign(player,{x:npcs.vendor.x,y:npcs.vendor.y+11});
    game.act(player,{kind:'talk',target:'vendor'},world);
    game.act(player,{kind:'dialogue-choice',target:'products',token:game.view(player,world).dialogue?.token},world);
    game.act(player,{kind:'shop-buy',target:kind,token:game.view(player,world).dialogue?.token},world);
    return game.view(player,world).inventory.find(item=>item.kind===kind)!;
  };
  const camera = buy(alice,'spyCamera');
  const wiretap = buy(bob,'wiretap');
  const detector = buy(watcher,'bugDetector');
  Object.assign(alice,{x:240,y:250});
  Object.assign(bob,{x:254,y:249});
  Object.assign(watcher,{x:254,y:252});
  game.spyAction(alice,{kind:'install',site:'coffee',item:camera.id},world);
  game.spyAction(bob,{kind:'install',site:'coffee',item:wiretap.id},world);
  world.now = 4999;
  game.tick(world,true);
  expect(game.spyView(alice,world).channels).toEqual([]);
  world.now = 5000;
  game.tick(world,true);
  const channel = game.spyView(alice,world).channels[0];
  expect(game.hasKnownForeignSpy(alice.id)).toBe(false);
  expect(game.hasKnownForeignSpy(watcher.id)).toBe(false);
  expect(channel.kind).toBe('spyCamera');
  expect(game.spyView(bob,world).channels).toEqual([]);
  expect(feedback.get(bob.id)).toBe('Não foi possível instalar o dispositivo.');
  expect(game.view(bob,world).inventory).toContainEqual(wiretap);
  expect(game.view(alice,world).inventory).toEqual([]);
  game.spyAction(bob,{kind:'open',channel:channel.id},world);
  expect(game.spyFrame(bob,world)).toBeUndefined();
  game.spyAction(alice,{kind:'open',channel:channel.id},world);
  Object.assign(alice,{x:900,y:230});
  Object.assign(bob,{x:245,y:252});
  expect(game.spyFrame(alice,world)?.people.map(person=>person.id)).toContain(bob.id);
  expect(game.spyFrame(alice,world)?.people.map(person=>person.id)).not.toContain(alice.id);
  expect(events.some(event=>event.type==='spy-viewed')).toBe(false);
  game.confirmSpyFrame(alice,world);
  game.confirmSpyFrame(alice,world);
  Object.assign(watcher,{x:230,y:246,moving:true});
  expect(game.spyFrame(alice,world)?.people).toContainEqual(expect.objectContaining({id:watcher.id,moving:true}));
  Object.assign(watcher,{x:254,y:252,moving:false});
  alice.barriers = [[241,248,12,2]];
  expect(game.spyFrame(alice,world)?.people.map(person=>person.id)).not.toContain(bob.id);
  alice.barriers = undefined;
  game.spyAction(alice,{kind:'capture'},world);
  expect(game.photoView(alice.id,world.now).album[0]?.photo.source).toEqual({kind:'surveillance',channel:channel.name});
  expect(game.photoView(bob.id,world.now).album).toEqual([]);
  game.leave(alice,world,false);
  expect(game.spyFrame(alice,world)).toBeUndefined();
  expect(game.spyView(alice,world).channels[0].id).toBe(channel.id);
  game.spyAction(alice,{kind:'open',channel:channel.id},world);
  game.spyAction(watcher,{kind:'inspect',site:'coffee',item:detector.id},world);
  world.now += 3000;
  game.tick(world,true);
  expect(feedback.get(watcher.id)).toBe('Câmera escondida encontrada.');
  expect(game.hasKnownForeignSpy(watcher.id)).toBe(true);
  expect(game.hasKnownForeignSpy(bob.id)).toBe(false);
  expect(events).toContainEqual(expect.objectContaining({type:'spy-discovered',actor:watcher.id,item:channel.id,witnesses:[]}));
  game.spyAction(watcher,{kind:'keep',site:'coffee'},world);
  expect(game.hasKnownForeignSpy(watcher.id)).toBe(false);
  game.leave(watcher,world,false);
  game.spyAction(watcher,{kind:'inspect',site:'coffee',item:detector.id},world);
  world.now += 3000;
  game.tick(world,true);
  expect(game.hasKnownForeignSpy(watcher.id)).toBe(true);
  expect(events.filter(event=>event.type==='spy-discovered' && event.actor===watcher.id)).toHaveLength(1);
  expect(game.spyView(watcher,world).channels).toEqual([]);
  expect(game.spyFrame(alice,world)).toBeDefined();
  game.confirmSpyFrame(alice,world);
  Object.assign(alice,{x:240,y:250});
  const freeSlots = INVENTORY_SLOTS-game.view(alice,world).inventory.length;
  const filler = Array.from({length:freeSlots},()=>Reflect.get(game,'create').call(game,'briefcase',{holder:alice.id}));
  const options = ()=>game.spyView(alice,world).options;
  expect(options()).not.toContainEqual(expect.objectContaining({kind:'remove',site:'coffee'}));
  expect(options()).toContainEqual(expect.objectContaining({kind:'recover',site:'coffee',blocked:'Inventário cheio'}));
  expect(game.spyAction(alice,{kind:'recover',site:'coffee'},world)).toBe('Inventário cheio.');
  expect(game.spyView(alice,world).progress).toBeUndefined();
  game.spyAction(alice,{kind:'remove',site:'coffee'},world);
  expect(game.spyView(alice,world).progress).toBeUndefined();
  game.act(alice,{kind:'drop',item:filler[0].id},world);
  expect(options().find(option=>option.kind==='recover' && option.site==='coffee')?.blocked).toBeUndefined();
  game.spyAction(alice,{kind:'recover',site:'coffee'},world);
  world.now += 3000;
  game.tick(world,true);
  const recovered = game.view(alice,world).inventory.find(item=>item.kind==='spyCamera')!;
  expect(recovered.id).not.toBe(camera.id);
  game.spyAction(alice,{kind:'install',site:'coffee',item:recovered.id},world);
  world.now += 5000;
  game.tick(world,true);
  const replacement = game.spyView(alice,world).channels.find(entry=>!entry.removed)!;
  expect(replacement.id).not.toBe(channel.id);
  game.spyAction(alice,{kind:'open',channel:replacement.id},world);
  expect(game.spyFrame(alice,world)).toBeDefined();
  game.confirmSpyFrame(alice,world);
  const cameraViews = events.filter(event=>event.type==='spy-viewed' && event.actor===alice.id);
  expect(cameraViews).toHaveLength(3);
  expect(cameraViews.map(event=>event.item)).toEqual([camera.id,camera.id,camera.id]);
  game.spyAction(watcher,{kind:'inspect',site:'coffee',item:detector.id},world);
  world.now += 3000;
  game.tick(world,true);
  expect(game.hasKnownForeignSpy(watcher.id)).toBe(true);
  expect(events.filter(event=>event.type==='spy-discovered' && event.actor===watcher.id)).toHaveLength(1);
  game.spyAction(watcher,{kind:'remove',site:'coffee'},world);
  world.now += 3000;
  game.tick(world,true);
  expect(game.spyFrame(alice,world)).toBeUndefined();
  expect(game.spyView(alice,world).channels[0].removed).toBe(true);
  expect(game.hasKnownForeignSpy(watcher.id)).toBe(false);
  expect(events).toContainEqual(expect.objectContaining({type:'spy-removed',actor:watcher.id,item:replacement.id,witnesses:[]}));
  expect(game.view(watcher,world).inventory).toContainEqual(detector);
  game.spyAction(bob,{kind:'install',site:'coffee',item:wiretap.id},world);
  world.now += 5000;
  game.tick(world,true);
  const audio = game.spyView(bob,world).channels[0];
  game.spyAction(watcher,{kind:'inspect',site:'coffee',item:detector.id},world);
  world.now += 3000;
  game.tick(world,true);
  expect(events.filter(event=>event.type==='spy-discovered' && event.actor===watcher.id).map(event=>event.item))
    .toEqual([channel.id,audio.id]);
  game.spySound(watcher.id,world.now);
  world.now += 250;
  game.tick(world,true);
  expect(game.spyView(bob,world).channels[0].active).toBe(true);
  expect(game.spyVolume(bob,watcher)).toBe(0);
  Object.assign(bob,{x:900,y:230});
  game.spyAction(bob,{kind:'open',channel:audio.id},world);
  expect(game.spyVolume(bob,watcher)).toBeGreaterThan(0);
  game.spyAction(bob,{kind:'mute',channel:audio.id},world);
  expect(game.spyVolume(bob,watcher)).toBe(0);
  const replacementCamera = buy(bob,'spyCamera');
  Object.assign(bob,{x:527,y:350});
  game.spyAction(bob,{kind:'install',site:'library',item:replacementCamera.id},world);
  world.now += 5000;
  game.tick(world,true);
  const cameraChannel = game.spyView(bob,world).channels.find(entry=>entry.kind==='spyCamera')!;
  expect(cameraChannel).toBeDefined();
  game.spyAction(bob,{kind:'open',channel:cameraChannel.id},world);
  expect(game.spyView(bob,world)).toMatchObject({selected:cameraChannel.id,muted:false});
  expect(game.spyView(bob,world).audio).toBeUndefined();
  expect(game.spyVolume(bob,watcher)).toBe(0);
  game.spyAction(bob,{kind:'open',channel:audio.id},world);
  expect(game.spyView(bob,world).selected).toBeUndefined();
  expect(game.spyFrame(bob,world)).toBeUndefined();
  expect(game.spyVolume(bob,watcher)).toBeGreaterThan(0);
  expect(events.filter(event=>event.type.startsWith('spy-')).every(event=>event.witnesses.length===0)).toBe(true);
});

function buyTechnical(game:Gameplay,player:Player,world:GameplayWorld,kind:'mensalUnderwear'|'xray') {
  Object.assign(player,npcs.vendor);
  game.act(player,{kind:'talk',target:'vendor'},world);
  game.act(player,{kind:'dialogue-choice',target:'products',token:game.view(player,world).dialogue?.token},world);
  game.act(player,{kind:'shop-buy',target:kind,token:game.view(player,world).dialogue?.token},world);
  return game.view(player,world).inventory.find(item=>item.kind===kind)!;
}

test('concealment filters cash from observers and photos through reconnect and cash swaps',()=>{
  const {alice,bob,game,world,events} = setup();
  world.spend = ()=>true;
  game.reset(0,()=>.5);
  const underwear = buyTechnical(game,alice,world,'mensalUnderwear');
  Object.assign(alice,terminals.secretary.point);
  game.act(alice,{kind:'supply',place:'secretary',target:'queue'},world);
  const document = game.view(alice,world).inventory.find(item=>item.kind==='document')!;
  game.act(alice,{kind:'expose',item:document.id},world);
  const npc = {...bob,id:'npc',npc:true as const};
  world.takeWallet = ()=>12;
  game.robNpc(alice,npc,world);
  const cash = game.view(alice,world).inventory.find(item=>item.kind==='briefcase')!;
  expect(game.visibleItems(alice.id,world.now)).toContainEqual({id:cash.id,kind:'briefcase'});
  expect(game.hasVisibleCash(alice.id,world.now,bob.id)).toBe(true);
  game.act(alice,{kind:'use',item:underwear.id},world);
  expect(game.hasVisibleCash(alice.id,world.now,bob.id)).toBe(false);
  expect(game.hasVisibleCash(alice.id,world.now,alice.id)).toBe(true);
  expect(game.act(alice,{kind:'use',item:underwear.id},world)).toBe('Objeto indisponível.');
  expect(game.visibleItems(alice.id,world.now)).toEqual([{id:document.id,kind:'document'}]);
  expect(game.visibleItems(alice.id,world.now,alice.id)).toHaveLength(2);
  expect(game.physicalCash()).toBe(12);
  game.act(alice,{kind:'drop',item:cash.id},world);
  expect(game.view(alice,world).ground.some(item=>item.id===cash.id)).toBe(true);
  expect(game.hasVisibleCash(alice.id,world.now,alice.id)).toBe(false);
  game.robNpc(alice,npc,world);
  expect(game.visibleItems(alice.id,world.now)).toHaveLength(1);
  Object.assign(alice,{x:240,y:250});
  Object.assign(bob,{x:250,y:250});
  game.act(bob,{kind:'photo'},world);
  expect(game.photoView(bob.id,world.now).album[0]?.photo.people.find(person=>person.id===alice.id)?.exposed)
    .toEqual([{id:document.id,kind:'document'}]);
  world.now = 40_000;
  game.leave(alice,world,false);
  expect(game.view(alice,world).concealmentSeconds).toBe(5);
  world.now = 45_000;
  game.tick(world,false);
  expect(game.view(alice,world).concealmentSeconds).toBeUndefined();
  expect(game.hasVisibleCash(alice.id,world.now,bob.id)).toBe(true);
  expect(game.visibleItems(alice.id,world.now)).toHaveLength(2);
  expect(events.filter(event=>event.type.startsWith('concealment')).map(event=>event.witnesses)).toEqual([[],[]]);
});

test('concealed transport samples only movement with cash during the active effect',()=>{
  const {alice,bob,game,world,events} = setup();
  world.spend = ()=>true;
  world.hasMission = (id,kind)=>id===alice.id && kind==='nadaADeclarar';
  game.reset(0,()=>.5);
  const underwear = buyTechnical(game,alice,world,'mensalUnderwear');
  world.takeWallet = ()=>12;
  game.robNpc(alice,{...bob,id:'npc',npc:true},world);
  const cash = game.view(alice,world).inventory.find(item=>item.kind==='briefcase')!;
  const samples = ()=>events.filter(event=>event.type==='concealed-cash-time');
  const sample = (now:number,move:boolean)=>{
    world.now = now;
    if (move) alice.x++;
    game.tick(world,true);
  };
  sample(100,true);
  game.act(alice,{kind:'use',item:underwear.id},world);
  sample(200,true);
  sample(300,false);
  expect(samples()).toEqual([]);
  sample(400,true);
  expect(samples()).toEqual([expect.objectContaining({duration:100,witnesses:[]})]);
  game.act(alice,{kind:'drop',item:cash.id},world);
  sample(500,true);
  sample(46_000,true);
  expect(samples()).toHaveLength(1);
});

test('Raio X spends one charge per window, follows visible targets and preserves snapshots',()=>{
  const {alice,bob,watcher,game,world,events} = setup();
  game.reset(0,()=>.5,world.players,()=>0);
  const npc:Player = {...watcher,npc:true,x:250,y:250};
  world.players[2] = npc;
  let balance = 12;
  world.wallet = ()=>balance;
  let spent = 0;
  world.spend = (_id,amount)=>{ spent += amount; return true; };
  const scanner = buyTechnical(game,alice,world,'xray');
  world.hasMission = (id,kind)=>id===alice.id && (kind==='fiscalizacaoParalela' || kind==='patrimonioSuspeito');
  const revealed = ()=>events.filter(event=>event.type==='xray-target-revealed');
  const activate = () => game.act(alice,{kind:'scan-xray'},world);
  const vision = () => game.view(alice,world).xrayVision;
  const recharge = (wallet?:number) => xrayRechargeAction(game.view(alice,world),wallet);
  expect(activate()).toBe('Equipe o Raio X.');
  game.act(alice,{kind:'equip',item:scanner.id},world);
  expect(activate()).toBe('Raio X ativado.');
  expect(scanner.charges).toBe(2);
  expect(vision()?.targets).toEqual([]);
  game.tick(world,true);
  expect(revealed()).toEqual([]);
  Object.assign(alice,{x:240,y:250,barriers:[[244,241,2,16]]});
  expect(vision()?.targets.some(target=>target.id===npc.id)).toBe(false);
  alice.barriers = undefined;
  expect(vision()?.targets).toContainEqual(expect.objectContaining({id:npc.id,balance:12}));
  expect(revealed()).toEqual([]);
  game.tick(world,true);
  game.tick(world,true);
  expect(revealed()).toEqual([expect.objectContaining({target:npc.id,place:'npc',witnesses:[]})]);
  npc.x++;
  expect(vision()?.targets).toContainEqual(expect.objectContaining({id:npc.id,x:251}));
  const office = privateOffices.find(office=>office.id===game.view(bob,world).ownOffice)!;
  Object.assign(alice,office.safe);
  balance = 30;
  expect(vision()?.targets).toContainEqual(expect.objectContaining({id:office.id,balance:30}));
  game.tick(world,true);
  expect(revealed()).toContainEqual(expect.objectContaining({target:office.id,place:'safe',witnesses:[]}));
  balance = 20;
  expect(vision()?.targets).toContainEqual(expect.objectContaining({id:office.id,balance:30}));
  expect(game.view(bob,world).xrayVision).toBeUndefined();
  const ownOffice = privateOffices.find(office=>office.id===game.view(alice,world).ownOffice)!;
  Object.assign(alice,ownOffice.safe);
  game.tick(world,true);
  expect(vision()?.targets.some(target=>target.id===ownOffice.id)).toBe(false);
  expect(revealed().some(event=>event.target===ownOffice.id)).toBe(false);
  Object.assign(alice,office.safe);
  world.now = 10_000;
  game.tick(world,true);
  expect(vision()).toBeUndefined();
  expect(activate()).toBe('Raio X ativado.');
  expect(vision()?.targets).toContainEqual(expect.objectContaining({id:office.id,balance:20}));
  expect(activate()).toBe('Raio X desativado.');
  expect(vision()).toBeUndefined();
  expect(activate()).toBe('Raio X ativado.');
  expect(activate()).toBe('Raio X desativado.');
  expect(activate()).toContain('sem cargas');
  expect(recharge(xray.rechargePrice)).toBeUndefined();
  expect(game.act(alice,{kind:'recharge-xray'},world)).toContain('Apoio Técnico');
  Object.assign(alice,npcs.vendor);
  const noFunds = recharge(0)!;
  expect(noFunds).toEqual({label:'Recarregar Raio X · '+money(xray.rechargePrice),disabled:true});
  expect(contextActionKeys([{kind:'action',visible:true,enabled:!noFunds.disabled}],false,false).buttons[0].key).toBeUndefined();
  const spend = world.spend;
  world.spend = ()=>false;
  expect(game.act(alice,{kind:'recharge-xray'},world)).toBe('Saldo insuficiente.');
  expect(scanner.charges).toBe(0);
  world.spend = spend;
  expect(recharge(xray.rechargePrice)?.disabled).toBe(false);
  expect(game.act(alice,{kind:'recharge-xray'},world)).toContain('3/3');
  expect(recharge(xray.rechargePrice)).toBeUndefined();
  expect(game.act(alice,{kind:'recharge-xray'},world)).toBe('Raio X já está carregado.');
  expect(spent).toBe(6);
  expect(events.filter(event=>event.type==='xray-scanned' || event.type==='xray-recharged').map(event=>event.witnesses)).toEqual([[],[],[],[]]);
});

test('an NPC raises its quote only after witnessing a weapon hit',()=>{
  const {alice,bob,game,world,events} = setup();
  Object.assign(alice,{x:npcs.vendor.x,y:npcs.vendor.y+11,direction:1});
  Object.assign(bob,{x:alice.x+9,y:alice.y});
  const parliamentarians = new Parliamentarians();
  parliamentarians.reset(2,world.now);
  const [witness,unaware] = parliamentarians.players;
  Object.assign(witness,{x:alice.x-14,y:alice.y});
  Object.assign(unaware,{x:720,y:240});
  world.players = [alice,bob,witness,unaware];
  world.publish = event=>{
    events.push(event);
    parliamentarians.witnessAggression(event);
  };
  const quote = (npc:Player) => parliamentarians.signature(npc.id,alice.id);
  const before = parliamentarians.players.map(quote);
  world.spend = ()=>true;
  game.act(alice,{kind:'talk',target:'vendor'},world);
  game.act(alice,{kind:'dialogue-choice',target:'products',token:game.view(alice,world).dialogue?.token},world);
  game.act(alice,{kind:'shop-buy',target:'baton',token:game.view(alice,world).dialogue?.token},world);
  const weapon = game.view(alice,world).inventory.find(item=>item.kind==='baton')!;
  game.act(alice,{kind:'equip',item:weapon.id},world);
  const strike = (at:number) => {
    world.now = at;
    game.act(alice,{kind:'attack'},world);
    world.now += weapons.baton.impactMs;
    game.tick(world,true);
    return events.filter(event=>event.type==='hit').at(-1);
  };
  world.vision = id=>id===witness.id ? 10 : 100;
  expect(strike(100)?.witnesses).toEqual([]);
  expect(parliamentarians.players.map(quote)).toEqual(before);
  world.vision = ()=>100;
  expect(strike(2000)?.witnesses).toEqual([witness.id]);
  expect(quote(witness)).toBeGreaterThan(before[0]);
  expect(quote(unaware)).toBe(before[1]);
  Object.assign(witness,{x:720,y:240});
  expect(strike(4000)).toMatchObject({at:4000+weapons.baton.impactMs,witnesses:[]});
});

test.each([0,1,2])('projects require %i other player signatures and no stamps',required=>{
  const {alice,bob,watcher,game,world} = setup();
  const npc:Player = {...bob,id:'npc',npc:true};
  const signers = [bob,watcher].slice(0,required);
  world.players = [alice,...signers,npc];
  Object.assign(alice,terminals.secretary.point);
  game.act(alice,{kind:'supply',place:'secretary',target:'project-0'},world);
  const [doc] = game.view(alice,world).inventory;
  expect(doc.document).toMatchObject({requiredSignatures:required,requiredStamps:[]});
  expect(game.signWithNpc(alice,npc,doc.id,0,world)).toBe('Documento indisponível.');
  expect(game.act(alice,{kind:'stamp',place:'secretary',item:doc.id},world)).toBe('Projetos não exigem carimbos.');
  Object.assign(alice,terminals.protocol.point);
  const file = () => submitAtProtocol(game,alice,doc.id,world);
  for (const [index,signer] of signers.entries()) {
    expect(file()).toBe(required-index===1 ? 'Falta: 1 assinatura.' : 'Falta: 2 assinaturas.');
    Object.assign(signer,{x:alice.x+8,y:alice.y});
    game.act(alice,{kind:'sign-request',item:doc.id,target:signer.id},world);
    const [request] = game.view(signer,world).requests;
    expect(game.act(signer,{kind:'accept',item:request.id},world)).toBe('Documento assinado.');
  }
  world.projectFilingError = ()=>'Já há um projeto em pauta.';
  expect(file()).toBe('Já há um projeto em pauta.');
  expect(game.view(alice,world).inventory.map(item=>item.id)).toEqual([doc.id]);
  expect(game.view(alice,world).filed).toEqual([]);
  world.projectFilingError = ()=>undefined;
  expect(file()).toBe('Documento protocolado.');
  expect(game.view(alice,world).filed.map(item=>item.id)).toEqual([doc.id]);
});
