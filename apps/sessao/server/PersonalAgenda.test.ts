import { stationRecharge } from '../src/station-recharge';
import { decorationInstallMs, installationSites } from '../src/installations';
import { expect, test } from 'bun:test';
import { Gameplay } from './Gameplay';
import { PersonalAgenda } from './PersonalAgenda';
import { Parliamentarians } from './Parliamentarians';
import { PoliticalEconomy } from './PoliticalEconomy';
import type { GameplayWorld } from './gameplay-world';
import { terminals, type GameplayEvent } from '../src/gameplay';
import { rooms, type Player } from '../src/map';
import { decorPoint, officeGoods, privateOffices } from '../src/private-offices';
import { npcs } from '../src/npcs';
import { agendaDurationMs, urgentCallMission, LATE_CAMPAIGN_WINDOW_MS } from '../src/politics';

const metrics = {wallet:8,popularity:40};

function buyCredentialGood(game:Gameplay,player:Player,kind:'portrait'|'vip',world:GameplayWorld) {
  game.act(player,{kind:'open-shop',target:'credentialsVendor'},world);
  return game.act(player,{kind:'shop-buy',target:kind,token:game.view(player,world).dialogue?.token},world);
}

function recordAgendaEvent(agenda:PersonalAgenda,event:GameplayEvent) {
  if (agenda.acceptGameplayEvent(event)) agenda.applyGameplayEvent(metrics,event,false);
}

function event(type:GameplayEvent['type'], extra:Partial<GameplayEvent> = {}):GameplayEvent {
  return {type,actor:'a',at:1,position:{x:0,y:0},witnesses:[],...extra};
}

test('two different signers must sign the same document after assignment',()=>{
  const economy = new PoliticalEconomy();
  const players:Player[] = ['a','b','c'].map((id,index)=>({
    ...terminals.secretary.point,x:terminals.secretary.point.x+index*8,
    id,nick:id,moving:false,direction:0,character:index,
  }));
  const [owner,b,c] = players;
  economy.reset(players.map(({id,nick:name})=>({id,name})),()=>0);
  const ownerAgenda = Reflect.get(economy,'accounts').get(owner.id).agenda;
  Reflect.set(ownerAgenda,'missions',[]);
  Reflect.set(ownerAgenda,'missionDeck',['assinaturas','cafe','passeio','selfieSolo']);
  economy.updateAgendaEligibility(new Set(players.map(player=>player.id)),3);
  const view = (id:string) => economy.view(id,[],0,false,()=>true)!;
  expect(view(owner.id).missions.active.some(mission=>mission.kind==='assinaturas')).toBe(true);

  const game = new Gameplay();
  const world:GameplayWorld = {players,now:0,voice:()=>true,office:()=>undefined,
    earn:()=>{},publish:entry=>economy.recordGameplay(entry)};
  game.act(owner,{kind:'supply',place:'secretary',target:'queue'},world);
  const [document] = game.view(owner,world).inventory;
  const sign = (signer:Player) => {
    game.act(owner,{kind:'sign-request',target:signer.id,item:document.id},world);
    const [request] = game.view(signer,world).requests;
    game.act(signer,{kind:'accept',item:request.id},world);
    game.act(signer,{kind:'accept',item:request.id},world);
  };
  sign(b);
  economy.recordGameplay(event('signed',{actor:c.id,target:owner.id,item:document.id+100}));
  expect(view(owner.id).missions.active.find(mission=>mission.kind==='assinaturas')?.current).toBe(1);
  economy.updateAgendaEligibility(new Set([owner.id,c.id]),3);
  expect(view(owner.id).missions.active.find(mission=>mission.kind==='assinaturas')?.current).toBe(1);
  sign(c);
  expect(view(owner.id)).toMatchObject({wallet:10,missions:{completed:[{kind:'assinaturas'}]}});
  expect(view(owner.id).missions.active).toHaveLength(3);
  expect(view(b.id).missions.completed).toEqual([]);
});

test('a real pizza purchase and consumption produce different agenda results',()=>{
  const economy = new PoliticalEconomy();
  const player:Player = {...npcs.snackVendor.interaction,id:'a',nick:'A',direction:0,moving:false,character:0};
  const game = new Gameplay();
  economy.reset([{id:'a',name:'A'}],()=>0);
  const view = () => economy.view('a',[],0,false,()=>true)!;
  const world:GameplayWorld = {players:[player],now:1,voice:()=>true,office:()=>undefined,
    earn:()=>{},spend:(id,price)=>economy.spend(id,price),publish:entry=>economy.recordGameplay(entry)};
  game.act(player,{kind:'talk',target:'snackVendor'},world);
  game.act(player,{kind:'dialogue-choice',target:'products',token:game.view(player,world).dialogue?.token},world);
  game.act(player,{kind:'shop-buy',target:'pizza',token:game.view(player,world).dialogue?.token},world);
  expect(view().missions.completed).toEqual([]);
  const [pizza] = game.view(player,world).inventory;
  game.act(player,{kind:'use',item:pizza.id},world);
  expect(view()).toMatchObject({wallet:6,walletIncome:0,progression:{xp:20},missions:{completed:[{kind:'pizza'}]}});
  expect(view().missions.active).toHaveLength(3);
});

test('hidden play counts only witnessed-free gameplay time and duplicate samples do not count',()=>{
  const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
  // Advance the real deck without mutating active objectives directly.
  agenda.progress(metrics,{cafe:1,protocolo:1,pizza:1});
  while (!agenda.hasActive('jogarOculto')) {
    const active = agenda.view(metrics).active;
    if (active.some(mission=>mission.id>60)) throw new Error('Hidden play did not become eligible');
    agenda.progress(metrics,Object.fromEntries(active.map(mission=>[mission.kind,mission.target])));
  }
  const hidden = () => agenda.view(metrics).active.find(mission=>mission.kind==='jogarOculto');
  recordAgendaEvent(agenda,event('game-played',{at:2,duration:100,witnesses:['b']}));
  expect(hidden()?.current).toBe(0);
  const duration = agendaDurationMs.jogarOculto;
  expect(hidden()?.target).toBe(duration);
  for (let i=0;i<duration/100;i++) {
    const sample = event('game-played',{at:3+i*100,duration:100});
    recordAgendaEvent(agenda,sample);
    recordAgendaEvent(agenda,sample);
    if (i===duration/100-2) expect(hidden()?.current).toBe(duration-100);
  }
  expect(agenda.view(metrics).completed.at(-1)?.kind).toBe('jogarOculto');
  expect(agenda.view(metrics).active).toHaveLength(3);
  expect(hidden()).toBeUndefined();
});

test('the phone only emits play time after input and uses observer visibility through walls',()=>{
  const player:Player = {id:'a',nick:'A',x:130,y:60,direction:0,moving:false,character:0};
  const observer:Player = {...player,id:'b',x:158};
  const samples:GameplayEvent[] = [];
  const world:GameplayWorld = {players:[player,observer],now:0,voice:()=>true,office:()=>undefined,
    earn:()=>{},hasMission:()=>true,publish:entry=>{if (entry.type==='game-played') samples.push(entry);}};
  const game = new Gameplay();
  game.act(player,{kind:'phone-open'},world);
  game.act(player,{kind:'game-start'},world);
  world.now = 100;
  game.tick(world,true);
  expect(samples).toEqual([]);
  game.act(player,{kind:'game-turn',direction:'right'},world);
  world.now = 150;
  game.tick(world,true);
  expect(samples.at(-1)).toMatchObject({duration:50,witnesses:[]});
  observer.x = 108;
  world.now = 200;
  game.tick(world,true);
  expect(samples.at(-1)).toMatchObject({duration:50,witnesses:['b']});
});

test.each(['documentoAlvo','pizzaAlvo','dinheiroAlvo','visitaAlvo','visitaCortesia','selfieAlvo'] as const)(
  '%s completes only after the corresponding gameplay with the assigned person',
  kind=>{
    const economy = new PoliticalEconomy();
    const players:Player[] = ['a','b','c'].map((id,character)=>({
      id,nick:character===0 ? 'Autora' : 'Mesmo nome',character,x:140,y:146,direction:0,moving:false,
    }));
    const [owner,target,other] = players;
    economy.reset(players.map(({id,nick:name,character})=>({id,name,character})),()=>0);
    const game = new Gameplay();
    game.reset(0,()=>.5,players,()=>.5);
    economy.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,undefined,undefined,id=>game.hasOffice(id));
    const agenda = Reflect.get(economy,'accounts').get(owner.id).agenda as PersonalAgenda;
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',[kind,'cafe','passeio']);
    economy.updateAgendaEligibility(new Set(players.map(player=>player.id)),3);
    const missions = () => economy.view(owner.id,[],0,false,()=>true)!.missions;
    expect(missions().active.find(mission=>mission.kind===kind)?.person?.id).toBe(target.id);

    const world:GameplayWorld = {players,now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
      hasMission:(id,kind)=>economy.hasMission(id,kind),spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
    const interact = (recipient:Player) => {
      const third = recipient===target ? other : target;
      Object.assign(third,{x:800,y:490});
      world.now += 3_000;
      if (kind==='dinheiroAlvo') {
        expect(economy.transfer(owner.id,recipient.id,2,true,0)).toBe(true);
        expect(missions().completed.some(mission=>mission.kind===kind)).toBe(false);
        expect(economy.transfer(owner.id,recipient.id,1,true,0)).toBe(true);
        return;
      }
      if (kind==='visitaAlvo' || kind==='visitaCortesia') {
        Object.assign(owner,{x:140,y:146});
        game.tick(world,true);
        Object.assign(owner,game.officeSpawn(recipient.id));
        game.tick(world,true);
        if (kind==='visitaCortesia') {
          expect(missions().completed.some(mission=>mission.kind===kind)).toBe(false);
          expect(game.act(owner,{kind:'office-take',place:'invalid'},world)).toBe('Gabinete indisponível.');
          expect(missions().completed.some(mission=>mission.kind===kind)).toBe(false);
          expect(game.act(owner,{kind:'photo'},world)).toBe('Foto guardada no álbum.');
        }
        return;
      }
      if (kind==='selfieAlvo') {
        Object.assign(owner,{x:140,y:146});
        Object.assign(recipient,{x:148,y:146});
        expect(game.act(owner,{kind:'selfie'},world)).toBe('Foto guardada no álbum.');
        return;
      }
      if (kind==='documentoAlvo') {
        Object.assign(owner,terminals.secretary.point);
        game.act(owner,{kind:'supply',place:'secretary'},world);
      } else {
        Object.assign(owner,npcs.snackVendor.interaction);
        game.act(owner,{kind:'talk',target:'snackVendor'},world);
        game.act(owner,{kind:'dialogue-choice',target:'products',token:game.view(owner,world).dialogue?.token},world);
        game.act(owner,{kind:'shop-buy',target:'pizza',token:game.view(owner,world).dialogue?.token},world);
      }
      Object.assign(owner,{x:140,y:146});
      Object.assign(recipient,{x:148,y:146});
      const item = game.view(owner,world).inventory.find(item=>item.kind===(kind==='pizzaAlvo' ? 'pizza' : 'document'))!;
      game.act(owner,{kind:'offer',target:recipient.id,item:item.id},world);
      const request = game.view(recipient,world).requests.find(request=>request.item.id===item.id)!;
      game.act(recipient,{kind:'accept',item:request.id},world);
      expect(game.view(recipient,world).inventory.some(entry=>entry.id===item.id)).toBe(true);
    };
    interact(other);
    expect(missions().completed.some(mission=>mission.kind===kind)).toBe(false);
    interact(target);
    expect(missions().completed.find(mission=>mission.kind===kind)?.person?.id).toBe(target.id);
    expect(missions().active).toHaveLength(3);
  },
);

test('a player in isolation is replaced as a selfie target while their office remains visitable',()=>{
  const targets = [{id:'b',name:'Bia'},{id:'c',name:'Caio'}];
  for (const kind of ['selfieAlvo','visitaAlvo'] as const) {
    const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',[kind,'cafe','passeio']);
    agenda.updateEligibility(metrics,3,true,3,0,targets,new Set(['b','c']));
    const target = () => agenda.view(metrics).active.find(mission=>mission.kind===kind)?.person?.id;
    expect(target()).toBe('b');
    agenda.updateEligibility(metrics,3,true,3,0,targets,new Set(['c']));
    expect(target()).toBe(kind==='selfieAlvo' ? 'c' : 'b');
  }
});

test('mission draws skip unavailable offices, exhausted purchases and unaffordable objectives',()=>{
  const metrics = {wallet:0,popularity:40};
  const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['presidenteFoto','protocolo','comprarLagosta','televisao','cafe','passeio','selfieSolo']);
  recordAgendaEvent(agenda,event('purchased',{kind:'officeTv'}));
  // Keep the deck fixed so changes to the account are the only eligibility inputs.
  Reflect.set(agenda,'missions',[]);
  agenda.updateEligibility(metrics,3,false,3);
  expect(agenda.view(metrics).active.map(mission=>mission.kind).sort()).toEqual(['cafe','passeio','selfieSolo']);
  Reflect.set(agenda,'missions',[]);
  metrics.wallet = 6;
  agenda.updateEligibility(metrics,3,true,3);
  const eligible = agenda.view(metrics).active.map(mission=>mission.kind);
  expect(eligible).toContain('comprarLagosta');
  expect(eligible).toContain('protocolo');
  expect(eligible).not.toContain('televisao');
});

test('a carried pizza is an alternative to the purchase cost when drawing a mission',()=>{
  const id = 'a';
  const player:Player = {id,nick:'A',character:0,direction:0,moving:false,...npcs.snackVendor.interaction};
  const economy = new PoliticalEconomy();
  economy.reset([{id,name:'A',character:0}],()=>0);
  const game = new Gameplay();
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind));
  const world:GameplayWorld = {players:[player],now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
  game.act(player,{kind:'talk',target:'snackVendor'},world);
  game.act(player,{kind:'dialogue-choice',target:'products',token:game.view(player,world).dialogue?.token},world);
  game.act(player,{kind:'shop-buy',target:'pizza',token:game.view(player,world).dialogue?.token},world);
  const pizza = game.view(player,world).inventory.find(item=>item.kind==='pizza')!;
  expect(economy.spend(id,6)).toBe(true);
  const account = Reflect.get(economy,'accounts').get(id);
  const active = () => economy.view(id,[],0,false,()=>true)!.missions.active;
  const draw = () => {
    Reflect.set(account.agenda,'missions',[]);
    Reflect.set(account.agenda,'missionDeck',['pizza','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set([id]),3);
  };
  draw();
  expect(active().some(mission=>mission.kind==='pizza')).toBe(true);
  game.act(player,{kind:'drop',item:pizza.id},world);
  draw();
  expect(active().some(mission=>mission.kind==='pizza')).toBe(false);
});

test('the scandal pizza mission becomes eligible only after a public finding',()=>{
  const economy = new PoliticalEconomy();
  const ids = ['a','b','c','d'];
  economy.reset(ids.map(id=>({id,name:id,character:0})),()=>0);
  const {agenda} = Reflect.get(economy,'accounts').get('a');
  const draw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['pizzada','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set(ids),3);
    return economy.view('a',[],0,false,()=>true)!.missions.active.some(mission=>mission.kind==='pizzada');
  };
  expect(draw()).toBe(false);
  economy.recordOfficialScandal();
  expect(draw()).toBe(true);
});

test('furniture missions use the actual cabinet slots and prices at assignment',()=>{
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,...npcs.furnitureVendor.interaction};
  const game = new Gameplay();
  game.reset(0,()=>0,[player],()=>0);
  const economy = new PoliticalEconomy();
  economy.reset([{id:player.id,name:player.nick}],()=>0);
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind),id=>game.officeStock(id));
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  const world:GameplayWorld = {players:[player],now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
  const draw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['ostentacao','gabinete','televisao','poltrona','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set([player.id]),3);
    return economy.view(player.id,[],0,false,()=>true)!.missions.active.map(mission=>mission.kind);
  };
  const buy = (target:string) => {
    game.act(player,{kind:'open-shop',target:'furnitureVendor'},world);
    expect(game.act(player,{kind:'shop-buy',target,token:game.view(player,world).dialogue?.token},world)).toBe('Compra instalada no seu gabinete.');
  };

  expect(economy.spend(player.id,4)).toBe(true);
  expect(draw()).not.toContain('ostentacao');
  economy.earn(player.id,4);
  expect(draw()).toContain('ostentacao');
  buy('officeTv');
  const afterTv = draw();
  expect(afterTv).not.toContain('ostentacao');
  expect(afterTv).not.toContain('televisao');
  expect(afterTv).toContain('gabinete');
  buy('officeRug');
  buy('officeChair');
  expect(draw()).toEqual(['cafe','passeio','selfieSolo']);

  const layout = privateOffices[0];
  Object.assign(player,decorPoint(layout,'officeTv'));
  const installed = game.view(player,world).decorations.find(item=>item.kind==='officeTv')!;
  expect(game.act(player,{kind:'office-remove',place:layout.id,item:installed.id},world)).toBe('Decoração recolhida.');
  expect(economy.spend(player.id,1)).toBe(true);
  expect(draw()).toEqual(['gabinete','televisao','cafe']);
  expect(game.act(player,{kind:'office-install',place:layout.id,item:installed.id},world)).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  const completed = economy.view(player.id,[],0,false,()=>true)!.missions.completed.map(mission=>mission.kind);
  expect(completed).toContain('televisao');
  expect(completed).toContain('gabinete');
});

test('furniture spending is not drawn when no affordable basket reaches the target',()=>{
  const state = {wallet:5,popularity:40,officeStock:()=>['officeTv','officeChair'] as const};
  const price = officeGoods.officeChair.price;
  try {
    Reflect.set(officeGoods.officeChair,'price',3);
    const agenda = new PersonalAgenda(state,1,()=>0,()=>{});
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['ostentacao','cafe','passeio','selfieSolo']);
    agenda.updateEligibility(state,1,true,3);
    expect(agenda.hasActive('ostentacao')).toBe(false);
    state.wallet = 6;
    Reflect.set(agenda,'missions',[]);
    agenda.updateEligibility(state,1,true,3);
    expect(agenda.hasActive('ostentacao')).toBe(true);
  } finally {
    Reflect.set(officeGoods.officeChair,'price',price);
  }
});

test('decoration missions require enough money or an item already in the inventory',()=>{
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,...npcs.credentialsVendor.interaction};
  const game = new Gameplay();
  const economy = new PoliticalEconomy();
  economy.reset([{id:player.id,name:player.nick}],()=>0);
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind));
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  const world:GameplayWorld = {players:[player],now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
  const draw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['retrato','reserva','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set([player.id]),3);
    return economy.view(player.id,[],0,false,()=>true)!.missions.active.map(mission=>mission.kind);
  };
  expect(draw()).toContain('reserva');
  expect(buyCredentialGood(game,player,'portrait',world)).toContain('inventário');
  expect(economy.spend(player.id,6)).toBe(true);
  expect(draw()).toEqual(['retrato','cafe','passeio']);
  const portrait = game.view(player,world).inventory.find(item=>item.kind==='portrait')!;
  Object.assign(player,installationSites.hall.point);
  expect(game.act(player,{kind:'install',place:'hall',item:portrait.id},world)).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  expect(economy.view(player.id,[],0,false,()=>true)?.missions.completed.some(mission=>mission.kind==='retrato')).toBe(true);
  expect(draw()).toEqual(['cafe','passeio','selfieSolo']);
});

test('collective missions wait for enough available players while office visits remain eligible',()=>{
  const economy = new PoliticalEconomy();
  const ids = ['a','b','c','d'];
  economy.reset(ids.map(id=>({id,name:id})),()=>0);
  const {agenda} = Reflect.get(economy,'accounts').get('a');
  economy.suspend('d',1000);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['selfie','entrega','visitaGabinete','cafe','passeio']);
  const draw = () => economy.updateAgendaEligibility(new Set(ids),3);
  const active = () => economy.view('a',[],0,false,()=>true)!.missions.active;
  draw();
  expect(active().map(mission=>mission.kind)).toEqual(['visitaGabinete','cafe','passeio']);

  economy.expireSuspensions(1000);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['selfie','entrega','visitaGabinete','cafe','passeio']);
  draw();
  const selfie = active().find(mission=>mission.kind==='selfie')!;
  expect(selfie).toBeDefined();
  economy.suspend('d',2000);
  draw();
  expect(active()).toContainEqual(selfie);
});

test('photo missions use live portrait and VIP installations when drawing',()=>{
  const players:Player[] = ['a','b','c'].map(id=>({id,nick:id,character:0,direction:0,moving:false,...npcs.credentialsVendor.interaction}));
  const [owner,colleague,visitor] = players;
  const game = new Gameplay();
  const economy = new PoliticalEconomy();
  economy.reset(players.map(({id,nick:name})=>({id,name})),()=>0);
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,(id,kind,replacement)=>game.hasAgendaDecoration(id,kind,replacement));
  const {agenda} = Reflect.get(economy,'accounts').get(owner.id);
  const world:GameplayWorld = {players,now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
  const draw = (replacement=false) => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',replacement ? ['reforma','mandaVip','cafe','passeio','selfieSolo'] : ['autorretrato','fiscalVip','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set(players.map(player=>player.id)),3);
    return economy.view(owner.id,[],0,false,()=>true)!.missions.active.map(mission=>mission.kind);
  };
  const visitorAgenda = Reflect.get(economy,'accounts').get(visitor.id).agenda;
  const drawCeremonial = () => {
    Reflect.set(visitorAgenda,'missions',[]);
    Reflect.set(visitorAgenda,'missionDeck',['cerimonialOficial','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set(players.map(player=>player.id)),3);
    return economy.view(visitor.id,[],0,false,()=>true)!.missions.active.map(mission=>mission.kind);
  };
  const install = (player:Player, place:'hall'|'technicalVip') => {
    const {kind,point} = installationSites[place];
    expect(buyCredentialGood(game,player,kind,world)).toContain('inventário');
    const item = game.view(player,world).inventory.find(item=>item.kind===kind)!;
    Object.assign(player,point);
    expect(game.act(player,{kind:'install',place,item:item.id},world)).toBe('Instalando decoração…');
    world.now += decorationInstallMs;
    game.tick(world,true);
  };

  expect(draw()).toContain('autorretrato');
  expect(draw()).not.toContain('fiscalVip');
  expect(draw(true)).toEqual(['cafe','passeio','selfieSolo']);
  expect(drawCeremonial()).not.toContain('cerimonialOficial');
  install(owner,'hall');
  expect(drawCeremonial()).toContain('cerimonialOficial');
  const completedCeremonial = () => economy.view(visitor.id,[],0,false,()=>true)!.missions.completed
    .some(mission=>mission.kind==='cerimonialOficial');
  expect(game.act(visitor,{kind:'selfie'},world)).toBe('Foto guardada no álbum.');
  expect(completedCeremonial()).toBe(false);
  const {x,y} = installationSites.hall.point;
  Object.assign(visitor,{x:x-24,y:y+19});
  world.now += 2_000;
  expect(game.act(visitor,{kind:'photo'},world)).toBe('Foto guardada no álbum.');
  expect(completedCeremonial()).toBe(false);
  world.now += 2_000;
  expect(game.act(visitor,{kind:'selfie'},world)).toBe('Foto guardada no álbum.');
  expect(completedCeremonial()).toBe(true);
  expect(economy.spend(owner.id,6)).toBe(true);
  install(colleague,'technicalVip');
  expect(draw()).toEqual(['autorretrato','fiscalVip','cafe']);
  Object.assign(owner,{x:x-24,y:y+19});
  expect(game.act(owner,{kind:'selfie'},world)).toBe('Foto guardada no álbum.');
  expect(economy.view(owner.id,[],0,false,()=>true)?.missions.completed.some(mission=>mission.kind==='autorretrato')).toBe(true);
  Object.assign(owner,installationSites.technicalVip.point);
  Object.assign(colleague,installationSites.technicalVip.point);
  world.now += 5_000;
  expect(game.act(owner,{kind:'photo'},world)).toBe('Foto guardada no álbum.');
  const completedVip = () => economy.view(owner.id,[],0,false,()=>true)?.missions.completed.some(mission=>mission.kind==='fiscalVip');
  expect(completedVip()).toBe(false);
  Object.assign(visitor,installationSites.technicalVip.point);
  world.now += 5_000;
  expect(game.act(owner,{kind:'photo'},world)).toBe('Foto guardada no álbum.');
  expect(completedVip()).toBe(true);
  expect(economy.transfer(colleague.id,owner.id,1,false,0)).toBe(true);
  expect(draw(true)).toContain('mandaVip');
  expect(draw(true)).not.toContain('reforma');
  Object.assign(owner,installationSites.technicalVip.point);
  const vip = game.view(owner,world).interactive.find(item=>item.kind==='vip')!;
  expect(game.act(owner,{kind:'uninstall',item:vip.id},world)).toBe('Objeto retirado.');
  expect(draw(true)).toContain('mandaVip');
  expect(game.act(owner,{kind:'install',place:'technicalVip',item:vip.id},world)).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  expect(economy.view(owner.id,[],0,false,()=>true)?.missions.completed.some(mission=>mission.kind==='mandaVip')).toBe(true);
  expect(draw(true)).not.toContain('mandaVip');
});

test('transfer missions wait until the payment quota renews even when the wallet has funds',()=>{
  const economy = new PoliticalEconomy();
  const ids = new Set(['a','b']);
  economy.reset([...ids].map(id=>({id,name:id})),()=>0);
  const {agenda} = Reflect.get(economy,'accounts').get('a');
  const view = (round:number) => economy.view('a',[],round,false,()=>true)!;
  const limit = view(0).paymentsLeft;
  for (let i=0;i<limit;i++) {
    expect(economy.transfer('a','b',1,false,0)).toBe(true);
    expect(economy.transfer('b','a',1,false,0)).toBe(true);
  }
  const draw = (round:number) => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['pagamento','dinheiroAlvo','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(ids,3,()=>true,round);
    return view(round).missions.active.map(mission=>mission.kind);
  };
  expect(view(0)).toMatchObject({wallet:8,paymentsLeft:0});
  expect(draw(0)).toEqual(['cafe','passeio','selfieSolo']);
  expect(draw(1)).toEqual(['pagamento','dinheiroAlvo','cafe']);
  expect(economy.transfer('a','b',3,false,1)).toBe(true);
  expect(view(1).missions.completed.map(mission=>mission.kind)).toEqual(['pagamento']);
  expect(economy.transfer('a','b',1,false,1)).toBe(true);
  expect(view(1).missions.completed.map(mission=>mission.kind)).toEqual(['pagamento','dinheiroAlvo']);
});

test('a dropped contact is replaced without changing their own agenda during the grace period',()=>{
  const economy = new PoliticalEconomy();
  const ids = new Set(['a','b','c']);
  economy.reset([...ids].map(id=>({id,name:id})),()=>0);
  const {agenda} = Reflect.get(economy,'accounts').get('a');
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['selfieAlvo','cafe','passeio']);
  const view = (id:string) => economy.view(id,[],0,false,()=>true)!.missions;
  economy.updateAgendaEligibility(ids,3);
  expect(view('a').active.find(mission=>mission.kind==='selfieAlvo')?.person?.id).toBe('b');
  const before = view('b');
  economy.updateAgendaEligibility(ids,3,()=>true,0,new Set(['b']));
  expect(view('a').active.find(mission=>mission.kind==='selfieAlvo')?.person?.id).toBe('c');
  expect(view('b')).toEqual(before);
});

test('a settled transfer can only advance each agenda once even after a new objective is drawn',()=>{
  const agenda = new PersonalAgenda(metrics,2,()=>0,()=>{});
  Reflect.set(agenda,'missions',[
    {id:100,kind:'recebido',current:0,target:2},
    {id:101,kind:'pagamento',current:0,target:2},
  ]);
  agenda.recordPayment(metrics,'b',42);
  agenda.recordPayment(metrics,'b',42);
  agenda.recordTransfer(metrics,3,'c',43);
  agenda.recordTransfer(metrics,3,'c',43);
  expect(agenda.view(metrics).active).toEqual(expect.arrayContaining([
    expect.objectContaining({kind:'recebido',current:1}),
    expect.objectContaining({kind:'pagamento',current:1}),
  ]));
  agenda.recordPayment(metrics,'b',44);
  agenda.recordTransfer(metrics,3,'c',45);
  expect(agenda.view(metrics).completed.map(mission=>mission.kind)).toEqual(['recebido','pagamento']);
  Reflect.set(agenda,'missions',[{id:102,kind:'recebido',current:0,target:1}]);
  agenda.recordPayment(metrics,'b',42);
  expect(agenda.view(metrics).active.find(mission=>mission.id===102)?.current).toBe(0);
});

test('a signature objective needs two other available signers and retains progress during temporary isolation',()=>{
  const agenda = new PersonalAgenda(metrics,1,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['assinaturas','cafe','passeio','selfieSolo']);
  const targets = [{id:'b',name:'Bia'},{id:'c',name:'Caio'}];
  const available = new Set(['b']);
  agenda.updateEligibility(metrics,3,true,3,0,targets,available);
  expect(agenda.hasActive('assinaturas')).toBe(false);

  Reflect.set(agenda,'missions',[]);
  agenda.updateEligibility(metrics,3,true,3,1,targets,available);
  expect(agenda.hasActive('assinaturas')).toBe(true);
  agenda.recordSignature(metrics,21,'b');
  available.clear();
  agenda.updateEligibility(metrics,3,true,3,1,targets,available);
  expect(agenda.view(metrics).active.find(mission=>mission.kind==='assinaturas')?.current).toBe(1);
  agenda.recordSignature(metrics,21,'npc');
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'assinaturas',current:2}));
});

test('buying an NPC vote is drawn only when a paid quote is affordable and payment is available',()=>{
  const draw = (price:number|undefined,canPay:boolean,canVote=true) => {
    const state = {...metrics,npcVotePrice:()=>price,canPay:()=>canPay};
    const agenda = new PersonalAgenda(state,1,()=>0,()=>{});
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['votoNpc','cafe','passeio','selfieSolo']);
    agenda.updateEligibility(state,1,canVote,3,1);
    return agenda;
  };
  expect(draw(9,true).hasActive('votoNpc')).toBe(false);
  expect(draw(undefined,true).hasActive('votoNpc')).toBe(false);
  expect(draw(3,false).hasActive('votoNpc')).toBe(false);
  expect(draw(3,true,false).hasActive('votoNpc')).toBe(false);
  const agenda = draw(3,true);
  expect(agenda.hasActive('votoNpc')).toBe(true);
  recordAgendaEvent(agenda,event('npc-vote-bought'));
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'votoNpc'}));
});

test('NPC robbery returns to the mission deck when an empty wallet is funded again',()=>{
  const economy = new PoliticalEconomy();
  economy.reset([{id:'a',name:'Alice'}],()=>0);
  economy.addParliamentarian({id:'npc',name:'Parlamentar'},3);
  const {agenda} = Reflect.get(economy,'accounts').get('a');
  const draw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['rouboNpc','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set(['a']),3);
    return economy.hasMission('a','rouboNpc');
  };
  expect(draw()).toBe(true);
  expect(economy.takeWallet('npc')).toBe(3);
  expect(draw()).toBe(false);
  expect(economy.transfer('a','npc',1,true,0)).toBe(true);
  expect(draw()).toBe(true);
});

test('players without one of the six offices can visit a colleague but cannot draw own-office missions',()=>{
  const players:Player[] = Array.from({length:8},(_,i)=>({id:String(i),nick:String(i),character:0,direction:0,moving:false,...npcs.credentialsVendor.interaction}));
  const visitor = players[6];
  const game = new Gameplay();
  game.reset(0,()=>0,players,()=>0);
  const economy = new PoliticalEconomy();
  economy.reset(players.map(({id,nick:name})=>({id,name})),()=>0);
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind),id=>game.officeStock(id),undefined,undefined,id=>game.hasOffice(id));
  expect(game.hasOffice(visitor.id)).toBe(false);
  const {agenda} = Reflect.get(economy,'accounts').get(visitor.id);
  const withoutOffice = players[7];
  expect(game.hasOffice(withoutOffice.id)).toBe(false);
  Reflect.set(agenda,'missions',[
    {id:99,kind:'embolso',target:1,current:0},
    {id:100,kind:'visitaAlvo',target:1,current:0,person:{id:withoutOffice.id,name:withoutOffice.nick}},
  ]);
  Reflect.set(agenda,'missionDeck',['embolso','transporte','retratoGabinete','visitaAlvo','passeio','selfieSolo']);
  economy.updateAgendaEligibility(new Set(players.map(player=>player.id)),3);
  const active = economy.view(visitor.id,[],0,false,()=>true)!.missions.active;
  expect(active.map(mission=>mission.kind)).toEqual(['visitaAlvo','passeio','selfieSolo']);
  expect(game.hasOffice(active[0].person!.id)).toBe(true);
});

test('the VIP inspection needs a photographer, a plate owner and a visitor',()=>{
  const agenda = new PersonalAgenda(metrics,2,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['fiscalVip','cafe','passeio','selfieSolo']);
  const withVip = {...metrics,hasAgendaDecoration:()=>true};
  agenda.updateEligibility(withVip,2,true,3,0,[{id:'b',name:'Bia'}],new Set(['a','b']));
  expect(agenda.view(withVip).active.map(mission=>mission.kind)).toEqual(['cafe','passeio','selfieSolo']);
});

test('scandal missions require known evidence against another player and retire when the proof is published',()=>{
  const economy = new PoliticalEconomy();
  const ids = ['a','b','c','d'];
  economy.reset(ids.map(id=>({id,name:id})),()=>0);
  const view = (id:string)=>economy.view(id,[],0,false,()=>true)!;
  const active = (id:string)=>view(id).missions.active.some(mission=>mission.kind==='escandalo');
  const accounts = Reflect.get(economy,'accounts');
  for (const id of ids) {
    const {agenda} = accounts.get(id);
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['escandalo','cafe','passeio']);
  }
  economy.updateAgendaEligibility(new Set(ids),3);
  expect(economy.transfer('a','b',1,false,0)).toBe(true);
  expect(economy.audit('c',0)).toContain('Nenhum');
  expect(economy.transfer('a','b',1,true,0)).toBe(true);
  expect(ids.some(active)).toBe(false);
  expect(economy.audit('c',0)).toContain('encontrado');
  expect(economy.audit('d',0)).toContain('encontrado');
  expect(active('c')).toBe(true);
  expect(active('d')).toBe(true);
  const evidence = view('c').evidence[0].id;
  expect(economy.publish('c',evidence)).toBeDefined();
  expect(view('c').missions.completed.some(mission=>mission.kind==='escandalo')).toBe(true);
  expect(active('d')).toBe(false);
  expect(view('d').missions.completed.some(mission=>mission.kind==='escandalo')).toBe(false);
  expect(economy.publish('d',evidence)).toBeUndefined();
});

test('a pizza already served at the Cafezinho can support a mission without money for another',()=>{
  const players:Player[] = ['a','b','c','d'].map(id=>({id,nick:id,character:0,direction:0,moving:false,...npcs.snackVendor.interaction}));
  const [host,...guests] = players;
  const game = new Gameplay();
  const economy = new PoliticalEconomy();
  const ids = new Set(players.map(player=>player.id));
  economy.reset(players.map(({id,nick:name})=>({id,name})),()=>0);
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,undefined,undefined,undefined,id=>game.installedPizza(id));
  const world:GameplayWorld = {players,now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    spend:(id,amount)=>economy.spend(id,amount),publish:event=>economy.recordGameplay(event)};
  game.act(host,{kind:'talk',target:'snackVendor'},world);
  game.act(host,{kind:'dialogue-choice',target:'products',token:game.view(host,world).dialogue?.token},world);
  game.act(host,{kind:'shop-buy',target:'pizza',token:game.view(host,world).dialogue?.token},world);
  const pizza = game.view(host,world).inventory.find(item=>item.kind==='pizza')!;
  expect(economy.spend(host.id,6)).toBe(true);
  economy.recordOfficialScandal();
  players.forEach(player=>Object.assign(player,installationSites.pizza.point));
  expect(game.act(host,{kind:'install',place:'pizza',item:pizza.id},world)).toBe('Objeto instalado.');
  const view = ()=>economy.view(host.id,[],0,false,()=>true)!.missions;
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  const draw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['pizzada','fatias','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(ids,3);
    return view().active.map(mission=>mission.kind);
  };
  const [guest] = guests;
  const guestAgenda = Reflect.get(economy,'accounts').get(guest.id).agenda;
  const guestView = () => economy.view(guest.id,[],0,false,()=>true)!.missions;
  const drawGuest = () => {
    Reflect.set(guestAgenda,'missions',[]);
    Reflect.set(guestAgenda,'missionDeck',['pizza','fatias','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(ids,3);
    return guestView().active.map(mission=>mission.kind);
  };
  expect(economy.spend(guest.id,economy.wallet(guest.id))).toBe(true);
  expect(drawGuest()).toContain('pizza');
  expect(guestView().active.some(mission=>mission.kind==='fatias')).toBe(false);
  expect(draw()).toEqual(['pizzada','fatias','cafe']);
  expect(game.act(guests[0],{kind:'slice',item:pizza.id},world)).toBe('Fatia servida.');
  expect(guestView().completed.some(mission=>mission.kind==='pizza')).toBe(true);
  expect(drawGuest()).not.toContain('pizza');
  expect(draw()).toEqual(['fatias','cafe','passeio']);
  for (const guest of guests.slice(1)) expect(game.act(guest,{kind:'slice',item:pizza.id},world)).toBe('Fatia servida.');
  expect(view().completed.some(mission=>mission.kind==='fatias')).toBe(true);
  expect(economy.spend(host.id,economy.wallet(host.id))).toBe(true);
  expect(draw()).toEqual(['cafe','passeio','selfieSolo']);
});

test('incoming payment missions require distinct colleagues who can still pay',()=>{
  const economy = new PoliticalEconomy();
  const ids = new Set(['a','b','c']);
  economy.reset([...ids].map(id=>({id,name:id})),()=>0);
  const view = (round:number)=>economy.view('a',[],round,false,()=>true)!;
  const {agenda} = Reflect.get(economy,'accounts').get('a');
  const draw = (round:number)=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['articulacao','recebido','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(ids,3,()=>true,round);
    return view(round).missions.active.map(mission=>mission.kind);
  };
  const limit = economy.view('b',[],0,false,()=>true)!.paymentsLeft;
  for (let i=0;i<limit;i++) expect(economy.transfer('b','c',1,false,0)).toBe(true);
  expect(economy.spend('c',economy.wallet('c'))).toBe(true);
  expect(draw(0)).toEqual(['cafe','passeio','selfieSolo']);
  expect(draw(1)).toEqual(['recebido','cafe','passeio']);
  economy.earn('c',1);
  expect(draw(1)).toEqual(['articulacao','recebido','cafe']);
  expect(economy.transfer('b','a',1,false,1)).toBe(true);
  expect(view(1).missions.active.find(mission=>mission.kind==='articulacao')?.current).toBe(1);
  expect(economy.transfer('c','a',1,false,1)).toBe(true);
  expect(view(1).missions.completed.map(mission=>mission.kind)).toEqual(['recebido','articulacao']);
});

test('solo signature missions require enough money and payment quota for the NPC signatures',()=>{
  const owner:Player = {...terminals.secretary.point,id:'a',nick:'A',direction:0,moving:false,character:0};
  const members = new Parliamentarians();
  members.reset(3,0);
  const [free,paid] = members.players;
  const economy = new PoliticalEconomy();
  economy.reset([{id:owner.id,name:owner.nick,character:owner.character}],()=>0);
  for (const npc of members.players) economy.addParliamentarian({id:npc.id,name:npc.nick,character:npc.character},1);
  const game = new Gameplay();
  economy.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,undefined,undefined,undefined,undefined,
    id=>members.players.map(npc=>members.signature(npc.id,id)));
  const {agenda} = Reflect.get(economy,'accounts').get(owner.id);
  const view = (round:number)=>economy.view(owner.id,[],round,false,()=>true)!;
  const draw = (round:number)=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['assinaturas','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set([owner.id]),3,()=>true,round);
    return agenda.hasActive('assinaturas');
  };
  expect(economy.spend(owner.id,7)).toBe(true);
  expect(draw(0)).toBe(false);
  economy.earn(owner.id,1);
  for (let i=0, limit=view(0).paymentsLeft;i<limit;i++) {
    expect(economy.transfer(owner.id,paid.id,1,true,0)).toBe(true);
    expect(economy.transfer(paid.id,owner.id,1,true,0)).toBe(true);
  }
  expect(draw(0)).toBe(false);
  expect(draw(1)).toBe(true);
  const quota = view(1).paymentsLeft;
  const world:GameplayWorld = {players:[owner,...members.players],now:1,voice:()=>false,office:()=>undefined,
    earn:()=>{},publish:event=>economy.recordGameplay(event),
    payNpc:(from,to,price)=>economy.transfer(from,to,price,true,1)};
  expect(game.act(owner,{kind:'supply',place:'secretary',target:'project-0'},world)).toBe('Objeto guardado no inventário.');
  expect(game.act(owner,{kind:'supply',place:'secretary',target:'queue'},world)).toBe('Objeto guardado no inventário.');
  expect(game.act(owner,{kind:'supply',place:'secretary',target:'queue'},world)).toContain('já está carregando');
  const [project,document] = game.view(owner,world).inventory;
  expect(game.signWithNpc(owner,free,project.id,0,world)).toBe('Documento indisponível.');
  for (const npc of [free,paid]) {
    expect(game.signWithNpc(owner,npc,document.id,members.signature(npc.id,owner.id),world)).toBe('Assinatura obtida.');
  }
  expect(view(1).missions.completed).toContainEqual(expect.objectContaining({kind:'assinaturas',current:2}));
  expect(view(1).paymentsLeft).toBe(quota-1);
});

test('replayed installations cannot turn a pre-scandal pizza into a scandal pizza',()=>{
  const economy = new PoliticalEconomy();
  const ids = new Set(['a','b','c','d']);
  economy.reset([...ids].map(id=>({id,name:id})),()=>0);
  const account = Reflect.get(economy,'accounts').get('a');
  const installation = event('installed',{kind:'pizza',item:15,place:'pizza'});
  economy.recordGameplay(installation);
  economy.recordOfficialScandal();
  Reflect.set(account.agenda,'missions',[]);
  Reflect.set(account.agenda,'missionDeck',['pizzada','cafe','passeio','selfieSolo']);
  economy.updateAgendaEligibility(ids,3);
  expect(account.agenda.hasActive('pizzada')).toBe(true);
  economy.recordGameplay({...installation});
  for (const [index,guest] of ['b','c','d'].entries()) {
    economy.recordGameplay(event('slice',{at:index+2,kind:'pizza',item:15,target:guest}));
  }
  const mission = ()=>economy.view('a',[],0,false,()=>true)!.missions;
  expect(mission().active).toContainEqual(expect.objectContaining({kind:'pizzada',current:0}));
  economy.recordGameplay({...installation,at:10});
  for (const [index,guest] of ['b','c','d'].entries()) {
    economy.recordGameplay(event('slice',{at:index+11,kind:'pizza',item:15,target:guest}));
  }
  expect(mission().completed).toContainEqual(expect.objectContaining({kind:'pizzada',current:3}));
});

test('Pizzada keeps credit for a departed guest only if the same pizza can still serve the others',()=>{
  for (const scenario of ['credited guest left','unserved guest left','pizza replaced','too few slices']) {
    const economy = new PoliticalEconomy();
    const ids = ['a','b','c','d'];
    economy.reset(ids.map(id=>({id,name:id})),()=>0);
    economy.recordOfficialScandal();
    const {agenda} = Reflect.get(economy,'accounts').get('a');
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['pizzada','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set(ids),3);
    expect(agenda.hasActive('pizzada')).toBe(true);

    economy.recordGameplay(event('installed',{kind:'pizza',item:15,place:'pizza'}));
    economy.recordGameplay(event('slice',{at:2,kind:'pizza',item:15,target:'b'}));
    const pizza = {id:scenario==='pizza replaced' ? 16 : 15,owned:true,canTakeSlice:true,
      slices:scenario==='too few slices' ? 1 : 5,served:new Set(scenario==='pizza replaced' ? [] : ['b'])};
    if (scenario==='pizza replaced') economy.recordGameplay(event('installed',{at:3,kind:'pizza',item:16,place:'pizza'}));
    economy.setAgendaInventory(()=>false,undefined,undefined,undefined,undefined,()=>pizza);
    const leaving = scenario==='unserved guest left' ? 'c' : 'b';
    economy.updateAgendaEligibility(new Set(ids.filter(id=>id!==leaving)),3);
    const missions = ()=>economy.view('a',[],0,false,()=>true)!.missions;

    if (scenario!=='credited guest left') {
      expect(missions().active.some(row=>row.kind==='pizzada')).toBe(false);
      expect(missions().completed).toEqual([]);
      continue;
    }
    expect(missions().active).toContainEqual(expect.objectContaining({kind:'pizzada',current:1}));
    for (const [index,target] of ['c','d'].entries()) {
      economy.recordGameplay(event('slice',{at:4+index,kind:'pizza',item:15,target}));
    }
    expect(missions().completed).toContainEqual(expect.objectContaining({kind:'pizzada',current:3}));
  }
});

test('coffee delivery counts accepted cups for three distinct available human recipients',()=>{
  const players:Player[] = ['a','b','c','d'].map(id=>({
    id,nick:id,character:0,direction:0,moving:false,...terminals.coffee.point,
  }));
  const [host,bia,caio,dani] = players;
  const ids = new Set(players.map(({id})=>id));
  const game = new Gameplay();
  const economy = new PoliticalEconomy();
  economy.reset(players.map(({id,nick:name})=>({id,name})),()=>0);
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  const active = ()=>economy.view(host.id,[],0,false,()=>true)!.missions;
  const draw = (disconnected = new Set<string>())=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['entrega','cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(ids,3,()=>true,0,disconnected);
  };
  draw(new Set([dani.id]));
  expect(active().active.some(({kind})=>kind==='entrega')).toBe(false);
  draw();
  const world:GameplayWorld = {players,now:0,voice:()=>false,office:()=>undefined,
    earn:()=>{},publish:event=>economy.recordGameplay(event)};
  function deliver(recipient:Player) {
    world.now += stationRecharge.coffee.duration;
    expect(game.act(host,{kind:'supply',place:'coffee'},world)).toBe('Objeto guardado no inventário.');
    const coffee = game.view(host,world).inventory.find(({kind})=>kind==='coffee')!;
    expect(game.act(host,{kind:'offer',item:coffee.id,target:recipient.id},world)).toBe('Pedido enviado.');
    const request = game.view(recipient,world).requests[0];
    expect(game.act(recipient,{kind:'accept',item:request.id},world)).toBe('Objeto recebido.');
  }
  deliver(bia);
  deliver(bia);
  expect(active().active.find(({kind})=>kind==='entrega')?.current).toBe(1);
  const mission = active().active.find(({kind})=>kind==='entrega');
  economy.updateAgendaEligibility(new Set([host.id,caio.id,dani.id]),3);
  expect(active().active.find(({kind})=>kind==='entrega')).toEqual(mission);
  deliver(caio);
  expect(active().active.find(({kind})=>kind==='entrega')?.current).toBe(2);
  deliver(dani);
  expect(active().completed).toContainEqual(expect.objectContaining({kind:'entrega',current:3,target:3}));

  draw();
  deliver(bia);
  economy.updateAgendaEligibility(new Set([host.id,bia.id,caio.id]),3);
  expect(active().active.some(({kind})=>kind==='entrega')).toBe(false);
  expect(active().completed.filter(({kind})=>kind==='entrega')).toHaveLength(1);
});

test('solo players with NPCs are not offered human transfer or group photo missions',()=>{
  const agenda = new PersonalAgenda(metrics,1,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['pagamento','fotografia','cafe','passeio','selfieSolo']);
  agenda.updateEligibility(metrics,4,true,3,3,[],new Set(['a','npc1','npc2','npc3']));
  expect(agenda.view(metrics).active.map(({kind})=>kind)).toEqual(['cafe','passeio','selfieSolo']);
});

const missionPhoto = {
  id:12,author:{id:'a',name:'A'},at:1,location:'Arquivo',selfie:true,
  center:{x:480,y:650},people:[],ground:[],decorations:[],transfers:[],
};

test.each([
  ['registroHistorico',event('photo',{photo:missionPhoto,position:{x:480,y:650}}),event('photo',{photo:missionPhoto,at:2})],
  ['jornalismo',event('photo-published',{photo:missionPhoto,place:'internal-mail'}),event('photo-published',{photo:missionPhoto})],
  ['provaDocumental',event('photo',{photo:{...missionPhoto,ground:[{id:1,kind:'document',x:480,y:650}]}}),event('photo',{photo:missionPhoto,at:2})],
  ['cafeEstrategico',event('used',{kind:'coffee',place:'Cafezinho'}),event('used',{kind:'coffee',place:'Arquivo'})],
  ['contasTesouraria',event('delivered',{kind:'briefcase',place:'treasury'}),event('delivered',{kind:'briefcase',place:'press'})],
  ['contribuinte',event('delivered',{amount:5,place:'treasury'}),event('delivered',{amount:5,place:'press'})],
  ['trabalhoRemoto',event('room-time',{duration:30_000,target:'a'}),event('room-time',{duration:30_000,target:'b'})],
  ['apagarIncendio',event('fire-extinguished'),event('room-entered',{place:'Cafezinho'})],
  ['primeirosSocorros',event('used',{kind:'firstAidKit'}),event('collected',{kind:'firstAidKit'})],
  ['socorro',event('aided',{target:'b'}),event('aided',{target:'npc-parliamentarian-1'})],
  ['almocoPlenario',event('used',{kind:'pizza',position:{x:480,y:650}}),event('used',{kind:'pizza',at:2})],
  ['reservaCofre',event('money-pocketed',{amount:5}),event('collected',{kind:'briefcase'})],
  ['cuecaDinheiro',event('concealment-started',{amount:1}),event('concealment-started',{amount:0,at:2})],
] as const)('%s starts at zero and rewards only a valid new event', (kind,valid,invalid)=>{
  const totals:number[] = [];
  const options = {...metrics,owns:()=>true};
  const agenda = new PersonalAgenda(options,2,()=>0,reward=>totals.push(reward.xp));
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',[kind,'passeio','jogar']);
  agenda.updateEligibility(options,2,true,3,0,[{id:'b',name:'B'}]);
  expect(agenda.view(options).active.find(mission=>mission.kind===kind)?.current).toBe(0);
  for (const entry of [invalid,valid,valid]) {
    if (agenda.acceptGameplayEvent(entry)) agenda.applyGameplayEvent(options,entry,false);
  }
  expect(agenda.view(options).completed.filter(mission=>mission.kind===kind)).toHaveLength(1);
  expect(totals).toHaveLength(1);
  const before = agenda.view(options);
  agenda.updateEligibility(options,2,true,3,0,[{id:'b',name:'B'}]);
  expect(agenda.view(options).completed).toEqual(before.completed);
});

test('photo tourism counts distinct locations after assignment',()=>{
  const agenda = new PersonalAgenda(metrics,1,()=>0,()=>{});
  recordAgendaEvent(agenda,event('photo',{photo:missionPhoto}));
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['turismo','cafe','selfieSolo']);
  agenda.updateEligibility(metrics,1,true,3);
  for (const [index,location] of ['Arquivo','Arquivo','Biblioteca','Cafezinho'].entries()) {
    recordAgendaEvent(agenda,event('photo',{at:index+2,photo:{...missionPhoto,id:index+20,location,selfie:false}}));
    if (index<3) expect(agenda.view(metrics).active.find(mission=>mission.kind==='turismo')?.current).toBe(index===2 ? 2 : 1);
  }
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'turismo',current:3}));
});

test('calls need ten seconds on each of two distinct lines after the mission starts',()=>{
  const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['chamadasUrgentes','cafe','selfieSolo']);
  const {minCallMs,contacts} = urgentCallMission;
  agenda.updateEligibility(metrics,contacts,true,3,0,[{id:'b',name:'B'}]);
  expect(agenda.view(metrics).active.some(({kind})=>kind==='chamadasUrgentes')).toBe(false);
  agenda.updateEligibility(metrics,contacts+1,true,3,0,[{id:'b',name:'B'},{id:'c',name:'C'}]);
  for (const [at,target,item,duration] of [[1,'b',1,minCallMs-1],[2,'b',2,1],[3,'b',1,1],[4,'b',3,minCallMs],[5,'c',4,minCallMs]] as const) {
    const sample = event('call-time',{at,target,item,duration});
    recordAgendaEvent(agenda,sample);
    recordAgendaEvent(agenda,sample);
    if (at<5) expect(agenda.view(metrics).active.find(mission=>mission.kind==='chamadasUrgentes')?.current).toBe(at<3 ? 0 : 1);
  }
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'chamadasUrgentes',current:contacts,target:contacts}));
});

test('urgent calls are replaced if too few distinct contacts remain to finish',()=>{
  const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['chamadasUrgentes','cafe','credencial','passeio']);
  const contacts = [{id:'b',name:'B'},{id:'c',name:'C'}];
  agenda.updateEligibility(metrics,3,true,3,0,contacts);
  expect(agenda.hasActive('chamadasUrgentes')).toBe(true);
  agenda.updateEligibility(metrics,2,true,3,0,contacts.slice(0,1));
  expect(agenda.hasActive('chamadasUrgentes')).toBe(false);
  expect(agenda.view(metrics).active).toHaveLength(3);
});

test.each([
  ['debateTelefonico',event('call-time',{duration:20_000,target:'b',item:1}),event('called',{target:'b'})],
  ['nadaADeclarar',event('concealed-cash-time',{duration:15_000}),event('concealment-started',{amount:1})],
  ['produtividade',event('game-played',{duration:30_000,place:'own-office'}),event('game-played',{duration:30_000})],
  ['varredura',event('spy-discovered',{item:3}),event('spy-discovered')],
  ['limpeza',event('spy-removed',{item:3}),event('spy-removed')],
  ['escutaAtiva',event('wiretap-time',{duration:15_000}),event('wiretap-time',{duration:0,at:2})],
  ['fiscalizacaoParalela',event('xray-target-revealed',{place:'safe'}),event('xray-target-revealed',{place:'npc'})],
  ['patrimonioSuspeito',event('xray-target-revealed',{place:'npc'}),event('xray-scanned')],
  ['discursoMegafone',event('megaphone-time',{duration:10_000}),event('megaphone-started')],
  ['campanhaUltimaHora',event('advertisement-aired',{duration:LATE_CAMPAIGN_WINDOW_MS}),event('advertisement-aired',{duration:LATE_CAMPAIGN_WINDOW_MS+1,at:2})],
  ['mensagemComAnexo',event('mail-published',{place:'document'}),event('photo-published')],
  ['retratacaoOficial',event('mail-published',{place:'report',reportNotice:1}),event('mail-published',{place:'document'})],
  ['instalarGrampo',event('spy-installed',{kind:'wiretap'}),event('spy-installed',{kind:'spyCamera'})],
  ['instalarCamera',event('spy-installed',{kind:'spyCamera'}),event('spy-installed',{kind:'wiretap'})],
  ['reuniaoGabinete',event('office-meeting-time',{duration:15_000}),event('public-meeting-time',{duration:15_000})],
  ['reuniaoPublica',event('public-meeting-time',{duration:10_000}),event('office-meeting-time',{duration:10_000})],
  ['heroiInesperado',event('fire-extinguished',{amount:29}),event('fire-extinguished',{amount:30,at:2})],
] as const)('%s validates the required event and grants XP once',(kind,valid,wrong)=>{
  const rewards:number[] = [];
  const options = {...metrics,owns:()=>true,hasOffice:()=>true,agendaReportNotices:()=>[1],hasKnownForeignSpy:()=>true,canInstallSpy:()=>true,canFightCrisis:()=>true,ownsWiretap:()=>true};
  const agenda = new PersonalAgenda(options,4,()=>0,reward=>rewards.push(reward.xp));
  recordAgendaEvent(agenda,{...valid,at:0});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',[kind,'cafe','passeio','selfieSolo']);
  agenda.updateEligibility(options,4,true,3,1,[{id:'b',name:'B'},{id:'c',name:'C'},{id:'d',name:'D'}]);
  recordAgendaEvent(agenda,wrong);
  expect(agenda.view(options).active.find(mission=>mission.kind===kind)?.current).toBe(0);
  recordAgendaEvent(agenda,valid);
  recordAgendaEvent(agenda,valid);
  expect(agenda.view(options).completed.filter(mission=>mission.kind===kind)).toHaveLength(1);
  expect(rewards).toHaveLength(1);
});

test('three signatures must all come from distinct signers on a single document',()=>{
  const agenda = new PersonalAgenda(metrics,4,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['comissaoImprovisada','passeio','cafe']);
  agenda.updateEligibility(metrics,4,true,3,0,[{id:'b',name:'B'},{id:'c',name:'C'},{id:'d',name:'D'}]);
  agenda.recordSignature(metrics,1,'b');
  agenda.recordSignature(metrics,1,'b');
  agenda.recordSignature(metrics,1,'c');
  agenda.recordSignature(metrics,2,'d');
  expect(agenda.view(metrics).active.find(mission=>mission.kind==='comissaoImprovisada')?.current).toBe(2);
  agenda.recordSignature(metrics,1,'d');
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'comissaoImprovisada',current:3}));
});

test('cash missions require an accepted in-person handover and use the actual amount',()=>{
  const players:Player[] = ['a','b'].map((id,index)=>({id,nick:id,character:index,direction:0,moving:false,x:140+index*8,y:146}));
  const [sender,recipient] = players;
  const economy = new PoliticalEconomy();
  economy.reset(players.map(({id,nick:name})=>({id,name})),()=>0);
  const accounts = Reflect.get(economy,'accounts');
  const game = new Gameplay();
  const events:GameplayEvent[] = [];
  const world:GameplayWorld = {players,now:10,voice:()=>false,office:()=>undefined,earn:()=>{},
    takeWallet:()=>2,publish:entry=>{
      events.push(entry);
      economy.recordGameplay(entry);
    }};
  accounts.get(sender.id).hasCashLot = (amount:number)=>game.hasCashLot(sender.id,amount);
  const draw = (id:string,kind:'dinheiroPresencialVinte'|'caixaDois')=>{
    const {agenda} = accounts.get(id);
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',[kind,'cafe','passeio','selfieSolo']);
    economy.updateAgendaEligibility(new Set(players.map(player=>player.id)),3);
    return economy.hasMission(id,kind);
  };
  const completed = (id:string,kind:string)=>economy.view(id,[],0,false,()=>true)!.missions.completed
    .some(mission=>mission.kind===kind);
  const npc = {...recipient,id:'npc',npc:true as const};
  expect(draw(sender.id,'dinheiroPresencialVinte')).toBe(false);
  game.robNpc(sender,npc,world);
  const exact = game.view(sender,world).inventory.find(item=>item.kind==='briefcase')!;
  expect(draw(sender.id,'dinheiroPresencialVinte')).toBe(true);
  expect(draw(recipient.id,'caixaDois')).toBe(true);
  expect(economy.transfer(sender.id,recipient.id,2,true,0,'pix')).toBe(true);
  expect(completed(recipient.id,'caixaDois')).toBe(false);

  const offer = (item:number)=>{
    expect(game.act(sender,{kind:'offer',target:recipient.id,item},world)).toBe('Pedido enviado.');
    return game.view(recipient,world).requests[0].id;
  };
  world.takeWallet = ()=>3;
  game.robNpc(sender,npc,world);
  const larger = game.view(sender,world).inventory.find(item=>item.kind==='briefcase' && item.id!==exact.id)!;
  expect(game.act(recipient,{kind:'accept',item:offer(larger.id)},world)).toBe('Objeto recebido.');
  expect(completed(recipient.id,'caixaDois')).toBe(true);
  expect(completed(sender.id,'dinheiroPresencialVinte')).toBe(false);
  const request = offer(exact.id);
  recipient.x = 400;
  expect(game.act(recipient,{kind:'accept',item:request},world)).toBe('O portador ou objeto está fora de alcance.');
  expect(completed(sender.id,'dinheiroPresencialVinte')).toBe(false);
  recipient.x = 148;
  const beforeAccept = events.length;
  expect(game.act(recipient,{kind:'accept',item:request},world)).toBe('Objeto recebido.');
  expect(completed(sender.id,'dinheiroPresencialVinte')).toBe(true);
  expect(game.act(recipient,{kind:'accept',item:request},world)).toBe('Pedido indisponível.');
  expect(events.slice(beforeAccept)).toEqual([
    expect.objectContaining({type:'transferred',actor:sender.id,target:recipient.id,item:exact.id,amount:2}),
    expect.objectContaining({type:'cash-received',actor:recipient.id,target:sender.id,item:exact.id,amount:2}),
  ]);
});

test('Raio X missions require the equipment and the corresponding targets',()=>{
  const contacts = [{id:'b',name:'Bia'}];
  const draw = (owns:boolean,hasOffice:boolean,npcs:number)=>{
    const options = {...metrics,owns:()=>owns,hasOffice:()=>hasOffice};
    const agenda = new PersonalAgenda(options,2,()=>0,()=>{});
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['fiscalizacaoParalela','patrimonioSuspeito','cafe','passeio','selfieSolo']);
    agenda.updateEligibility(options,2,true,3,npcs,contacts);
    return agenda.view(options).active.map(mission=>mission.kind);
  };
  expect(draw(false,true,1)).not.toContain('fiscalizacaoParalela');
  expect(draw(false,true,1)).not.toContain('patrimonioSuspeito');
  expect(draw(true,true,0)).toContain('fiscalizacaoParalela');
  expect(draw(true,true,0)).not.toContain('patrimonioSuspeito');
  expect(draw(true,false,1)).not.toContain('fiscalizacaoParalela');
  expect(draw(true,false,1)).toContain('patrimonioSuspeito');
});

test('extraordinary collection requires a partial treasury deposit from a robbery during the mission',()=>{
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,...terminals.treasury.point};
  const npc:Player = {...player,id:'npc',npc:true};
  const game = new Gameplay();
  const agenda = new PersonalAgenda(metrics,1,()=>0,()=>{});
  let deposits = 0;
  let allowDeposit = true;
  const world:GameplayWorld = {players:[player,npc],now:10,voice:()=>false,office:()=>undefined,earn:()=>{},
    takeWallet:()=>3,deposit:(_id,amount)=>{
      if (!allowDeposit) return false;
      deposits += amount;
      return true;
    },publish:event=>recordAgendaEvent(agenda,event)};
  const steal = ()=>{
    const before = new Set(game.view(player,world).inventory.map(item=>item.id));
    expect(game.robNpc(player,npc,world)).toContain('Maleta roubada');
    return game.view(player,world).inventory.find(item=>!before.has(item.id))!.id;
  };
  const earlier = steal();
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['recolhimentoExtraordinario','cafe','passeio','selfieSolo']);
  agenda.updateEligibility(metrics,1,true,3,1);
  const active = ()=>agenda.view(metrics).active.find(mission=>mission.kind==='recolhimentoExtraordinario');
  const deliver = (id:number,partial:boolean)=>game.act(player,{kind:'deliver',place:'treasury',item:id,target:partial ? 'partial' : undefined},world);
  expect(active()?.current).toBe(0);
  expect(deliver(earlier,true)).toContain('R$ 15 mil');
  expect(active()?.current).toBe(0);
  const full = steal();
  expect(active()?.current).toBe(1);
  expect(deliver(full,false)).toContain('R$ 30 mil');
  expect(active()?.current).toBe(1);
  const tracked = steal();
  allowDeposit = false;
  expect(deliver(tracked,true)).toBe('Leve a maleta à Tesouraria.');
  expect(active()?.current).toBe(1);
  allowDeposit = true;
  expect(deliver(tracked,true)).toContain('R$ 15 mil');
  expect(deposits).toBe(6);
  expect(game.view(player,world).inventory).toContainEqual(expect.objectContaining({id:tracked,cash:1.5}));
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'recolhimentoExtraordinario',current:2}));
});

test('savings tracks the net increase after assignment, including spending and fractional credits',()=>{
  const economy = new PoliticalEconomy();
  economy.reset([{id:'a',name:'A'}],()=>0);
  economy.earn('a',20);
  const {agenda} = Reflect.get(economy,'accounts').get('a');
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['poupancaInstitucional','cafe','passeio','selfieSolo']);
  economy.updateAgendaEligibility(new Set(['a']),3);
  const view = ()=>economy.view('a',[],0,false,()=>true)!.missions;
  const progress = ()=>view().active.find(mission=>mission.kind==='poupancaInstitucional')?.current;
  expect(progress()).toBe(0);
  economy.earn('a',7.5);
  expect(progress()).toBe(7.5);
  expect(economy.spend('a',2.5)).toBe(true);
  expect(progress()).toBe(5);
  economy.earn('a',4.9);
  expect(progress()).toBe(9.9);
  economy.earn('a',.1);
  expect(view().completed).toContainEqual(expect.objectContaining({kind:'poupancaInstitucional',current:10}));
});

test('Segurança Parlamentar requires an uninterrupted watch next to the same parliamentarian',()=>{
  const players:Player[] = ['a','b','c'].map(id=>({id,nick:id,character:0,direction:0,moving:false,x:npcs.vendor.x,y:npcs.vendor.y+11}));
  const [guard,first,second] = players;
  const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['segurancaParlamentar','cafe','passeio','selfieSolo']);
  agenda.updateEligibility(metrics,3,true,3,0,players.slice(1).map(({id,nick:name})=>({id,name})));
  const game = new Gameplay();
  const world:GameplayWorld = {players,now:1,voice:()=>false,office:()=>undefined,earn:()=>{},spend:()=>true,
    hasMission:(id,kind)=>id===guard.id && agenda.hasActive(kind),publish:event=>recordAgendaEvent(agenda,event)};
  const progress = ()=>agenda.view(metrics).active.find(mission=>mission.kind==='segurancaParlamentar')?.current;
  const tick = (count:number)=>{
    for (let i=0;i<count;i++) {
      world.now += 100;
      game.tick(world,true);
    }
  };
  game.act(guard,{kind:'talk',target:'vendor'},world);
  game.act(guard,{kind:'dialogue-choice',target:'products',token:game.view(guard,world).dialogue?.token},world);
  game.act(guard,{kind:'shop-buy',target:'baton',token:game.view(guard,world).dialogue?.token},world);
  const baton = game.view(guard,world).inventory.find(item=>item.kind==='baton')!;
  Object.assign(guard,{x:140,y:146});
  Object.assign(first,{x:148,y:146});
  Object.assign(second,{x:400,y:400});
  tick(5);
  expect(progress()).toBe(0);
  game.act(guard,{kind:'equip',item:baton.id},world);
  tick(21);
  expect(progress()).toBe(2000);
  Object.assign(first,{x:400,y:400});
  Object.assign(second,{x:148,y:146});
  tick(1);
  expect(progress()).toBe(0);
  tick(20);
  expect(progress()).toBe(2000);
  expect(game.act(guard,{kind:'attack'},world)).toBeUndefined();
  expect(progress()).toBe(0);
  tick(25);
  expect(progress()).toBeGreaterThan(0);
  game.leave(guard,world,false);
  expect(progress()).toBe(0);
  tick(100);
  expect(progress()).toBe(9900);
  tick(1);
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'segurancaParlamentar',current:10_000}));
});

test('Reunião de Alto Nível needs a live VIP plaque and both players inside its area',()=>{
  const players:Player[] = ['a','b'].map(id=>({id,nick:id,character:0,direction:0,moving:false,...npcs.credentialsVendor.interaction}));
  const [host,guest] = players;
  const game = new Gameplay();
  const options = {...metrics,hasAgendaDecoration:(kind:Parameters<Gameplay['hasAgendaDecoration']>[1])=>game.hasAgendaDecoration(host.id,kind)};
  const agenda = new PersonalAgenda(options,2,()=>0,()=>{});
  const draw = ()=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['reuniaoVip','cafe','passeio','selfieSolo']);
    agenda.updateEligibility(options,2,true,3,0,[{id:guest.id,name:guest.nick}]);
    return agenda.hasActive('reuniaoVip');
  };
  const world:GameplayWorld = {players,now:1,voice:()=>false,office:()=>undefined,earn:()=>{},spend:()=>true,
    hasMission:(id,kind)=>id===host.id && agenda.hasActive(kind),publish:event=>{
      if (agenda.acceptGameplayEvent(event)) agenda.applyGameplayEvent(options,event,false);
    }};
  expect(draw()).toBe(false);
  expect(buyCredentialGood(game,host,'vip',world)).toContain('inventário');
  const plate = game.view(host,world).inventory.find(item=>item.kind==='vip')!;
  const point = installationSites.technicalVip.point;
  Object.assign(host,point);
  expect(game.act(host,{kind:'install',place:'technicalVip',item:plate.id},world)).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  expect(draw()).toBe(true);
  const current = ()=>agenda.view(options).active.find(mission=>mission.kind==='reuniaoVip')?.current;
  const tick = (count:number)=>{
    for (let i=0;i<count;i++) {
      world.now += 100;
      game.tick(world,true);
    }
  };
  Object.assign(guest,{...point,x:point.x+13});
  tick(20);
  expect(current()).toBe(0);
  Object.assign(guest,{...point,x:point.x+8});
  tick(61);
  expect(current()).toBe(6000);
  expect(game.act(host,{kind:'uninstall',item:plate.id},world)).toBe('Objeto retirado.');
  tick(1);
  expect(current()).toBe(0);
  expect(game.act(host,{kind:'install',place:'technicalVip',item:plate.id},world)).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  tick(150);
  expect(current()).toBe(14900);
  tick(1);
  expect(agenda.view(options).completed).toContainEqual(expect.objectContaining({kind:'reuniaoVip',current:15_000}));
});

test('archive duty requires continuous time and restarts on disconnect',()=>{
  const player:Player = {id:'a',nick:'A',x:511,y:65,moving:false,direction:0,character:0};
  const xp:number[] = [];
  const agenda = new PersonalAgenda(metrics,1,()=>0,reward=>xp.push(reward.xp));
  const game = new Gameplay();
  const world:GameplayWorld = {players:[player],now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    hasMission:(_id,kind)=>agenda.hasActive(kind),publish:entry=>recordAgendaEvent(agenda,entry)};
  const tick = (count:number)=>{
    for (let i=0;i<count;i++) {
      world.now += 100;
      game.tick(world,true);
    }
  };
  const progress = ()=>agenda.view(metrics).active.find(mission=>mission.kind==='plantaoArquivo')?.current;
  tick(310);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['plantaoArquivo','cafe','passeio','selfieSolo']);
  agenda.updateEligibility(metrics,1,true,3);
  expect(progress()).toBe(0);
  tick(11);
  expect(progress()).toBe(1000);
  player.y = 140;
  tick(1);
  expect(progress()).toBe(0);
  player.y = 65;
  tick(5);
  expect(progress()).toBe(400);
  game.leave(player,world,false);
  expect(progress()).toBe(0);
  tick(300);
  expect(progress()).toBe(29_900);
  tick(10);
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'plantaoArquivo',current:30_000}));
  expect(xp).toEqual([25]);
});

test('the VIP mission requires an installed plaque rather than just buying it',()=>{
  const player:Player = {id:'a',nick:'A',...npcs.credentialsVendor.interaction,moving:false,direction:0,character:0};
  const rewards:number[] = [];
  const agenda = new PersonalAgenda(metrics,1,()=>0,reward=>rewards.push(reward.xp));
  const draw = (options:typeof metrics)=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['privilegioAdquirido','cafe','passeio','selfieSolo']);
    agenda.updateEligibility(options,1,true,3);
    return agenda.hasActive('privilegioAdquirido');
  };
  expect(draw({...metrics,wallet:0})).toBe(false);
  expect(draw(metrics)).toBe(true);
  const game = new Gameplay();
  const world:GameplayWorld = {players:[player],now:1,voice:()=>false,office:()=>undefined,
    spend:()=>true,earn:()=>{},publish:entry=>recordAgendaEvent(agenda,entry)};
  expect(buyCredentialGood(game,player,'vip',world)).toContain('inventário');
  const [plate] = game.view(player,world).inventory;
  expect(game.act(player,{kind:'install',place:'technicalVip',item:plate.id},world)).toBe('Aproxime-se do local.');
  expect(rewards).toEqual([]);
  Object.assign(player,installationSites.technicalVip.point);
  expect(game.act(player,{kind:'install',place:'technicalVip',item:plate.id},world)).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  expect(game.act(player,{kind:'install',place:'technicalVip',item:plate.id},world)).toBe('Objeto indisponível.');
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'privilegioAdquirido'}));
  expect(rewards).toEqual([25]);
  agenda.progress(metrics,{cafe:1});
  const beforeReinstall = [...rewards];
  expect(draw(metrics)).toBe(true);
  expect(game.act(player,{kind:'uninstall',item:plate.id},world)).toBe('Objeto retirado.');
  world.now++;
  expect(game.act(player,{kind:'install',place:'technicalVip',item:plate.id},world)).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  expect(rewards).toEqual(beforeReinstall);
});

test('an exchange counts accepted different items with the same human and rewards each peer once',()=>{
  const players:Player[] = ['a','b','c'].map(id=>({id,nick:id,moving:false,direction:0,character:0,...npcs.credentialsVendor.interaction}));
  const [owner,peer,other] = players;
  const rewards:number[] = [];
  const agenda = new PersonalAgenda(metrics,1,()=>0,reward=>rewards.push(reward.xp));
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['amizadeInstitucional','cafe','passeio','selfieSolo']);
  const contacts = players.slice(1).map(({id,nick:name})=>({id,name}));
  agenda.updateEligibility(metrics,1,true,3);
  expect(agenda.hasActive('amizadeInstitucional')).toBe(false);
  Reflect.set(agenda,'missions',[]);
  agenda.updateEligibility(metrics,3,true,3,0,contacts);
  expect(agenda.hasActive('amizadeInstitucional')).toBe(true);
  const game = new Gameplay();
  const world:GameplayWorld = {players,now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    publish:entry=>{if (entry.actor===owner.id) recordAgendaEvent(agenda,entry);}};
  const give = (from:Player,to:Player,kind:'portrait'|'document',reply:'accept'|'decline'='accept')=>{
    world.now++;
    const item = game.view(from,world).inventory.find(item=>item.kind===kind)!;
    expect(game.act(from,{kind:'offer',item:item.id,target:to.id},world)).toBe('Pedido enviado.');
    const request = game.view(to,world).requests.at(-1)!.id;
    expect(game.act(to,{kind:reply,item:request},world)).toBe(reply==='accept'?'Objeto recebido.':'Pedido recusado.');
    expect(game.act(to,{kind:'accept',item:request},world)).toBe('Pedido indisponível.');
  };
  for (const player of [peer,other]) {
    Object.assign(player,terminals.secretary.point);
    game.act(player,{kind:'supply',place:'secretary',target:'queue'},world);
    Object.assign(player,npcs.credentialsVendor.interaction);
  }
  world.spend = ()=>true;
  expect(buyCredentialGood(game,owner,'portrait',world)).toBe('Compra guardada no inventário.');
  give(owner,peer,'portrait');
  give(peer,owner,'portrait');
  give(other,owner,'document');
  give(peer,owner,'document','decline');
  expect(rewards).toEqual([]);
  give(peer,owner,'document');
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'amizadeInstitucional'}));
  expect(rewards).toEqual([35]);
  agenda.updateEligibility(metrics,2,true,3,0,[contacts[0]]);
  expect(agenda.hasActive('amizadeInstitucional')).toBe(false);
});

test('Cafezinho counts only articulation and public tours exclude isolated and private areas',()=>{
  const player:Player = {id:'a',nick:'A',x:240,y:210,moving:false,direction:0,character:0};
  const agenda = new PersonalAgenda(metrics,1,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['pausaCafe','passeio','selfieSolo']);
  agenda.updateEligibility(metrics,1,true,3);
  const game = new Gameplay();
  const world:GameplayWorld = {players:[player],now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
    hasMission:(_id,kind)=>agenda.hasActive(kind),publish:entry=>recordAgendaEvent(agenda,entry),plenary:true};
  const current = (kind:'pausaCafe'|'passeio')=>agenda.view(metrics).active.find(mission=>mission.kind===kind)?.current;
  game.tick(world,true);
  world.now += 100;
  game.tick(world,true);
  expect(current('pausaCafe')).toBe(0);
  world.plenary = false;
  world.now += 100;
  game.tick(world,true);
  expect(current('pausaCafe')).toBe(100);
  for (const place of [privateOffices[0].name,'Sala de Isolamento','Arquivo','Arquivo','Biblioteca','Cafezinho']) {
    recordAgendaEvent(agenda,event('room-entered',{place,at:++world.now}));
    if (place===privateOffices[0].name || place==='Sala de Isolamento') expect(current('passeio')).toBe(0);
    if (place==='Arquivo') expect(current('passeio')).toBe(1);
  }
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'passeio',current:3}));
});

test('Solenidade de Inauguração credits only a newly installed portrait marked by another player',()=>{
  const players:Player[] = ['a','b'].map(id=>({id,nick:id,moving:false,direction:0,character:0,...npcs.credentialsVendor.interaction}));
  const [visitor,owner] = players;
  const rewards:number[] = [];
  const agenda = new PersonalAgenda(metrics,2,()=>0,reward=>rewards.push(reward.xp));
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['solenidadeInauguracao','cafe','passeio','selfieSolo']);
  agenda.updateEligibility(metrics,2,true,3,0,[{id:owner.id,name:owner.nick}]);
  expect(agenda.hasActive('solenidadeInauguracao')).toBe(true);
  const game = new Gameplay();
  const world:GameplayWorld = {players,now:1,voice:()=>false,office:()=>undefined,earn:()=>{},spend:()=>true,
    publish:entry=>{if (entry.actor===visitor.id) recordAgendaEvent(agenda,entry);}};
  expect(buyCredentialGood(game,owner,'portrait',world)).toContain('inventário');
  const [portrait] = game.view(owner,world).inventory;
  for (const player of players) Object.assign(player,installationSites.hall.point);
  const install = ()=>game.act(owner,{kind:'install',place:'hall',item:portrait.id},world);
  expect(install()).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  expect(game.hasAgendaDecoration(visitor.id,'freshForeignPortrait',false,world.now)).toBe(true);
  expect(game.hasAgendaDecoration(owner.id,'freshForeignPortrait',false,world.now)).toBe(false);
  expect(game.act(owner,{kind:'mark',item:portrait.id},world)).toBe('Este retrato não pode ser rabiscado.');
  world.now += 60_000;
  expect(game.expireRecentPortraits(world.now)).toBe(false);
  world.now++;
  expect(game.expireRecentPortraits(world.now)).toBe(true);
  expect(game.expireRecentPortraits(world.now)).toBe(false);
  expect(game.hasAgendaDecoration(visitor.id,'freshForeignPortrait',false,world.now)).toBe(false);
  expect(game.act(visitor,{kind:'mark',item:portrait.id},world)).toBe('Retrato rabiscado.');
  expect(rewards).toEqual([]);
  expect(game.act(owner,{kind:'uninstall',item:portrait.id},world)).toBe('Objeto retirado.');
  expect(install()).toBe('Instalando decoração…');
  world.now += decorationInstallMs;
  game.tick(world,true);
  world.now++;
  expect(game.act(visitor,{kind:'mark',item:portrait.id},world)).toBe('Retrato rabiscado.');
  expect(game.act(visitor,{kind:'mark',item:portrait.id},world)).toBe('Este retrato não pode ser rabiscado.');
  expect(rewards).toEqual([30]);
});

test('campaign spending is offered only when enough remaining broadcasts can reach the target',()=>{
  let slots = 2;
  const options = {...metrics,remainingAdvertisements:()=>slots};
  const agenda = new PersonalAgenda(options,1,()=>0,()=>{});
  const draw = ()=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['investimentoPolitico','cafe','passeio','selfieSolo']);
    agenda.updateEligibility(options,1,true,3);
    return agenda.hasActive('investimentoPolitico');
  };
  expect(draw()).toBe(false);
  slots = 3;
  expect(draw()).toBe(true);
  slots = 2;
  agenda.updateEligibility(options,1,true,3);
  expect(agenda.hasActive('investimentoPolitico')).toBe(false);
  expect(agenda.view(options).active).toHaveLength(3);
});

test('a furniture basket accounts for the subsidy already used by its first purchase',()=>{
  let publicBudget = .8;
  const state = {wallet:2.4,popularity:40,officeStock:()=>['officeRug','officeChair'] as const,
    commerce:()=>({policies:{furniture:120_000},publicBudget})};
  const agenda = new PersonalAgenda(state,1,()=>0,()=>{});
  const draw = ()=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['doisMoveis','ostentacao','cafe','passeio','selfieSolo']);
    agenda.updateEligibility(state,1,true,3);
    return agenda.view(state).active.map(mission=>mission.kind);
  };
  expect(draw()).not.toContain('doisMoveis');
  publicBudget = 1.6;
  const discounted = draw();
  expect(discounted).toContain('doisMoveis');
  expect(discounted).not.toContain('ostentacao');
});

test('equipment and mail missions follow their own current subsidy and fee',()=>{
  let publicBudget = 0;
  const state = {wallet:1.2,popularity:40,owns:()=>false,commerce:()=>({
    policies:{equipment:120_000,mail:120_000},publicBudget,
  })};
  const agenda = new PersonalAgenda(state,2,()=>0,()=>{});
  const draw = (kind:'equipamento'|'varredura'|'mensagemComAnexo')=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',[kind,'cafe','passeio','selfieSolo']);
    agenda.updateEligibility(state,2,true,3,0,[{id:'b',name:'Bia'}]);
    return agenda.hasActive(kind);
  };
  expect(draw('mensagemComAnexo')).toBe(true);
  expect(draw('equipamento')).toBe(false);
  expect(draw('varredura')).toBe(false);
  publicBudget = .8;
  expect(draw('equipamento')).toBe(true);
  expect(draw('varredura')).toBe(true);
});

test.each([true,false])('office visits preserve credit only if another distinct office is reachable, credited owner leaves=%s',creditedOwnerLeaves=>{
  const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
  const targets = [{id:'b',name:'Bia'},{id:'c',name:'Caio'},{id:'d',name:'Duda'}];
  const state = {...metrics,hasOffice:(id?:string)=>id!=='d'};
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['visitaDoisGabinetes','cafe','passeio','selfieSolo']);
  const refresh = (contacts:typeof targets)=>agenda.updateEligibility(state,contacts.length+1,true,3,0,contacts);
  refresh(targets);
  const active = ()=>agenda.view(state).active.find(mission=>mission.kind==='visitaDoisGabinetes');
  const visit = (id:string,at:number)=>recordAgendaEvent(agenda,event('room-entered',{target:id,place:'Gabinete',at}));
  expect(active()?.current).toBe(0);
  visit('d',1);
  expect(active()?.current).toBe(0);
  visit('b',2);
  visit('b',3);
  expect(active()?.current).toBe(1);
  refresh(targets.filter(({id})=>id!==(creditedOwnerLeaves ? 'b' : 'c')));
  if (creditedOwnerLeaves) {
    expect(active()?.current).toBe(1);
    visit('c',4);
    expect(agenda.view(state).completed).toContainEqual(expect.objectContaining({kind:'visitaDoisGabinetes',current:2}));
  } else {
    expect(active()).toBeUndefined();
    expect(agenda.view(state).active).toHaveLength(3);
  }
});

test('a signature objective replaces itself if its only remaining signers already signed',()=>{
  const agenda = new PersonalAgenda(metrics,3,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['comissaoImprovisada','cafe','passeio','selfieSolo']);
  const humans = [{id:'b',name:'Bia'},{id:'c',name:'Caio'}];
  const npcs = new Set(['npc']);
  agenda.updateEligibility(metrics,3,true,3,1,humans,undefined,npcs);
  expect(agenda.hasActive('comissaoImprovisada')).toBe(true);
  agenda.recordSignature(metrics,1,'b');
  agenda.recordSignature(metrics,1,'npc');
  agenda.updateEligibility(metrics,2,true,3,1,humans.slice(0,1),undefined,npcs);
  expect(agenda.hasActive('comissaoImprovisada')).toBe(false);
  expect(agenda.view(metrics).active).toHaveLength(3);
});

test('a plenary visit requires entering and leaving during the same articulation',()=>{
  const rewards:number[] = [];
  const agenda = new PersonalAgenda(metrics,2,()=>0,reward=>rewards.push(reward.xp));
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['presencaPlenario','cafe','credencial']);
  agenda.updateEligibility(metrics,2,true,3);

  const player:Player = {id:'a',nick:'A',x:0,y:0,moving:false,direction:0,character:0};
  const game = new Gameplay();
  const world:GameplayWorld = {players:[player],now:0,voice:()=>false,office:()=>undefined,earn:()=>{},
    hasMission:(_,kind)=>agenda.hasActive(kind),publish:sample=>recordAgendaEvent(agenda,sample)};
  const [x,y,width,height] = rooms.find(room=>room.name==='Plenário')!.bounds;
  function tick(inside:boolean,exploring=true) {
    player.x = inside ? x+width/2 : 0;
    player.y = inside ? y+height/2 : 0;
    world.now += 50;
    game.tick(world,exploring);
  }

  tick(false);
  tick(true);
  tick(true,false);
  tick(false);
  expect(rewards).toEqual([]);

  tick(true);
  game.leave(player,world,false);
  tick(true);
  tick(false);
  expect(rewards).toEqual([]);

  tick(true);
  tick(false);
  expect(rewards).toEqual([25]);
  recordAgendaEvent(agenda,event('room-left',{at:world.now,place:'Plenário'}));
  expect(rewards).toEqual([25]);
});

test('phone time from separate calls cannot complete Debate Democrático',()=>{
  const rewards:number[] = [];
  const agenda = new PersonalAgenda(metrics,2,()=>0,reward=>rewards.push(reward.xp));
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['debateTelefonico','cafe','credencial']);
  agenda.updateEligibility(metrics,2,true,3,0,[{id:'b',name:'B'}]);

  const caller:Player = {id:'a',nick:'A',x:240,y:250,moving:false,direction:0,character:0};
  const peer = {...caller,id:'b',nick:'B'};
  const game = new Gameplay();
  const world:GameplayWorld = {players:[caller,peer],now:0,voice:()=>true,office:()=>undefined,earn:()=>{},
    hasMission:(id,kind)=>id===caller.id && agenda.hasActive(kind),publish:sample=>{
      if (sample.actor===caller.id) recordAgendaEvent(agenda,sample);
    }};
  function connect() {
    game.act(caller,{kind:'call',target:peer.id},world);
    expect(game.act(peer,{kind:'answer'},world)).toBe('Ligação atendida.');
  }
  function elapse(ticks:number,exploring=true) {
    for (let tick=0;tick<ticks;tick++) {
      world.now += 100;
      game.tick(world,exploring);
    }
  }

  connect();
  elapse(110);
  game.act(caller,{kind:'hangup'},world);
  connect();
  elapse(100);
  expect(agenda.view(metrics).active.find(mission=>mission.kind==='debateTelefonico')?.current).toBe(11_000);
  elapse(1,false);
  elapse(100);
  expect(rewards).toEqual([]);

  connect();
  elapse(199);
  expect(rewards).toEqual([]);
  elapse(1);
  expect(rewards).toEqual([35]);
  elapse(1);
  expect(rewards).toEqual([35]);
});

test('Bandeja Gourmet needs access to a second distinct food beyond free coffee',()=>{
  const draw = (wallet:number,owned?:'coffee'|'coxinha',hasOffice=true)=>{
    const state = {...metrics,wallet,owns:(kind:string)=>kind===owned,hasOffice:()=>hasOffice};
    const agenda = new PersonalAgenda(state,1,()=>0,()=>{});
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['bandejaGourmet','cafe','passeio','selfieSolo']);
    agenda.updateEligibility(state,1,true,3,0);
    return agenda.hasActive('bandejaGourmet');
  };
  expect(draw(0)).toBe(false);
  expect(draw(0,'coffee')).toBe(false);
  expect(draw(0,'coxinha')).toBe(true);
  expect(draw(.5)).toBe(true);
  expect(draw(.5,undefined,false)).toBe(false);
});

test('a pizza-serving mission preserves credited guests and requires enough new guests',()=>{
  const guests = ['b','c','d'].map(id=>({id,name:id}));
  const agenda = new PersonalAgenda(metrics,4,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['fatias','cafe','passeio','selfieSolo']);
  agenda.updateEligibility(metrics,4,true,3,0,guests);
  expect(agenda.hasActive('fatias')).toBe(true);
  recordAgendaEvent(agenda,event('slice',{kind:'pizza',target:'b',item:1}));
  agenda.updateEligibility(metrics,2,true,3,0,[guests[1]]);
  expect(agenda.view(metrics).active.find(mission=>mission.kind==='fatias')?.current).toBe(1);
  agenda.updateEligibility(metrics,1,true,3,0,[]);
  expect(agenda.hasActive('fatias')).toBe(false);
  expect(agenda.view(metrics).completed).toEqual([]);
});

test('one selfie cannot repeatedly pay the publication mission across channels',()=>{
  const contacts = ['b','c'].map(id=>({id,name:id}));
  const payouts:number[] = [];
  const agenda = new PersonalAgenda(metrics,3,()=>0,reward=>payouts.push(reward.xp));
  const draw = ()=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['publicouSelfie','jornalismo','cafe']);
    agenda.updateEligibility(metrics,3,true,3,0,contacts);
  };
  const photo = {...missionPhoto,people:contacts.map(contact=>({...contact,x:480,y:650,character:0,direction:0 as const}))};
  draw();
  recordAgendaEvent(agenda,event('photo-published',{photo}));
  expect(payouts).toEqual([30]);
  draw();
  recordAgendaEvent(agenda,event('photo-published',{photo,place:'internal-mail'}));
  expect(agenda.view(metrics).completed.map(row=>row.kind)).toEqual(['publicouSelfie','jornalismo']);
  expect(agenda.hasActive('publicouSelfie')).toBe(true);
  recordAgendaEvent(agenda,event('photo-published',{photo:{...photo,id:photo.id+1}}));
  expect(agenda.view(metrics).completed.filter(row=>row.kind==='publicouSelfie')).toHaveLength(2);
});

test('Escuta Ativa can be drawn with an installed, portable or affordable wiretap',()=>{
  const draw = (wallet:number,installed:boolean,owned:boolean,siteAvailable:boolean)=>{
    const state = {...metrics,wallet,ownsWiretap:()=>installed,
      owns:(kind:string)=>kind==='wiretap' && owned,canInstallSpy:(kind:string)=>kind==='wiretap' && siteAvailable};
    const agenda = new PersonalAgenda(state,1,()=>0,()=>{});
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['escutaAtiva','cafe','passeio','selfieSolo']);
    agenda.updateEligibility(state,1,true,3);
    return agenda.hasActive('escutaAtiva');
  };
  expect(draw(0,true,false,false)).toBe(true);
  expect(draw(0,false,true,true)).toBe(true);
  expect(draw(2,false,false,true)).toBe(true);
  expect(draw(1.9,false,false,true)).toBe(false);
  expect(draw(2,false,true,false)).toBe(false);
});

test('Escuta Ativa keeps its progress only while the player can still use or reinstall a wiretap',()=>{
  let installed = true;
  let owned = false;
  let available = true;
  const state = {wallet:0,popularity:40,ownsWiretap:()=>installed,owns:()=>owned,canInstallSpy:()=>available};
  const agenda = new PersonalAgenda(state,1,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['escutaAtiva','cafe','passeio','selfieSolo']);
  const refresh = ()=>agenda.updateEligibility(state,1,true,3);
  const listening = ()=>agenda.view(state).active.find(mission=>mission.kind==='escutaAtiva');
  refresh();
  recordAgendaEvent(agenda,event('wiretap-time',{duration:6_000}));
  expect(listening()?.current).toBe(6_000);

  installed = false;
  owned = true;
  refresh();
  expect(listening()?.current).toBe(6_000);
  owned = false;
  state.wallet = 2;
  refresh();
  expect(listening()?.current).toBe(6_000);
  available = false;
  refresh();
  expect(listening()).toBeUndefined();
  expect(agenda.view(state).completed).toEqual([]);
});

test('the camera mission keeps credit when the remaining distinct camera can be installed or bought',()=>{
  const options = {installed:2,uncredited:2,slots:0,portable:0};
  const state = {wallet:0,popularity:40,agendaCameras:()=>options};
  const agenda = new PersonalAgenda(state,1,()=>0,()=>{});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['duasCameras','cafe','passeio','selfieSolo']);
  const refresh = ()=>agenda.updateEligibility(state,1,true,3);
  const mission = ()=>agenda.view(state).active.find(row=>row.kind==='duasCameras');
  refresh();
  recordAgendaEvent(agenda,event('spy-viewed',{kind:'spyCamera',item:1}));
  expect(mission()?.current).toBe(1);

  Object.assign(options,{installed:1,uncredited:0,slots:1,portable:1});
  refresh();
  expect(mission()?.current).toBe(1);
  options.portable = 0;
  state.wallet = 3;
  refresh();
  expect(mission()?.current).toBe(1);
  state.wallet = 2.9;
  refresh();
  expect(mission()).toBeUndefined();
  expect(agenda.view(state).completed).toEqual([]);
});

test('a saved group selfie only opens a mission if a publication channel is still available',()=>{
  const photos = [{id:1,public:true}];
  let canMail = false;
  const state = {...metrics,agendaSelfies:()=>photos,canPublishMail:()=>canMail};
  const agenda = new PersonalAgenda(state,1,()=>0,()=>{});
  const draw = ()=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['publicouSelfie','cafe','passeio','selfieSolo']);
    agenda.updateEligibility(state,1,true,3);
    return agenda.hasActive('publicouSelfie');
  };
  expect(draw()).toBe(false);
  canMail = true;
  expect(draw()).toBe(true);
  state.wallet = 0;
  expect(draw()).toBe(false);
  photos[0].public = false;
  expect(draw()).toBe(true);
});
