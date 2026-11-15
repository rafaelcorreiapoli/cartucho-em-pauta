import { stationRecharge } from '../src/station-recharge';
import { installationSites } from '../src/installations';
import { expect, test } from 'bun:test';
import { Gameplay } from './Gameplay';
import { PersonalAgenda } from './PersonalAgenda';
import { Parliamentarians } from './Parliamentarians';
import { PoliticalEconomy } from './PoliticalEconomy';
import type { GameplayWorld } from './gameplay-world';
import { terminals, type GameplayEvent } from '../src/gameplay';
import type { Player } from '../src/map';
import { decorPoint, officeGoods, privateOffices } from '../src/private-offices';
import { npcs } from '../src/npcs';
import { agendaDurationMs } from '../src/politics';

const metrics = {wallet:8,popularity:40};

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
  Reflect.set(ownerAgenda,'missionDeck',['assinaturas','cafe','passeio']);
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

test.each(['documentoAlvo','pizzaAlvo','dinheiroAlvo','visitaAlvo','selfieAlvo'] as const)(
  '%s completes only after the corresponding gameplay with the assigned person',
  kind=>{
    const economy = new PoliticalEconomy();
    const players:Player[] = ['a','b','c'].map((id,character)=>({
      id,nick:character===0 ? 'Autora' : 'Mesmo nome',character,x:140,y:146,direction:0,moving:false,
    }));
    const [owner,target,other] = players;
    economy.reset(players.map(({id,nick:name,character})=>({id,name,character})),()=>0);
    const agenda = Reflect.get(economy,'accounts').get(owner.id).agenda as PersonalAgenda;
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',[kind,'cafe','passeio']);
    economy.updateAgendaEligibility(new Set(players.map(player=>player.id)),3);
    const missions = () => economy.view(owner.id,[],0,false,()=>true)!.missions;
    expect(missions().active.find(mission=>mission.kind===kind)?.person?.id).toBe(target.id);

    const game = new Gameplay();
    game.reset(0,()=>.5,players,()=>.5);
    const world:GameplayWorld = {players,now:1,voice:()=>false,office:()=>undefined,earn:()=>{},
      spend:(id,amount)=>economy.spend(id,amount),publish:entry=>economy.recordGameplay(entry)};
    const interact = (recipient:Player) => {
      const third = recipient===target ? other : target;
      Object.assign(third,{x:800,y:490});
      world.now += 3_000;
      if (kind==='dinheiroAlvo') {
        expect(economy.transfer(owner.id,recipient.id,3,true,0)).toBe(true);
        return;
      }
      if (kind==='visitaAlvo') {
        Object.assign(owner,{x:140,y:146});
        game.tick(world,true);
        Object.assign(owner,game.officeSpawn(recipient.id));
        game.tick(world,true);
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
  expect(game.act(player,{kind:'office-install',place:layout.id,item:installed.id},world)).toBe('Decoração instalada.');
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
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,...terminals.credentials.point};
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
  expect(game.act(player,{kind:'buy',target:'portrait'},world)).toContain('inventário');
  expect(economy.spend(player.id,6)).toBe(true);
  expect(draw()).toEqual(['retrato','cafe','passeio']);
  const portrait = game.view(player,world).inventory.find(item=>item.kind==='portrait')!;
  Object.assign(player,installationSites.hall.point);
  expect(game.act(player,{kind:'install',place:'hall',item:portrait.id},world)).toBe('Objeto instalado.');
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
  const players:Player[] = ['a','b','c'].map(id=>({id,nick:id,character:0,direction:0,moving:false,...terminals.credentials.point}));
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
  const install = (player:Player, place:'hall'|'coffeeVip') => {
    const {kind,point} = installationSites[place];
    expect(game.act(player,{kind:'buy',target:kind},world)).toContain('inventário');
    const item = game.view(player,world).inventory.find(item=>item.kind===kind)!;
    Object.assign(player,point);
    expect(game.act(player,{kind:'install',place,item:item.id},world)).toBe('Objeto instalado.');
  };

  expect(draw()).toContain('autorretrato');
  expect(draw()).not.toContain('fiscalVip');
  expect(draw(true)).toEqual(['cafe','passeio','selfieSolo']);
  install(owner,'hall');
  expect(economy.spend(owner.id,6)).toBe(true);
  install(colleague,'coffeeVip');
  expect(draw()).toEqual(['autorretrato','fiscalVip','cafe']);
  expect(game.act(owner,{kind:'selfie'},world)).toBe('Foto guardada no álbum.');
  expect(economy.view(owner.id,[],0,false,()=>true)?.missions.completed.some(mission=>mission.kind==='autorretrato')).toBe(true);
  Object.assign(owner,installationSites.coffeeVip.point);
  Object.assign(colleague,installationSites.coffeeVip.point);
  world.now += 5_000;
  expect(game.act(owner,{kind:'photo'},world)).toBe('Foto guardada no álbum.');
  const completedVip = () => economy.view(owner.id,[],0,false,()=>true)?.missions.completed.some(mission=>mission.kind==='fiscalVip');
  expect(completedVip()).toBe(false);
  Object.assign(visitor,installationSites.coffeeVip.point);
  world.now += 5_000;
  expect(game.act(owner,{kind:'photo'},world)).toBe('Foto guardada no álbum.');
  expect(completedVip()).toBe(true);
  expect(economy.transfer(colleague.id,owner.id,1,false,0)).toBe(true);
  expect(draw(true)).toContain('mandaVip');
  expect(draw(true)).not.toContain('reforma');
  Object.assign(owner,installationSites.coffeeVip.point);
  const vip = game.view(owner,world).interactive.find(item=>item.kind==='vip')!;
  expect(game.act(owner,{kind:'uninstall',item:vip.id},world)).toBe('Objeto retirado.');
  expect(draw(true)).toContain('mandaVip');
  expect(game.act(owner,{kind:'install',place:'coffeeVip',item:vip.id},world)).toBe('Objeto instalado.');
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
  const players:Player[] = Array.from({length:8},(_,i)=>({id:String(i),nick:String(i),character:0,direction:0,moving:false,...terminals.credentials.point}));
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
  game.act(owner,{kind:'supply',place:'secretary',target:'queue'},world);
  const [document] = game.view(owner,world).inventory;
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
  deliver(caio);
  expect(active().active.find(({kind})=>kind==='entrega')?.current).toBe(2);
  deliver(dani);
  expect(active().completed).toContainEqual(expect.objectContaining({kind:'entrega',current:3,target:3}));
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
  Reflect.set(agenda,'missionDeck',[kind,'passeio','credencial']);
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
  Reflect.set(agenda,'missionDeck',['turismo','cafe','credencial']);
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
  Reflect.set(agenda,'missionDeck',['chamadasUrgentes','cafe','credencial']);
  agenda.updateEligibility(metrics,3,true,3,0,[{id:'b',name:'B'},{id:'c',name:'C'}]);
  for (const [at,target,item,duration] of [[1,'b',1,9_900],[2,'b',2,100],[3,'b',1,100],[4,'b',3,10_000],[5,'c',4,10_000]] as const) {
    const sample = event('call-time',{at,target,item,duration});
    recordAgendaEvent(agenda,sample);
    recordAgendaEvent(agenda,sample);
    if (at<5) expect(agenda.view(metrics).active.find(mission=>mission.kind==='chamadasUrgentes')?.current).toBe(at<3 ? 0 : 1);
  }
  expect(agenda.view(metrics).completed).toContainEqual(expect.objectContaining({kind:'chamadasUrgentes',current:2}));
});

test.each([
  ['pixVinte',event('pix-sent',{amount:2,target:'b'}),event('pix-sent',{amount:1,target:'b',at:2})],
  ['debateTelefonico',event('call-time',{duration:20_000,target:'b'}),event('called',{target:'b'})],
  ['escutaAtiva',event('wiretap-time',{duration:15_000}),event('wiretap-time',{duration:0,at:2})],
  ['discursoMegafone',event('megaphone-time',{duration:10_000}),event('megaphone-started')],
  ['investimentoPolitico',event('campaign-investment',{amount:5}),event('advertisement-aired')],
  ['campanhaUltimaHora',event('campaign-investment',{duration:60_000}),event('campaign-investment',{duration:60_001,at:2})],
  ['mensagemComAnexo',event('mail-published',{place:'document'}),event('photo-published')],
  ['retratacaoOficial',event('mail-published',{place:'report'}),event('mail-published',{place:'document'})],
  ['instalarGrampo',event('spy-installed',{kind:'wiretap'}),event('spy-installed',{kind:'spyCamera'})],
  ['instalarCamera',event('spy-installed',{kind:'spyCamera'}),event('spy-installed',{kind:'wiretap'})],
  ['reuniaoGabinete',event('office-meeting-time',{duration:15_000}),event('public-meeting-time',{duration:15_000})],
  ['reuniaoPublica',event('public-meeting-time',{duration:10_000}),event('office-meeting-time',{duration:10_000})],
  ['heroiInesperado',event('fire-extinguished',{amount:29}),event('fire-extinguished',{amount:30,at:2})],
] as const)('%s validates the required event and grants XP once',(kind,valid,wrong)=>{
  const rewards:number[] = [];
  const options = {...metrics,hasForensicReport:()=>true,canInstallSpy:()=>true,canFightCrisis:()=>true,ownsWiretap:()=>true};
  const agenda = new PersonalAgenda(options,4,()=>0,reward=>rewards.push(reward.xp));
  recordAgendaEvent(agenda,{...valid,at:0});
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',[kind,'cafe','passeio','credencial']);
  agenda.updateEligibility(options,4,true,3,0,[{id:'b',name:'B'},{id:'c',name:'C'},{id:'d',name:'D'}]);
  recordAgendaEvent(agenda,wrong);
  expect(agenda.view(options).active.find(mission=>mission.kind===kind)?.current).toBe(0);
  recordAgendaEvent(agenda,valid);
  recordAgendaEvent(agenda,valid);
  expect(agenda.view(options).completed.filter(mission=>mission.kind===kind)).toHaveLength(1);
  expect(rewards).toHaveLength(1);
});
