import {PlenaryMatch} from './PlenaryMatch';
import { expect, test } from 'bun:test';
import { Gameplay } from './Gameplay';
import { decorationInstallMs } from '../src/installations';
import type { GameplayWorld } from './gameplay-world';
import { decorPoint, decorSlots, privateOffices, officeDoorPoint, officeRules, type OfficeLayout } from '../src/private-offices';
import { canStand, localPerception, roomAt, wallBetween, type Player } from '../src/map';
import { MAX_PLAYERS } from '../src/plenary';
import { findRoute } from '../src/navigation';
import { applyInput, type ControlState } from '../src/movement';
import { npcs, treasurer } from '../src/npcs';
import { INVENTORY_SLOTS, terminals, type GameplayAction, type GameplayEvent } from '../src/gameplay';

function atDoor(office:OfficeLayout,inside:boolean) {
  return officeDoorPoint(office,inside ? 15 : -15);
}

function setup(count=2,officeRandom=()=>0) {
  const players:Player[] = Array.from({length:count},(_,i)=>({id:String(i),nick:`Pessoa ${i}`,character:0,x:140,y:146,direction:0,moving:false}));
  const game = new Gameplay();
  const events:GameplayEvent[] = [];
  const credit = new Map<string,number>();
  const random = [0,0,.117,.172,0];
  const world:GameplayWorld = {players,now:0,voice:()=>true,office:()=>undefined,spend:()=>true,
    earn:(id,amount)=>credit.set(id,(credit.get(id) ?? 0)+amount),publish:event=>events.push(event)};
  game.reset(0,()=>random.shift() ?? .5,players,officeRandom);
  function act(player:Player, kind:GameplayAction['kind'], place?:string, item?:number) {
    return game.act(player,{kind,place,item},world);
  }
  function tick(ms:number,exploring=true) { world.now += ms; game.tick(world,exploring); }
  function openShop(player:Player, furniture=false) {
    Object.assign(player,furniture ? npcs.furnitureVendor.interaction : {x:npcs.vendor.x,y:npcs.vendor.y-11});
    game.act(player,{kind:'talk',target:furniture ? 'furnitureVendor' : 'vendor'},world);
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

test('office 06 opens onto the Central de Expediente and the old annex is closed',()=>{
  const office = privateOffices[5];
  expect(roomAt(atDoor(office,false))).toBe('Central de Expediente');
  expect(roomAt(atDoor(office,true))).toBe('Gabinete 06');
  expect(wallBetween(atDoor(office,false),atDoor(office,true))).toBe(false);
  expect(wallBetween({x:930,y:143},{x:970,y:143})).toBe(true);
  expect(canStand(1024.5,85)).toBe(false);
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
  game.applyAttribute(owner,'agility');
  const fasterCashMs = officeRules.cashMs/1.25;
  act(owner,'office-cash',home.id,cash.id);
  tick(1000);
  expect(game.view(owner,world).officeChannel).toMatchObject({kind:'office-cash',officeId:home.id,elapsed:1000,duration:fasterCashMs});
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
  tick(fasterCashMs-1001);
  expect(credit.size).toBe(0);
  tick(1);
  expect(credit.get(owner.id)).toBe(3);
  expect(game.view(owner,world).inventory).toEqual([]);
  expect(act(owner,'office-cash',home.id,cash.id)).toContain('com você');
  expect(events.filter(event=>event.type==='money-pocketed')).toHaveLength(1);
});

test.each([0,5])('office %i locks, permits exit and requires a separate cabinet breach',index=>{
  const {players:[owner,visitor],game,world,events,act,tick,buy} = setup(2,()=>index/privateOffices.length);
  const home = privateOffices[index];
  const failed:{id:string;message:string}[] = [];
  world.actionFailed = (id,message)=>failed.push({id,message});
  Object.assign(owner,atDoor(home,true));
  act(owner,'office-lock',home.id);
  Object.assign(visitor,atDoor(home,false));
  const breach = game.view(visitor,world).officeOptions?.find(option=>option.kind==='office-breach-door');
  expect(breach).toMatchObject({place:home.id,label:'Arrombar porta'});
  game.act(visitor,breach!,world);
  expect(failed.pop()).toEqual({id:visitor.id,message:'Você precisa de uma ferramenta de arrombamento.'});
  act(owner,'office-unlock',home.id);
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
  for (let seq=1;seq<=8;seq++) applyInput(control,{seq,motion:home.inside});
  expect(roomAt(visitor)).not.toBe(home.name);
  Object.assign(visitor,atDoor(home,false));
  act(visitor,'office-breach-door',home.id,doorTool);
  visitor.y++;
  tick(1);
  expect(failed.pop()).toEqual({id:visitor.id,message:'Arrombamento interrompido. Fique parado durante a ação.'});
  expect(game.view(visitor,world).inventory.some(item=>item.id===doorTool)).toBe(true);
  Object.assign(visitor,atDoor(home,false));
  act(visitor,'office-breach-door',home.id,doorTool);
  tick(5000);
  expect(failed).toEqual([]);
  expect(game.view(visitor,world).offices?.[index].door).toBe('breached');
  expect(events.at(-1)).toMatchObject({type:'door-breached',actor:visitor.id,place:home.id});
  expect(findRoute(visitor,atDoor(home,true)).at(-1)).toEqual(atDoor(home,true));
  Object.assign(owner,{x:140,y:146});
  Object.assign(visitor,home.cabinet);
  expect(act(visitor,'selfie')).toBe('Foto guardada no álbum.');
  expect(events.at(-1)).toMatchObject({type:'photo',breachedByActor:true});
  expect(game.view(visitor,world).officeStash).toBeUndefined();
  expect(act(visitor,'office-breach-cabinet',home.id,lowTool)).toContain('insuficiente');
  act(visitor,'office-breach-cabinet',home.id,strongTool);
  tick(15_000);
  expect(game.view(visitor,world).officeStash?.items[0]?.id).toBe(document.id);
  expect(act(visitor,'office-take',home.id,document.id)).toContain('retirado');
  expect(events.filter(event=>event.type==='recovered').at(-1)).toMatchObject({item:document.id,breachedByActor:true});
  expect(act(visitor,'office-take',home.id,document.id)).toBe('Objeto indisponível.');
  expect(act(visitor,'office-stash',home.id,document.id)).toContain('guardado');
  tick(officeRules.breachMs);
  expect(game.view(visitor,world).officeStash).toBeUndefined();
  Object.assign(owner,home.cabinet);
  expect(game.view(owner,world).officeStash?.items[0]?.id).toBe(document.id);
  Object.assign(visitor,atDoor(home,true));
  expect(act(visitor,'office-open',home.id)).toBe('Você saiu do gabinete.');
  expect(visitor).toMatchObject(atDoor(home,false));
  expect(game.view(visitor,world).offices?.[index].door).toBe('locked');
});

test('shop purchases furnish the correct office slots even when the inventory is full',()=>{
  const {players:[owner,visitor],game,world,events,buy,openShop} = setup();
  const [home,other] = privateOffices;
  for (let i=0;i<INVENTORY_SLOTS;i++) buy(owner,'lockpick');
  let charged = 0;
  world.spend = (_id,price)=>{ charged += price; return true; };
  expect(game.act(owner,{kind:'shop-buy',target:'officeTv',token:openShop(owner)},world)).toBe('Este produto não é vendido aqui.');
  expect(findRoute(home.spawn,npcs.furnitureVendor.interaction).at(-1)).toEqual(npcs.furnitureVendor.interaction);
  expect(game.act(owner,{kind:'shop-buy',target:'lockpick',token:openShop(owner,true)},world)).toBe('Este produto não é vendido aqui.');
  const products = ['officeTv','officeRug','officeChair'] as const;
  for (const target of products) {
    const purchase = {kind:'shop-buy',target,token:openShop(owner,true)} as const;
    expect(game.act(owner,purchase,world)).toBe('Compra instalada no seu gabinete.');
    expect(game.act(owner,purchase,world)).toBe('Abra o catálogo do vendedor.');
    expect(game.act(owner,{...purchase,token:openShop(owner,true)},world)).toBe('Você já tem este móvel instalado.');
  }
  expect(charged).toBe(7);
  expect(game.view(owner,world).inventory.map(item=>item.kind)).toEqual(Array(INVENTORY_SLOTS).fill('lockpick'));
  expect(game.view(owner,world).officeFurnishings).toEqual([...products]);
  expect(game.view(visitor,world).officeFurnishings).toEqual([]);
  expect(events.filter(event=>event.type==='installed').map(({kind,place})=>[kind,place]))
    .toEqual(products.map(kind=>[kind,home.id]));
  Object.assign(visitor,other.spawn);
  expect(game.view(visitor,world).decorations.map(item=>item.kind)).toEqual([...products]);
  expect(game.view(visitor,world).interactive).toEqual([]);
  for (const kind of products) {
    const point = decorPoint(home,kind);
    Object.assign(visitor,point);
    expect(game.view(visitor,world).decorations.find(item=>item.kind===kind)).toMatchObject({...point,privateOffice:home.id});
  }
});

test('a visitor can tear down a portrait inside an office without collecting it',()=>{
  const {players:[owner,visitor],game,world,act,buy,tick,events} = setup();
  const [home] = privateOffices;
  const point = decorPoint(home,'portrait');
  Object.assign(owner,npcs.credentialsVendor.interaction);
  game.act(owner,{kind:'open-shop',target:'credentialsVendor'},world);
  const token = game.view(owner,world).dialogue?.token;
  expect(game.act(owner,{kind:'shop-buy',target:'portrait',token},world)).toBe('Compra guardada no inventário.');
  const [portrait] = game.view(owner,world).inventory;
  expect(game.view(owner,world).officeOptions?.some(option=>option.kind==='office-install')).toBe(false);
  Object.assign(owner,{x:point.x,y:point.y+15});
  const install = game.view(owner,world).officeOptions?.find(option=>option.kind==='office-install');
  expect(install).toEqual({kind:'office-install',label:'Pendurar retrato',item:portrait.id,place:home.id});
  expect(game.act(owner,install!,world)).toBe('Instalando decoração…');
  tick(decorationInstallMs);
  expect(events).toContainEqual(expect.objectContaining({type:'installed',kind:'portrait',actor:owner.id,place:home.id}));
  for (let i=0;i<INVENTORY_SLOTS;i++) buy(visitor,'lockpick');
  Object.assign(visitor,atDoor(home,false));
  expect(game.view(visitor,world).officeOptions?.some(option=>option.label==='Arrancar retrato')).toBe(false);
  expect(act(visitor,'office-remove',home.id,portrait.id)).toContain('gabinete');
  Object.assign(visitor,point);
  expect(game.view(visitor,world).officeOptions).toContainEqual({
    kind:'office-remove',label:'Arrancar retrato',item:portrait.id,place:home.id,
  });
  expect(act(visitor,'office-remove',home.id,portrait.id)).toBe('Retrato arrancado e destruído.');
  expect(game.view(visitor,world).inventory.map(item=>item.kind)).toEqual(Array(INVENTORY_SLOTS).fill('lockpick'));
  expect(game.view(owner,world).decorations.some(item=>item.id===portrait.id)).toBe(false);
});

test('decoration persists and a plenary call cancels breach without spending the tool',()=>{
  const {players:[owner,visitor],game,world,act,tick,buy,openShop,events} = setup();
  const [home] = privateOffices;
  game.act(owner,{kind:'shop-buy',target:'officeTv',token:openShop(owner,true)},world);
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

  act(visitor,'drop',undefined,inventory[0].id);
  const spareTool = buy(visitor,'lockpick');
  Object.assign(visitor,home.safe);
  const messages:string[] = [];
  world.actionFailed = (id,message)=>{ if (id===visitor.id) messages.push(message); };
  const emptySafe = game.view(visitor,world).officeOptions?.find(option=>option.kind==='office-breach-safe');
  expect(emptySafe).toMatchObject({place:home.id,item:spareTool,label:'Arrombar cofre · 15 s'});
  game.act(visitor,emptySafe!,world);
  expect(messages).toEqual([]);
  expect(game.view(visitor,world).inventory.some(item=>item.id===spareTool)).toBe(true);
  tick(officeRules.breachTimes[0]);
  expect(messages).toEqual(['O cofre está vazio.']);
  expect(game.view(visitor,world).inventory).toEqual([]);
  expect(balance).toBe(0);
});

test('the treasury redeems a physical briefcase exactly once',()=>{
  const {players:[owner],game,world,act,tick} = setup();
  let deposited = 0;
  world.deposit = (_id,amount)=>{ deposited += amount; return true; };
  tick(4000);
  const cash = game.view(owner,world).nearby[0];
  act(owner,'collect',undefined,cash.id);
  expect(act(owner,'deliver','treasury',cash.id)).toContain('Tesouraria');
  expect(deposited).toBe(0);
  Object.assign(owner,treasurer.interaction);
  expect(canStand(owner.x,owner.y)).toBe(true);
  expect(findRoute({x:140,y:146},treasurer.interaction).at(-1)).toEqual(treasurer.interaction);
  expect(game.view(owner,world).locations).toContain('treasury');
  expect(act(owner,'deliver','treasury',cash.id)).toContain('entregues');
  expect(act(owner,'deliver','treasury',cash.id)).toBe('Objeto indisponível.');
  expect(deposited).toBe(3);
  expect(game.physicalCash()).toBe(0);
});

test('stolen cash remains conserved through drop, pickup and a single treasury redemption',()=>{
  const {players:[owner,visitor],game,world,act,tick,buy} = setup();
  const match = new PlenaryMatch(1);
  match.start(owner.id,[owner,visitor],0,()=>.9);
  Object.assign(world,match.gameplayWorld([owner,visitor],0,()=>false));
  const home = privateOffices[0];
  const summary = () => match.economySummary(game.physicalCash());
  const tool = buy(visitor,'lockpick');
  expect(summary()).toMatchObject({humans:15,reserve:17,reserveFees:1,discrepancy:0});
  Object.assign(visitor,home.safe);
  act(visitor,'office-breach-safe',home.id,tool);
  tick(officeRules.breachTimes[0]);
  const stolen = game.view(visitor,world).inventory.find(item=>item.kind==='briefcase')!;
  expect(stolen.cash).toBe(8);
  expect(summary().discrepancy).toBe(0);
  Object.assign(visitor,{x:140,y:146});
  Object.assign(owner,{x:148,y:146});
  act(visitor,'drop',undefined,stolen.id);
  act(owner,'collect',undefined,stolen.id);
  expect(game.view(owner,world).inventory.find(item=>item.id===stolen.id)?.cash).toBe(8);
  expect(summary().discrepancy).toBe(0);
  Object.assign(owner,treasurer.interaction);
  expect(act(owner,'deliver','treasury',stolen.id)).toContain('entregues');
  const after = summary();
  expect(after).toMatchObject({treasury:8,budget:40,discrepancy:0});
  expect(act(owner,'deliver','treasury',stolen.id)).toBe('Objeto indisponível.');
  expect(summary()).toEqual(after);
});

test('a locked office remains a visit objective and only entry completes it',()=>{
  const {players:[owner,visitor],game,world,act,tick,buy} = setup();
  const match = new PlenaryMatch(1);
  match.start(owner.id,[owner,visitor],0,()=>.9);
  Object.assign(world,match.gameplayWorld([owner,visitor],0,()=>false));
  const economy = Reflect.get(match,'economy');
  const agenda = Reflect.get(economy,'accounts').get(visitor.id).agenda;
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['visitaAlvo','cafe','passeio']);
  const missionState = () => match.view(visitor.id,[owner.id,visitor.id],world.now).politics!.missions;
  const home = privateOffices[0];
  const tool = buy(visitor,'lockpick');
  Object.assign(owner,atDoor(home,true));
  expect(act(owner,'office-lock',home.id)).toBe('Porta trancada.');
  Object.assign(owner,{x:140,y:146});
  Object.assign(visitor,atDoor(home,false));
  match.refreshAgendaEligibility();
  expect(missionState().active.find(mission=>mission.kind==='visitaAlvo')?.person?.id).toBe(owner.id);
  tick(1);
  expect(act(visitor,'office-breach-door',home.id,tool)).toBeUndefined();
  tick(officeRules.breachTimes[0]);
  expect(missionState().completed.some(mission=>mission.kind==='visitaAlvo')).toBe(false);
  expect(findRoute(visitor,home.spawn).at(-1)).toEqual(home.spawn);
  Object.assign(visitor,home.spawn);
  tick(1);
  expect(missionState().completed.find(mission=>mission.kind==='visitaAlvo')?.person?.id).toBe(owner.id);
});

test('only the robber gets mission credit for hiding and pocketing cash from their safe breach',()=>{
  const {players:[,visitor,peer],game,world,events,act,tick,buy} = setup(3);
  const [home] = privateOffices;
  const tool = buy(visitor,'lockpick');
  const underwear = buy(visitor,'mensalUnderwear');
  const peerUnderwear = buy(peer,'mensalUnderwear');
  world.lootWallet = ()=>8;
  Object.assign(visitor,home.safe);
  act(visitor,'office-breach-safe',home.id,tool);
  tick(officeRules.breachTimes[0]);
  const cash = game.view(visitor,world).inventory.find(item=>item.kind==='briefcase')!;
  act(visitor,'drop',undefined,cash.id);
  Object.assign(peer,{x:visitor.x,y:visitor.y});
  act(peer,'collect',undefined,cash.id);
  expect(act(peer,'use',undefined,peerUnderwear)).toContain('Dinheiro oculto');
  expect(events.at(-1)).toMatchObject({actor:peer.id,type:'concealment-started',cashFromOwnBreach:false});

  act(peer,'drop',undefined,cash.id);
  expect(act(visitor,'collect',undefined,cash.id)).toBe('Objeto recolhido.');
  expect(act(visitor,'use',undefined,underwear)).toContain('Dinheiro oculto');
  expect(events.at(-1)).toMatchObject({actor:visitor.id,type:'concealment-started',cashFromOwnBreach:true});

  const ownOffice = privateOffices.find(office=>office.id===game.view(visitor,world).ownOffice)!;
  Object.assign(visitor,ownOffice.safe);
  act(visitor,'office-cash',ownOffice.id,cash.id);
  tick(officeRules.cashMs);
  expect(events.at(-1)).toMatchObject({actor:visitor.id,type:'money-pocketed',item:cash.id,cashFromOwnBreach:true});
});
