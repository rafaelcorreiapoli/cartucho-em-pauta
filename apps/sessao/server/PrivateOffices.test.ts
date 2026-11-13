import { expect, test } from 'bun:test';
import { Gameplay } from './Gameplay';
import type { GameplayWorld } from './gameplay-world';
import { decorPoint, decorSlots, eastAnnex, privateOffices, officeDoorPoint, officeRules, type OfficeLayout } from '../src/private-offices';
import { canStand, localPerception, wallBetween, type Player } from '../src/map';
import { MAX_PLAYERS } from '../src/plenary';
import { clearSegment, findRoute } from '../src/navigation';
import { applyInput, type ControlState } from '../src/movement';
import { npcs } from '../src/npcs';
import { INVENTORY_SLOTS, terminals, type GameplayAction, type GameplayEvent } from '../src/gameplay';

function atDoor(office:OfficeLayout,inside:boolean) {
  const {x,y} = officeDoorPoint(office);
  return {x,y:y+office.inside*(inside ? 15 : -15)};
}

function setup(count=2) {
  const players:Player[] = Array.from({length:count},(_,i)=>({id:String(i),nick:`Pessoa ${i}`,character:0,x:140,y:146,direction:0,moving:false}));
  const game = new Gameplay();
  const events:GameplayEvent[] = [];
  const credit = new Map<string,number>();
  const random = [0,0,.117,.172,0];
  const world:GameplayWorld = {players,now:0,voice:()=>true,office:()=>undefined,spend:()=>true,
    earn:(id,amount)=>credit.set(id,(credit.get(id) ?? 0)+amount),publish:event=>events.push(event)};
  game.reset(0,()=>random.shift() ?? .5,players,()=>0);
  function act(player:Player, kind:GameplayAction['kind'], place?:string, item?:number) {
    return game.act(player,{kind,place,item},world);
  }
  function tick(ms:number,exploring=true) { world.now += ms; game.tick(world,exploring); }
  function openShop(player:Player) {
    Object.assign(player,{x:npcs.vendor.x,y:npcs.vendor.y-11});
    game.act(player,{kind:'talk',target:'vendor'},world);
    game.act(player,{kind:'dialogue-choice',target:'products',token:game.view(player,world).dialogue?.token},world);
    return game.view(player,world).dialogue?.token;
  }
  function buy(player:Player, target:string) {
    expect(game.act(player,{kind:'shop-buy',target,token:openShop(player)},world)).toBe('Compra guardada no inventário.');
    return game.view(player,world).inventory.at(-1)!.id;
  }
  return {players,game,world,events,credit,act,tick,buy,openShop};
}

test('every seat has a unique reachable office, independent of office in Congress',()=>{
  const {players,game,world} = setup(MAX_PLAYERS);
  expect(new Set(players.map(player=>game.view(player,world).ownOffice)).size).toBe(MAX_PLAYERS);
  for (const office of privateOffices) {
    for (const point of [office.spawn,office.safe,office.cabinet,...decorSlots.map(slot=>decorPoint(office,slot)),atDoor(office,true),atDoor(office,false)]) {
      expect(canStand(point.x,point.y)).toBe(true);
      expect(findRoute({x:140,y:146},point).at(-1)).toEqual(point);
    }
  }
  for (const office of privateOffices) {
    expect(office.bounds.slice(2)).toEqual([129,87]);
    const player = {...players[0],...office.spawn};
    const control:ControlState = {player,route:[],ack:0};
    applyInput(control,{seq:1,destination:{x:140,y:146}});
    for (let seq=2;seq<=300 && control.route.length;seq++) applyInput(control,{seq});
    expect({x:player.x,y:player.y}).toEqual({x:140,y:146});
    expect(findRoute({x:140,y:146,barriers:[office.door]},office.spawn)).toEqual([]);
  }
  const [owner] = players;
  const id = game.view(owner,world).ownOffice;
  world.office = ()=> 'president';
  game.leave(owner,world,false);
  expect(game.view(owner,world).ownOffice).toBe(id);
},15_000);

test('the main corridor keeps its full opening through the east annex',()=>{
  for (const y of [132,143,154]) {
    const corridor = {x:930,y}, end = {x:eastAnnex.right-6,y};
    expect(clearSegment(corridor,end,canStand)).toBe(true);
    expect(wallBetween(corridor,end)).toBe(false);
  }
});

test('cash can only be converted once at the owners safe, with interruption and photo evidence',()=>{
  const {players:[owner,visitor],game,world,credit,events,act,tick} = setup();
  const [home,other] = privateOffices;
  tick(4000);
  const cash = game.view(owner,world).nearby[0];
  expect(act(owner,'use',undefined,cash.id)).toBe('O objeto não está com você.');
  act(owner,'collect',undefined,cash.id);
  expect(game.visibleItems(owner.id)[0]?.id).toBe(cash.id);
  expect(act(owner,'use',undefined,cash.id)).toContain('cofre');
  expect(act(owner,'deliver','treasury',cash.id)).toContain('Tesouraria');
  Object.assign(owner,other.safe);
  expect(act(owner,'office-cash',other.id,cash.id)).toContain('titular');
  Object.assign(owner,home.safe);
  act(owner,'office-cash',home.id,cash.id);
  tick(2000);
  owner.x--;
  tick(1);
  expect(credit.size).toBe(0);
  expect(game.view(owner,world).inventory[0]?.id).toBe(cash.id);
  Object.assign(owner,home.safe);
  Object.assign(visitor,{x:home.safe.x,y:home.safe.y+13});
  act(owner,'office-cash',home.id,cash.id);
  tick(1000);
  expect(game.view(owner,world).officeChannel).toMatchObject({kind:'office-cash',officeId:home.id,elapsed:1000});
  expect(act(owner,'office-cash',home.id,cash.id)).toBe('Você já está embolsando dinheiro.');
  expect(game.view(owner,world).officeOptions?.map(option=>option.kind)).toEqual(['office-cancel']);
  expect(act(owner,'office-cancel')).toBe('Interação cancelada.');
  expect(game.view(owner,world).officeChannel).toBeUndefined();
  expect(credit.size).toBe(0);
  act(owner,'office-cash',home.id,cash.id);
  tick(1000);
  expect(act(owner,'office-cash',home.id,cash.id)).toBe('Você já está embolsando dinheiro.');
  act(visitor,'photo');
  expect(game.photoView(visitor.id,world.now).album[0]?.photo.people.find(person=>person.id===owner.id)?.pocketing).toBe(true);
  tick(officeRules.cashMs-1001);
  expect(credit.size).toBe(0);
  tick(1);
  expect(credit.get(owner.id)).toBe(3);
  expect(game.view(owner,world).inventory).toEqual([]);
  expect(act(owner,'office-cash',home.id,cash.id)).toContain('com você');
  expect(events.filter(event=>event.type==='money-pocketed')).toHaveLength(1);
});

test('locked doors block routes and sight, permit exit, and require a separate cabinet breach',()=>{
  const {players:[owner,visitor],game,world,act,tick,buy} = setup();
  const [home] = privateOffices;
  const doorTool = buy(visitor,'proLockKit');
  const lowTool = buy(visitor,'lockKit');
  const strongTool = buy(visitor,'decoder');
  for (let level=2;level<=4;level++) {
    const upgrade = buy(owner,'cabinetLock');
    Object.assign(owner,home.cabinet);
    expect(act(owner,'office-upgrade-cabinet',home.id,upgrade)).toBe(`Segurança nível ${level}.`);
  }
  Object.assign(owner,terminals.secretary.point);
  act(owner,'supply','secretary');
  const document = game.view(owner,world).inventory[0];
  Object.assign(owner,home.cabinet);
  act(owner,'office-stash',home.id,document.id);
  Object.assign(owner,atDoor(home,true));
  Object.assign(visitor,atDoor(home,false));
  expect(act(owner,'office-lock',home.id)).toBe('Porta trancada.');
  expect(localPerception(visitor,owner)).toMatchObject({visible:false});
  expect(findRoute(visitor,atDoor(home,true)).at(-1)).not.toEqual(atDoor(home,true));
  const control = {player:visitor,route:[],ack:0};
  for (let seq=1;seq<=8;seq++) applyInput(control,{seq,motion:{x:0,y:home.inside}});
  expect(visitor.y).toBeGreaterThan(officeDoorPoint(home).y);
  Object.assign(visitor,atDoor(home,false));
  act(visitor,'office-breach-door',home.id,doorTool);
  tick(5000);
  expect(game.view(visitor,world).offices?.[0].door).toBe('breached');
  expect(findRoute(visitor,atDoor(home,true)).at(-1)).toEqual(atDoor(home,true));
  Object.assign(owner,{x:140,y:146});
  Object.assign(visitor,home.cabinet);
  expect(game.view(visitor,world).officeStash).toBeUndefined();
  expect(act(visitor,'office-breach-cabinet',home.id,lowTool)).toContain('insuficiente');
  act(visitor,'office-breach-cabinet',home.id,strongTool);
  tick(15_000);
  expect(game.view(visitor,world).officeStash?.items[0]?.id).toBe(document.id);
  expect(act(visitor,'office-take',home.id,document.id)).toContain('retirado');
  expect(act(visitor,'office-take',home.id,document.id)).toBe('Objeto indisponível.');
  expect(act(visitor,'office-stash',home.id,document.id)).toContain('guardado');
  tick(officeRules.breachMs);
  expect(game.view(visitor,world).officeStash).toBeUndefined();
  Object.assign(owner,home.cabinet);
  expect(game.view(owner,world).officeStash?.items[0]?.id).toBe(document.id);
  Object.assign(visitor,atDoor(home,true));
  expect(act(visitor,'office-open',home.id)).toBe('Você saiu do gabinete.');
  expect(visitor.y).toBeGreaterThan(officeDoorPoint(home).y);
  expect(game.view(visitor,world).offices?.[0].door).toBe('locked');
});

test('shop purchases furnish the correct office slots even when the inventory is full',()=>{
  const {players:[owner,visitor],game,world,events,buy,openShop} = setup();
  const [home,other] = privateOffices;
  for (let i=0;i<INVENTORY_SLOTS;i++) buy(owner,'lockpick');
  let charged = 0;
  world.spend = (_id,price)=>{ charged += price; return true; };
  const products = ['officeTv','officeRug','officeChair'] as const;
  for (const target of products) {
    const purchase = {kind:'shop-buy',target,token:openShop(owner)} as const;
    expect(game.act(owner,purchase,world)).toBe('Compra instalada no seu gabinete.');
    expect(game.act(owner,purchase,world)).toBe('Abra o catálogo do vendedor.');
    expect(game.act(owner,{...purchase,token:openShop(owner)},world)).toBe('Você já tem este móvel instalado.');
  }
  expect(charged).toBe(7);
  expect(game.view(owner,world).inventory.map(item=>item.kind)).toEqual(Array(INVENTORY_SLOTS).fill('lockpick'));
  expect(game.view(owner,world).officeFurnishings).toEqual([...products]);
  expect(game.view(visitor,world).officeFurnishings).toEqual([]);
  expect(events.filter(event=>event.type==='installed').map(({kind,place})=>[kind,place]))
    .toEqual(products.map(kind=>[kind,home.id]));
  Object.assign(visitor,other.spawn);
  expect(game.view(visitor,world).decorations).toEqual([]);
  for (const kind of products) {
    const point = decorPoint(home,kind);
    Object.assign(visitor,point);
    expect(game.view(visitor,world).decorations.find(item=>item.kind===kind)).toMatchObject({...point,privateOffice:home.id});
  }
});

test('decoration persists and a plenary call cancels breach without spending the tool',()=>{
  const {players:[owner,visitor],game,world,act,tick,buy,openShop,events} = setup();
  const [home] = privateOffices;
  game.act(owner,{kind:'shop-buy',target:'officeTv',token:openShop(owner)},world);
  const tv = events.find(event=>event.type==='installed')!.item!;
  const tool = buy(visitor,'lockpick');
  Object.assign(owner,decorPoint(home,'officeTv'));
  Object.assign(visitor,decorPoint(home,'officeTv'));
  expect(game.view(visitor,world).decorations.some(item=>item.id===tv)).toBe(true);
  expect(act(visitor,'office-remove',home.id,tv)).toContain('seu gabinete');
  Object.assign(visitor,home.cabinet);
  act(visitor,'office-breach-cabinet',home.id,tool);
  tick(15_000,false);
  expect(game.view(visitor,world).officeChannel).toBeUndefined();
  expect(game.view(visitor,world).inventory.some(item=>item.id===tool)).toBe(true);
  expect(game.view(visitor,world).officeStash).toBeUndefined();
  expect(game.view(owner,world).decorations.some(item=>item.id===tv)).toBe(true);
});

test('the safe protects an incapacitated owner and converts only the current wallet into physical cash',()=>{
  const {players:[owner,visitor],game,world,act,tick,buy} = setup();
  const [home] = privateOffices;
  const tool = buy(visitor,'lockpick');
  let balance = 20;
  world.lootWallet = (id,fraction)=>{
    if (id!==owner.id) return 0;
    const taken = balance*fraction;
    balance -= taken;
    return taken;
  };
  Object.assign(owner,home.spawn,{knockedOut:true});
  Object.assign(visitor,home.safe);
  expect(act(visitor,'office-breach-safe',home.id,tool)).toContain('titular');
  Object.assign(owner,{x:140,y:146,knockedOut:false});
  act(visitor,'office-breach-safe',home.id,tool);
  tick(1000);
  balance = 17;
  tick(officeRules.breachTimes[0]);
  expect(balance).toBe(0);
  const inventory = game.view(visitor,world).inventory;
  expect(inventory).toHaveLength(1);
  expect(inventory[0]).toMatchObject({kind:'briefcase',cash:17});
  expect(game.view(owner,world).ownOffice).toBe(home.id);
  expect(game.physicalCash()).toBeGreaterThanOrEqual(17);
});

test('the treasury redeems a physical briefcase exactly once',()=>{
  const {players:[owner],game,world,act,tick} = setup();
  let deposited = 0;
  world.deposit = (_id,amount)=>{ deposited += amount; return true; };
  tick(4000);
  const cash = game.view(owner,world).nearby[0];
  act(owner,'collect',undefined,cash.id);
  Object.assign(owner,terminals.treasury.point);
  expect(act(owner,'deliver','treasury',cash.id)).toContain('entregues');
  expect(act(owner,'deliver','treasury',cash.id)).toBe('Objeto indisponível.');
  expect(deposited).toBe(3);
  expect(game.physicalCash()).toBe(0);
});
