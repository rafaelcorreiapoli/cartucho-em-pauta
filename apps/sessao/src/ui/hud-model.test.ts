import {cassationFee} from '../npcs';
import {publishProjectFiling} from '../../server/project-test-fixture';
import {Gameplay} from '../../server/Gameplay';
import {expect,test} from 'bun:test';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {PoliticalEconomy} from '../../server/PoliticalEconomy';
import {AGENDA_TRANSFER_MIN,HEARING_MS,PAYMENTS_PER_ROUND,SUSPENSION_MS,missionReward} from '../politics';
import {ELECTION_RULES} from '../elections';
import type {Player} from '../map';
import {BALLOT_MS,CASSATION_NOTICE_MS,NEGOTIATION_MS,stations} from '../plenary';
import {terminals,readGameplayAction,treasuryDeliveries} from '../gameplay';
import {stationRecharge} from '../station-recharge';
import {installationSites} from '../installations';
import {npcs} from '../npcs';
import {createHudModel} from './hud-model';
import {projectHeading} from './project-heading';
import {legislativeStationActions} from './legislative-station-actions';

const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,...terminals.coffee.point};

test('movement snapshots only notify stamina consumers when the displayed value changes',()=>{
  const hud = createHudModel();
  const updates:string[] = [];
  hud.congress.subscribe(()=>updates.push('congress'));
  hud.agenda.subscribe(()=>updates.push('agenda'));
  hud.profile.subscribe(()=>updates.push('profile'));
  const unsubscribe = hud.stamina.subscribe(()=>updates.push('stamina'));
  hud.player({...player,stamina:89.9,staminaMax:110});
  const snapshot = hud.stamina.get();
  const moved = {...player,x:player.x+10,stamina:89.1,staminaMax:110};
  hud.player(moved);
  expect(hud.stamina.get()).toBe(snapshot);
  expect(snapshot).toEqual({current:89,max:110});
  expect(updates).toEqual(['stamina']);
  unsubscribe();
  hud.player({...player,stamina:90,staminaMax:110});
  expect(updates).toEqual(['stamina']);
});

test('a server mission completion updates agenda and XP without repainting public metrics',()=>{
  const hud = createHudModel();
  const match = new PlenaryMatch(1);
  match.start(player.id,[{...player}],0,()=>0);
  const view = ()=>match.view(player.id,[player.id],0);
  hud.render(view());
  expect(hud.agenda.get()?.active.some(mission=>mission.kind==='cafe')).toBe(true);
  const updates:string[] = [];
  hud.congress.subscribe(()=>updates.push('congress'));
  hud.profile.subscribe(()=>updates.push('profile'));
  hud.agenda.subscribe(()=>updates.push('agenda'));
  expect(new Gameplay().drinkStationCoffee({...player},match.gameplayWorld([player],1,()=>false))).toBe('Café bebido.');
  hud.render(view());
  hud.render(view());
  expect(updates).toEqual(['profile','agenda']);
  expect(hud.profile.get()?.xp).toBe(20);
  expect(hud.agenda.get()?.announcement).toContain('Concluído');
  expect(hud.agenda.get()?.recent.map(mission=>mission.kind)).toEqual(['cafe']);

  const reconnected = createHudModel();
  reconnected.render(view());
  expect(reconnected.profile.get()).toEqual(hud.profile.get());
  expect(reconnected.agenda.get()?.recent).toEqual(hud.agenda.get()?.recent);
  expect(reconnected.agenda.get()?.announcement).toBe('');

  hud.render({...view(),phase:'lobby'});
  expect(hud.profile.get()).toBeUndefined();
  expect(hud.resources.get()).toBeUndefined();
  expect(hud.agenda.get()).toBeUndefined();
});

test('the television notice follows the interview lifecycle and ignores unrelated snapshots',()=>{
  const hud = createHudModel();
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>0);
  const updates:unknown[] = [];
  hud.television.subscribe(()=>updates.push(hud.television.get()));
  const view = match.view(player.id,[player.id],1);
  const election = view.election!;
  const active = {...view,election:{...election,broadcast:{id:player.id,name:player.nick,remaining:12}}};
  hud.render(active);
  hud.render({...active,budget:active.budget-1});
  expect(updates).toEqual([{name:'Rafa',remaining:12}]);
  hud.render(view);
  expect(updates).toEqual([{name:'Rafa',remaining:12},undefined]);
  hud.render(active);
  hud.render({...active,phase:'finished'});
  expect(hud.television.get()).toBeUndefined();
});

test('the central countdown follows the authoritative last 30 seconds before voting',()=>{
  const match = new PlenaryMatch(1);
  const hud = createHudModel();
  match.start(player.id,[{...player}],0,()=>0);
  publishProjectFiling(match,player);
  const render = (now:number) => hud.render(match.view(player.id,[player.id],now));
  const deadline = match.view(player.id,[player.id],0).remaining*1000;
  render(deadline-31_000);
  expect(hud.countdown.get()).toBeUndefined();
  render(deadline-30_000);
  expect(hud.countdown.get()).toEqual({kind:'bill',seconds:30});
  render(deadline-1000);
  expect(hud.countdown.get()).toEqual({kind:'bill',seconds:1});
  hud.render({...match.view(player.id,[player.id],deadline-1000),cassationIn:20});
  expect(hud.countdown.get()).toEqual({kind:'cassation',seconds:20});
  match.advance(deadline);
  render(deadline);
  expect(hud.countdown.get()).toBeUndefined();
});

test('replayed pizza installation leaves the HUD unchanged until a valid Pizzada is completed',()=>{
  const players = [player,...['bia','caio','dani'].map(id=>({...player,id,nick:id}))];
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  match.start(player.id,players,0,()=>0);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  const event = {actor:player.id,position:terminals.coffee.point,item:15,kind:'pizza'} as const;
  const installation = {...event,type:'installed',at:1} as const;
  const serve = (at:number)=>{
    for (const [index,target] of ids.slice(1).entries()) {
      economy.recordGameplay({...event,type:'slice',target,at:at+index,witnesses:[]});
    }
  };
  economy.recordGameplay({...installation,witnesses:[]});
  economy.recordOfficialScandal();
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['pizzada','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();

  const hud = createHudModel();
  const render = ()=>hud.render(match.view(player.id,ids,0));
  render();
  const previous = hud.agenda.get();
  expect(previous?.active).toContainEqual(expect.objectContaining({kind:'pizzada',current:0}));
  const xp = hud.profile.get()?.xp ?? 0;
  let agendaUpdates = 0;
  hud.agenda.subscribe(()=>agendaUpdates++);

  economy.recordGameplay({...installation,witnesses:[]});
  serve(2);
  render();
  expect(hud.agenda.get()).toBe(previous);
  expect(hud.profile.get()?.xp).toBe(xp);
  expect(agendaUpdates).toBe(0);

  economy.recordGameplay({...installation,at:10,witnesses:[]});
  serve(11);
  render();
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'pizzada',current:3}));
  expect(hud.profile.get()?.xp).toBe(xp+missionReward('pizzada').xp);
  expect(agendaUpdates).toBe(1);
});

test('the HUD preserves Pizzada progress after a served guest leaves the match',()=>{
  const host = {...player,...npcs.snackVendor.interaction};
  const guests = ['bia','caio','dani'].map(id=>({...player,...installationSites.pizza.point,id,nick:id}));
  const players = [host,...guests];
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  match.start(host.id,players,0,()=>0);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  const world = (now:number)=>match.gameplayWorld(players,now,()=>false);
  match.setAgendaInventory(()=>false,undefined,undefined,undefined,undefined,id=>game.installedPizza(id));
  economy.recordOfficialScandal();
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['pizzada','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();

  game.act(host,{kind:'talk',target:'snackVendor'},world(1));
  game.act(host,{kind:'dialogue-choice',target:'products',token:game.view(host,world(1)).dialogue?.token},world(1));
  game.act(host,{kind:'shop-buy',target:'pizza',token:game.view(host,world(2)).dialogue?.token},world(2));
  const [pizza] = game.view(host,world(2)).inventory;
  Object.assign(host,installationSites.pizza.point);
  game.act(host,{kind:'install',place:'pizza',item:pizza.id},world(3));
  expect(game.act(guests[0],{kind:'slice',item:pizza.id},world(4))).toBe('Fatia servida.');

  const hud = createHudModel();
  match.leave(guests[0].id,5);
  const remainingIds = ids.filter(id=>id!==guests[0].id);
  hud.render(match.view(host.id,remainingIds,5));
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'pizzada',current:1}));
  const xp = hud.profile.get()?.xp ?? 0;
  for (const [index,guest] of guests.slice(1).entries()) {
    expect(game.act(guest,{kind:'slice',item:pizza.id},world(6+index))).toBe('Fatia servida.');
  }
  hud.render(match.view(host.id,remainingIds,8));
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'pizzada',current:3}));
  expect(hud.profile.get()?.xp).toBe(xp+missionReward('pizzada').xp);
});

test('the HUD preserves completed coffee deliveries when a recipient leaves',()=>{
  const host = {...player};
  const recipients = ['bia','caio','dani'].map(id=>({...player,id,nick:id}));
  const players = [host,...recipients];
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  match.start(host.id,players,0,()=>0);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['entrega','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();

  let now = 0;
  const deliver = (guest:Player)=>{
    now += stationRecharge.coffee.duration;
    const world = match.gameplayWorld(players,now,()=>false);
    expect(game.act(host,{kind:'supply',place:'coffee'},world)).toBe('Objeto guardado no inventário.');
    const coffee = game.view(host,world).inventory.find(item=>item.kind==='coffee')!;
    expect(game.act(host,{kind:'offer',item:coffee.id,target:guest.id},world)).toBe('Pedido enviado.');
    const request = game.view(guest,world).requests[0];
    expect(game.act(guest,{kind:'accept',item:request.id},world)).toBe('Objeto recebido.');
  };

  const hud = createHudModel();
  deliver(recipients[0]);
  match.leave(recipients[0].id,++now);
  const present = ids.filter(id=>id!==recipients[0].id);
  hud.render(match.view(host.id,present,now));
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'entrega',current:1,target:3}));
  const xp = hud.profile.get()?.xp ?? 0;
  deliver(recipients[1]);
  deliver(recipients[2]);
  hud.render(match.view(host.id,present,now));
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'entrega',current:3,target:3}));
  expect(hud.profile.get()?.xp).toBe(xp+missionReward('entrega').xp);
});

test('the HUD replaces a credited voting mission without offering it again on the last ballot',()=>{
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>0);
  publishProjectFiling(match,player);
  Reflect.set(match,'round',2);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['votacao','apoio','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  match.advance(NEGOTIATION_MS);
  const hud = createHudModel();
  const render = ()=>hud.render(match.view(player.id,[player.id],NEGOTIATION_MS+1));
  render();
  expect(hud.agenda.get()?.active.map(mission=>mission.kind)).toContain('votacao');
  match.vote(player.id,'no',NEGOTIATION_MS+1);
  render();
  expect(hud.agenda.get()?.recent.map(mission=>mission.kind)).toContain('votacao');
  expect(hud.agenda.get()?.active.map(mission=>mission.kind)).not.toContain('votacao');
  expect(hud.agenda.get()?.active.map(mission=>mission.kind)).toContain('apoio');
});

test('the HUD receives multiple deposits of the same cash lot in one server tick',()=>{
  const match = new PlenaryMatch(1);
  const depositor = {...player,...terminals.treasury.point};
  match.start(depositor.id,[depositor],0,()=>0);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(depositor.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['contribuinte','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const gameplay = new Gameplay();
  const world = {...match.gameplayWorld([depositor],10,()=>false),takeWallet:()=>5};
  gameplay.robNpc(depositor,{...depositor,id:'npc',npc:true},world);
  const hud = createHudModel();
  const render = ()=>hud.render(match.view(depositor.id,[depositor.id],10));
  const quote = (target?:string)=>treasuryDeliveries(gameplay.view(depositor,world).inventory)
    .find(option=>option.action.target===target)!.action;
  const deposit = (action:ReturnType<typeof quote>)=>gameplay.act(depositor,readGameplayAction(action)!,world);
  const originalQuote = quote('partial');
  expect(deposit(originalQuote)).toContain('R$ 25 mil');
  render();
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'contribuinte',current:2.5}));
  expect(deposit(originalQuote)).toBe('O valor da maleta mudou.');
  render();
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'contribuinte',current:2.5}));
  expect(match.economySummary(gameplay.physicalCash())).toMatchObject({treasury:2.5,physical:2.5});
  expect(deposit(quote('partial'))).toContain('R$ 12 mil');
  render();
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'contribuinte',current:3.7}));
  const xp = hud.profile.get()?.xp ?? 0;
  expect(deposit(quote())).toContain('R$ 13 mil');
  render();
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'contribuinte',current:5}));
  expect(hud.profile.get()?.xp).toBe(xp+missionReward('contribuinte').xp);
});

test('delayed gameplay from the previous match cannot affect the new HUD',()=>{
  const match = new PlenaryMatch(1);
  const ids = [player.id];
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const previousWorld = match.gameplayWorld([player],1,()=>false);
  const coffee = {
    type:'used',kind:'coffee',actor:player.id,position:terminals.coffee.point,at:1,witnesses:[],
    eventId:previousWorld.nextEventId!(),
  } as const;
  const previousEvent = {...coffee,witnesses:[]};
  expect(previousWorld.publish(previousEvent)).toBe(true);
  match.leave(player.id,2);
  expect(match.start(player.id,[player],3,()=>.9)).toBe(true);

  const hud = createHudModel();
  const nextWorld = match.gameplayWorld([player],4,()=>false);
  const render = ()=>hud.render(match.view(player.id,ids,4));
  render();
  const initial = hud.agenda.get();
  const initialResources = hud.resources.get();
  const initialCongress = hud.congress.get();
  expect(initial?.active).toContainEqual(expect.objectContaining({kind:'cafe',current:0}));
  previousWorld.earn(player.id,4);
  previousWorld.earnXp!(player.id,25);
  expect(previousWorld.deposit!(player.id,3)).toBe(false);
  expect(previousWorld.spendSubsidized!(player.id,2,2)).toBe(false);
  expect(previousWorld.publish({...previousEvent,at:4,eventId:previousWorld.nextEventId!()})).toBe(false);
  expect(nextWorld.publish(previousEvent)).toBe(false);
  expect(nextWorld.publish({...previousEvent,at:4,eventId:previousWorld.nextEventId!()})).toBe(false);
  expect(nextWorld.publish({...previousEvent,at:4})).toBe(false);
  render();
  expect(hud.agenda.get()).toBe(initial);
  expect(hud.resources.get()).toBe(initialResources);
  expect(hud.congress.get()).toBe(initialCongress);
  expect(hud.profile.get()?.xp).toBe(0);

  expect(new Gameplay().drinkStationCoffee({...player},match.gameplayWorld([player],4,()=>false))).toBe('Café bebido.');
  render();
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'cafe'}));
  expect(hud.profile.get()?.xp).toBe(missionReward('cafe').xp);
});

test('the megaphone notice follows the phase and the anonymous snapshot flag',()=>{
  const match = new PlenaryMatch(1);
  const ids = [player.id];
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  publishProjectFiling(match,player);
  const hud = createHudModel();
  const notify = (view:ReturnType<PlenaryMatch['view']>)=>hud.render({...view,megaphoneActive:true});
  const updates:boolean[] = [];
  hud.broadcast.subscribe(()=>updates.push(hud.broadcast.get()));
  notify(match.view(player.id,ids,1));
  notify(match.view(player.id,ids,2));
  expect(updates).toEqual([true]);
  match.advance(NEGOTIATION_MS);
  notify(match.view(player.id,ids,NEGOTIATION_MS));
  expect(updates).toEqual([true,false]);
  expect(hud.broadcast.get()).toBe(false);
});


test('a paid NPC deal uses the transfer quota without completing the human transfer mission',()=>{
  const peer = {...player,id:'bia',nick:'Bia'};
  const npc:Player = {...player,id:'npc-parliamentarian-1',nick:'Parlamentar',npc:true};
  const players = [player,peer,npc];
  const ids = [player.id,peer.id];
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player,peer],0,()=>.9)).toBe(true);
  match.addParliamentarian(npc);
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(player.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['pagamento','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const hud = createHudModel();
  const view = (now:number)=>match.view(player.id,ids,now);
  const initial = view(0).politics!;
  hud.render(view(0));
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'pagamento'}));

  const world = match.gameplayWorld(players,1,()=>false);
  expect(world.payNpc?.(player.id,npc.id,AGENDA_TRANSFER_MIN)).toBe(true);
  const paid = view(1);
  expect(paid.politics).toMatchObject({
    wallet:initial.wallet-AGENDA_TRANSFER_MIN,paymentsLeft:initial.paymentsLeft-1,
  });
  hud.render(paid);
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'pagamento',current:0}));
  expect(hud.profile.get()?.xp).toBe(0);

  expect(match.politics(player,{kind:'transfer',to:peer.id,amount:AGENDA_TRANSFER_MIN},players,2)).toBe(true);
  hud.render(view(2));
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'pagamento'}));
  expect(hud.profile.get()?.xp).toBe(missionReward('pagamento').xp);
});

test('transfer mission eligibility follows isolation and the remaining quota of distinct senders',()=>{
  const players = [player,...['bia','caio'].map(id=>({...player,id,nick:id}))];
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,players,0,()=>.9)).toBe(true);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  const hud = createHudModel();
  const draw = (now:number)=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['pagamento','doisPix','cafe','passeio','selfieSolo']);
    match.refreshAgendaEligibility(now);
    hud.render(match.view(player.id,ids,now));
    return hud.agenda.get()?.active.map(mission=>mission.kind);
  };
  expect(draw(0)).toContain('pagamento');
  expect(hud.agenda.get()?.active.some(mission=>mission.kind==='doisPix')).toBe(true);

  economy.suspend(player.id,SUSPENSION_MS);
  expect(draw(1)).toEqual(['cafe','passeio','selfieSolo']);
  expect(match.politics(players[1],{kind:'transfer',to:player.id,amount:1},players,1)).toBe(false);
  expect(match.politics(player,{kind:'transfer',to:players[1].id,amount:AGENDA_TRANSFER_MIN},players,1)).toBe(false);

  match.advance(SUSPENSION_MS);
  expect(draw(SUSPENSION_MS)).toContain('doisPix');
  for (const sender of players.slice(1)) {
    expect(match.politics(sender,{kind:'transfer',to:player.id,amount:1},players,SUSPENSION_MS+1)).toBe(true);
  }
  hud.render(match.view(player.id,ids,SUSPENSION_MS+1));
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'doisPix'}));
  expect(hud.profile.get()?.xp).toBe(missionReward('doisPix').xp);

  const [,bia,caio] = players;
  for (let payment=1;payment<PAYMENTS_PER_ROUND;payment++) {
    expect(match.politics(bia,{kind:'transfer',to:caio.id,amount:1},players,SUSPENSION_MS+2)).toBe(true);
  }
  expect(match.view(bia.id,ids,SUSPENSION_MS+2).politics).toMatchObject({wallet:2,paymentsLeft:0});
  expect(draw(SUSPENSION_MS+2)).not.toContain('doisPix');
});

test('the HUD starts a replacement Pix mission at zero after a transfer completes its predecessor',()=>{
  const recipient = {...player};
  const [bia,caio] = ['bia','caio'].map(id=>({...player,id,nick:id}));
  const players = [recipient,bia,caio];
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  expect(match.start(recipient.id,players,0,()=>.9)).toBe(true);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(recipient.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['recebido','cafe','passeio','doisPix','selfieSolo']);
  match.refreshAgendaEligibility();
  const hud = createHudModel();
  const pay = (sender:Player,now:number)=>{
    expect(match.politics(sender,{kind:'transfer',to:recipient.id,amount:1},players,now)).toBe(true);
    hud.render(match.view(recipient.id,ids,now));
  };
  pay(bia,1);
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'recebido',current:1}));
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'doisPix',current:0}));
  pay(caio,2);
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'doisPix',current:1}));
  pay(bia,3);
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'doisPix',current:2}));
  expect(hud.profile.get()?.xp).toBe(missionReward('recebido').xp+missionReward('doisPix').xp);
});

test('the HUD suppresses a project warning when cassation delays its vote past the deadline',()=>{
  const others = ['bia','caio'].map(id=>({...player,id,nick:id}));
  const players = [player,...others];
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,players,0,()=>.9)).toBe(true);
  const voteAt = ELECTION_RULES.matchDuration-BALLOT_MS;
  const filingAt = voteAt-NEGOTIATION_MS;
  publishProjectFiling(match,player,0,filingAt);

  const hearingEnd = voteAt+1;
  const hearingAt = hearingEnd-HEARING_MS;
  const noticeAt = hearingAt-CASSATION_NOTICE_MS;
  match.gameplayWorld([],0,()=>false).earn(player.id,cassationFee);
  expect(match.callCassation({...player,...stations.audit},noticeAt)).toBeUndefined();
  const hud = createHudModel();
  hud.render(match.view(player.id,ids,noticeAt));
  expect(hud.countdown.get()).toEqual({kind:'cassation',seconds:30});
  match.advance(hearingAt);
  expect(match.phase).toBe('hearing');
  match.advance(hearingEnd);
  expect(match.phase).toBe('negotiation');
  const view = match.view(player.id,ids,hearingEnd);
  expect(view.project).toBe(0);
  expect(view.projectWarning).toBeUndefined();
  expect(view.ballotCountdown).toBeUndefined();
  expect(view.projectVoteExpired).toBe(true);
  expect(legislativeStationActions(view,'panel')).toEqual([]);
  match.declareVote(player.id,'yes',hearingEnd);
  const afterAttempt = match.view(player.id,ids,hearingEnd);
  expect(afterAttempt.voteIntents).toEqual([]);
  expect(afterAttempt.politics!.progression.xp).toBe(view.politics!.progression.xp);
  expect(projectHeading(view)).toMatchObject({
    title:'Auxílio Churrasco',clockLabel:'Fim da sessão',seconds:35,hint:'Sem votação nesta sessão.',
  });
  match.advance(hearingEnd+1);
  expect(match.phase).toBe('negotiation');
  hud.render(view);
  expect(hud.countdown.get()).toBeUndefined();
});

test('delayed work cannot change the final Agenda, XP, wallet or budget',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const deadline = ELECTION_RULES.matchDuration;
  const pending = match.gameplayWorld([player],deadline-1,()=>false);
  const coffee = {
    type:'used',kind:'coffee',actor:player.id,at:deadline-1,position:player,witnesses:[],eventId:pending.nextEventId!(),
  } as const;
  match.advance(deadline);
  expect(match.phase).toBe('finished');
  const view = ()=>match.view(player.id,[player.id],deadline);
  const final = view();
  const hud = createHudModel();
  hud.render(final);
  const agenda = hud.agenda.get();
  const resources = hud.resources.get();
  const congress = hud.congress.get();

  const finished = match.gameplayWorld([player],deadline,()=>false);
  for (const world of [pending,finished]) {
    expect(world.publish({...coffee,witnesses:[]})).toBe(false);
    expect(world.spend!(player.id,1)).toBe(false);
    expect(world.spendSubsidized!(player.id,1,1)).toBe(false);
    expect(world.settleBet!(player.id,1,2,2)).toBe(false);
    world.earn(player.id,1);
    world.earnXp!(player.id,20);
  }
  expect(view().politics).toEqual(final.politics);
  expect(view().budget).toBe(final.budget);
  hud.render(view());
  expect(hud.agenda.get()).toBe(agenda);
  expect(hud.resources.get()).toBe(resources);
  expect(hud.congress.get()).toBe(congress);
});
