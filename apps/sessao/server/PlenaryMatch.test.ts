import {discountedPrice,marketProduct} from '../src/market-catalog';
import {cassationFee,npcs} from '../src/npcs';
import {pinga} from '../src/food';
import {restMovement,STEP_MS} from '../src/movement';

import {publishProjectFiling} from './project-test-fixture';
import { stationRecharge } from '../src/station-recharge';
import { StationCooldowns } from './StationCooldowns';
import { InternalMail } from './InternalMail';
import {Gameplay} from './Gameplay';
import {INVENTORY_SLOTS,terminals} from '../src/gameplay';
import {privateOffices} from '../src/private-offices';
import {fireRules,fireSites} from '../src/fire';
import {powerPanels,powerRules} from '../src/power';
import { PoliticalEconomy } from './PoliticalEconomy';
import { ELECTION_RULES, readElectionAction } from '../src/elections';
import { expect, test } from 'bun:test';
import { CRISIS_MISSION_STABILITY_LIMIT, HEARING_MS, PIX_MISSION_AMOUNT, readPoliticsAction } from '../src/politics';

import { BALLOT_MS, policyDuration, projectRules, energySavings, CASSATION_NOTICE_MS, NEGOTIATION_MS, bills, stations, stabilityRules, publicDebtStabilityLoss, publicDebtRules } from '../src/plenary';
import {movementSpeed, canStand, localPerception, characterVisible, type Player } from '../src/map';
import { findRoute } from '../src/navigation';
import { PlenaryMatch } from './PlenaryMatch';

const ids = ['lula','bolsonaro','clodovil'];
const people = ids.map((id,character):Player => ({id,nick:['Lula','Bolsonaro','Clodovil'][character],character,x:140+36*character,y:146,direction:0,moving:false}));
const [host,honest,traitor] = people;
const at = (player:Player, station:keyof typeof stations) => ({...player,...stations[station]});

test('only the local host can opt into playing infiltrator and trigger a solo outage',()=>{
  const normal = new PlenaryMatch(1);
  expect(normal.start(host.id,[host],0,()=>.9,1,true)).toBe(true);
  expect(normal.view(host.id,[host.id],0)).toMatchObject({role:'Parlamentar'});
  expect(normal.view(host.id,[host.id],0).canSabotagePower).toBeUndefined();

  const local = new PlenaryMatch(1,undefined,true);
  expect(local.start(honest.id,people,0,()=>.9,1,true)).toBe(false);
  expect(local.start(host.id,[host],0,()=>.9,1,true)).toBe(true);
  expect(local.view(host.id,[host.id],0)).toMatchObject({role:'Infiltrado',canSabotagePower:true});
  expect(local.actOnPower({...host,...powerPanels[0]},{kind:'sabotage',panel:0},1)).toBe('Energia cortada.');
  expect(local.powerOut).toBe(true);
});

test('project ballot countdown is published during the final five seconds of negotiation',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  publishProjectFiling(match,host);
  const countdown = (now:number) => match.view(host.id,ids,now).ballotCountdown;
  expect(countdown(NEGOTIATION_MS-5001)).toBeUndefined();
  expect(countdown(NEGOTIATION_MS-5000)).toBe(5);
  expect(countdown(NEGOTIATION_MS-1)).toBe(1);
  match.advance(NEGOTIATION_MS);
  expect(match.phase).toBe('ballot');
  expect(countdown(NEGOTIATION_MS)).toBeUndefined();
});

test('fraud shows different figures until a player audits and reports it', () => {
  const match = new PlenaryMatch(1);
  expect(match.start(honest.id,people,0)).toBe(false);
  expect(match.start(host.id,[],0)).toBe(false);
  expect(match.start(host.id,people,0,() => .9)).toBe(true);
  publishProjectFiling(match,host);
  const view = (player:Player) => match.view(player.id,ids,0);
  expect(view(host).role).toBe('Parlamentar');
  expect(view(host).infiltratorName).toBeUndefined();
  expect(view(traitor)).toMatchObject({role:'Infiltrado',canFraud:true});
  expect(view(honest).canFraud).toBe(false);
  match.act(at(honest,'panel'),'fraud',1);
  match.act(traitor,'fraud',2);
  expect(view(host).yes.budget).toBe(-28);
  match.act(at(traitor,'panel'),'fraud',3);
  expect(view(traitor).canFraud).toBe(false);
  expect(view(host).yes.budget).toBe(-4);
  expect(view(traitor).yes.budget).toBe(-28);
  const finding = match.act(at(honest,'audit'),'audit',4);
  expect(finding?.critical).toBe(true);
  expect(finding?.text).toContain('Fraude no projeto');
  expect(view(honest).audit).toBe('fraud');
  expect(view(honest).yes.budget).toBe(-28);
  expect(view(host).yes.budget).toBe(-4);
  match.act(at(host,'panel'),'panel',5);
  expect(view(host).yes.budget).toBe(-4);
  match.act(at(honest,'panel'),'panel',6);
  expect(view(host).reportedFraud).toBe(true);
  expect(view(host).yes.budget).toBe(-28);
});

test('the vote uses actual costs, requires a majority and reveals the infiltrator at the end', () => {
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,() => .9);
  Reflect.set(Reflect.get(match,'fire'),'next',Infinity);
  expect(match.view(host.id,[host.id],0).sessionRemaining).toBe(600);
  let now = 0;
  for (let round=0;round<3;round++) {
    publishProjectFiling(match,host,round===0 ? 0 : round+2,now);
    if (round===0) {
      match.act(at(traitor,'panel'),'fraud',now+2);
      expect(match.view(host.id,ids,now).yes.budget).toBe(-4);
    }
    match.advance(now+=NEGOTIATION_MS);
    match.vote(host.id,'yes',now);
    match.vote(honest.id,'yes',now);
    match.vote(honest.id,round===0 ? 'yes' : 'no',now+1);
    match.vote(traitor.id,'yes',now+BALLOT_MS); // Deadline is exclusive.
    match.advance(now+=BALLOT_MS);
    const view = match.view(host.id,ids,now);
    expect(view.outcome?.passed).toBe(round===0);
    expect(view.outcomes.map(result => result.round)).toEqual(Array.from({length:round+1},(_,index) => index));
    if (round===0) {
      expect(view.budget).toBe(4);
      expect(view.outcome?.applied).toEqual({budget:-28,stability:22});
    }
    now+=60_000;
  }
  match.advance(ELECTION_RULES.matchDuration);
  expect(match.view(host.id,ids,now)).toMatchObject({phase:'finished',winner:'Infiltrado',infiltratorName:'Clodovil'});
});

test('nearby voices can carry past a wall without revealing the speaker', () => {
  const listener = {...host,x:130,y:60};
  const speaker = {...honest,x:158,y:60};
  const acrossWall = localPerception(listener,speaker);
  expect(acrossWall.visible).toBe(false);
  expect(acrossWall.volume).toBeGreaterThan(0);
  expect(acrossWall.volume).toBeLessThan(localPerception(listener,{...speaker,x:102}).volume);
  expect(localPerception(listener,at(traitor,'audit'))).toEqual({visible:false,volume:0});
  for (const {x,y} of Object.values(stations)) expect(canStand(x,y)).toBe(true);
});

test.each([...Object.values(stations),{x:860,y:506},{x:449,y:504}])(
  'the corridor reaches the station at $x, $y',
  ({x,y})=>{
    expect(findRoute(host,{x,y}).at(-1)).toEqual({x,y});
  },
);

test('diversion, transfers, and evidence sales affect balances without binding votes', () => {
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,() => .9);
  publishProjectFiling(match,host);
  const view = (player:Player) => match.view(player.id,ids,0);
  const accounts = [host,honest,traitor].map(player => view(player).politics!);
  for (const account of accounts) expect(account.missions.active).toHaveLength(3);
  expect(view(host).politics?.wallet).toBe(8);
  match.politics(host,{kind:'grant',area:'health',amount:6,diversion:50},people,1); // Too far from the cabinet.
  expect(view(host).budget).toBe(32);
  match.politics(at(host,'cabinet'),{kind:'grant',area:'health',amount:6,diversion:50},people,2);
  match.politics(at(host,'cabinet'),{kind:'grant',area:'health',amount:6,diversion:50},people,3);
  expect(view(host)).toMatchObject({budget:26,stability:54,politics:{wallet:11,walletIncome:3}});
  expect(view(honest).politics?.evidence).toEqual([]);
  match.politics(host,{kind:'transfer',to:honest.id,amount:2},people,4);
  match.politics(host,{kind:'transfer',to:traitor.id,amount:0},people,5); // Invalid amount.
  match.politics(host,{kind:'transfer',to:honest.id,amount:100},people,6);
  expect(view(host).politics?.wallet).toBe(9);
  expect(view(honest).politics?.wallet).toBe(10);
  expect(view(traitor).politics?.ledger).toEqual([]);
  match.politics(honest,{kind:'transfer',to:traitor.id,amount:1},people,7);
  expect(view(host).politics?.ledger).toEqual([]);
  expect(view(traitor).politics?.evidence.at(-1)?.kind).toBe('clandestine-transfer');

  match.act(at(honest,'audit'),'audit',8);
  const proof = view(honest).politics!.evidence.find(record => record.kind==='diversion')!;
  expect(proof.amount).toBe(3);
  match.politics(honest,{kind:'share',to:traitor.id,evidence:proof.id,price:2},people,9);
  const offer = view(traitor).politics!.incoming[0];
  expect(view(host).politics?.incoming).toEqual([]);
  expect(view(traitor).politics?.evidence.some(record => record.id===proof.id)).toBe(false);
  match.politics({...host,x:honest.x},{kind:'share',to:traitor.id,evidence:proof.id,price:3},[{...host,x:honest.x},honest,traitor],9);
  const competing = view(traitor).politics!.incoming.find(entry=>entry.id!==offer.id)!;
  expect(competing?.price).toBe(3);
  const before = match.economySummary(0);
  const paymentsLeft = view(traitor).politics!.paymentsLeft;
  match.politics(traitor,{kind:'accept',offer:offer.id},people,10);
  expect(view(traitor).politics?.incoming).toEqual([]);
  match.politics(traitor,{kind:'accept',offer:competing.id},[{...host,x:honest.x},honest,traitor],11);
  expect(view(traitor).politics?.paymentsLeft).toBe(paymentsLeft-1);
  expect(match.economySummary(0)).toMatchObject({humans:before.humans,reserve:before.reserve,transferred:before.transferred+2,discrepancy:0});
  match.politics(traitor,{kind:'accept',offer:offer.id},people,11);
  expect(view(honest).politics?.wallet).toBe(11);
  expect(view(traitor).politics?.wallet).toBe(7);
  match.politics(at(traitor,'press'),{kind:'publish',evidence:proof.id},people,12);
  expect(view(host).politics?.ledger).toContainEqual(proof);
  expect(view(host).politics?.popularity).toBeLessThan(40);
  expect(view(traitor).politics?.popularity).toBeGreaterThan(40);

  match.advance(NEGOTIATION_MS);
  match.vote(honest.id,'no',NEGOTIATION_MS+1);
  expect(view(honest).vote).toBe('no');
  expect(view(honest).politics?.wallet).toBe(11);
});

test('investments authorize only the selected amount, apply proportional bonuses, and recharge per player',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const view = (player:Player,now:number)=>match.view(player.id,ids,now);
  const apply = (player:Player, action:Extract<NonNullable<ReturnType<typeof readPoliticsAction>>,{kind:'grant'}>, now:number)=>
    match.politics(at(player,'cabinet'),action,people,now);
  const health = {kind:'grant',area:'health',amount:4,diversion:25} as const;
  expect(readPoliticsAction(health)).toEqual(health);
  for (const invalid of [{area:'constructor'},{amount:3},{diversion:75},{area:[]},{amount:Infinity}]) {
    expect(readPoliticsAction({...health,...invalid})).toBeUndefined();
  }
  expect(apply(host,health,1)).toEqual({announcement:{author:host.nick,area:'health',amount:4},hp:3});
  expect(view(host,1)).toMatchObject({budget:28,stability:54,politics:{wallet:9,grantCooldown:60}});
  expect(apply(host,health,60_000)).toBeUndefined();
  expect(view(honest,1).politics?.grantCooldown).toBe(0);
  expect(view(honest,1).politics?.evidence).toEqual([]);
  expect(view(honest,1).politics?.ledger).toEqual([]);
  expect(apply(honest,{kind:'grant',area:'transport',amount:2,diversion:50},2)).toBeDefined();
  expect(match.transportActive(3001)).toBe(true);
  expect(match.transportActive(3002)).toBe(false);
  const walker = {...honest,publicTransport:true} as const;
  expect(movementSpeed(walker)).toBeCloseTo(movementSpeed(honest)*1.2);
  expect(movementSpeed({...walker,sprinting:true})).toBe(movementSpeed({...honest,sprinting:true}));
  expect(apply(host,health,60_001)).toBeDefined();
  expect(view(host,60_001)).toMatchObject({budget:22,stability:62,politics:{wallet:10,grantCooldown:60}});
  expect(match.economySummary(0)).toMatchObject({projects:7,diverted:3,discrepancy:0});
  Reflect.set(match,'budget',1);
  expect(apply(traitor,health,60_002)).toBeUndefined();
  expect(view(traitor,60_002)).toMatchObject({budget:1,politics:{grantCooldown:0}});
});

test('Segurança delays the next fire and Abastecimento applies a temporary price at the Lanchonete',()=>{
  const match = new PlenaryMatch(1);
  const buyer = at(honest,'coffee');
  Object.assign(buyer,npcs.snackVendor.interaction);
  const players = [host,buyer,traitor];
  match.start(host.id,players,0,()=>.9);
  const game = new Gameplay();
  game.reset(0,()=>.5,players);
  match.politics(at(host,'cabinet'),{kind:'grant',area:'safety',amount:2,diversion:50},players,1);
  expect(match.politics(at(traitor,'cabinet'),{kind:'grant',area:'supplies',amount:4,diversion:25},players,2)).toBeDefined();
  const world = (now:number)=>match.gameplayWorld(players,now,()=>false);
  const quote = (now:number)=>marketProduct('food','pizza',world(now).policies,world(now).publicBudget)?.price;
  expect(quote(9001)).toBe(discountedPrice(2,30));
  expect(quote(9002)).toBe(2);
  expect(marketProduct('food','coffee',{coffee:1,supplies:1},1)?.price).toBe(.3);
  expect(marketProduct('food','coffee',{coffee:1,supplies:1},0)?.price).toBe(.4);
  const active = world(3000);
  game.act(buyer,{kind:'open-shop',target:'snackVendor'},active);
  const token = game.view(buyer,active).dialogue?.token;
  expect(token).toBeDefined();
  expect(game.act(buyer,{kind:'shop-buy',target:'pizza',token},active)).toBeDefined();
  expect(game.view(buyer,active).inventory).toContainEqual(expect.objectContaining({kind:'pizza'}));
  expect(match.view(buyer.id,ids,3000)).toMatchObject({budget:26,politics:{wallet:6.6}});
  match.advance(fireRules.firstAfter+2999);
  expect(match.view(host.id,ids,fireRules.firstAfter+2999).fire).toBeUndefined();
  match.advance(fireRules.firstAfter+3000);
  expect(match.view(host.id,ids,fireRules.firstAfter+3000).fire).toBeDefined();
});

test.each([honest,traitor])('an approved temporary hearing isolates the target without changing stability (%s)', target => {
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,() => .9);
  const view = (player:Player) => match.view(player.id,ids,0);
  match.politics(at(host,'panel'),{kind:'hearing',target:target.id},people,10);
  expect(view(host).phase).toBe('negotiation');
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  economy.changePopularity(host.id,17);
  expect(view(host).politics).toMatchObject({wallet:8,popularity:57,canCallHearing:true});
  match.politics(at(host,'panel'),{kind:'hearing',target:target.id},people,50);
  expect(view(host).hearing?.target).toBe(target.nick);
  const stability = view(host).stability;
  match.vote(host.id,'yes',60);
  match.vote((target===honest ? traitor : honest).id,'yes',60);
  const resumed = 50+HEARING_MS;
  match.advance(resumed);
  expect(view(host)).toMatchObject({phase:'negotiation',stability,electorate:2});
  expect(view(target).politics?.suspended).toBe(true);
  expect(view(target).role).toBe(target===honest ? 'Parlamentar' : 'Infiltrado');
  match.politics(target,{kind:'transfer',to:host.id,amount:1},people,resumed+1);
  expect(view(host).politics?.wallet).toBe(8);
  expect(match.view(target.id,ids,resumed).isolationSeconds).toBe(60);
  expect(match.canHandleObjects(target.id,resumed)).toBe(false);
  match.advance(resumed+59_999);
  expect(match.view(target.id,ids,resumed+59_999).isolationSeconds).toBe(1);
  match.advance(resumed+60_000);
  expect(match.view(target.id,ids,resumed+60_000).isolationSeconds).toBeUndefined();
  expect(match.canHandleObjects(target.id,resumed+60_000)).toBe(true);
  publishProjectFiling(match,host,0,resumed);
  match.advance(resumed+NEGOTIATION_MS);
  match.vote(target.id,'yes',resumed+NEGOTIATION_MS);
  expect(view(target).vote).toBe('yes');
});

test('rooms with at least six players may choose two infiltrators', () => {
  const match = new PlenaryMatch(1);
  const six = [...people,...people.map(player => ({...player,id:'extra-'+player.id}))];
  match.start(host.id,six,0,() => .9,2);
  const roster = six.map(({id}) => id);
  expect(roster.filter(id => match.view(id,roster,0).role==='Infiltrado')).toHaveLength(2);
  const short = new PlenaryMatch(1);
  short.start(host.id,people,0,() => .9,2);
  expect(ids.filter(id => short.view(id,ids,0).role==='Infiltrado')).toHaveLength(1);
});

test('private agendas refill immediately and credit a mission only once', () => {
  const economy = new PoliticalEconomy();
  economy.reset([{id:'a',name:'A'},{id:'b',name:'B'}],() => 0);
  const view = (id:string) => economy.view(id,[],1,false,() => true)!;
  expect(view('a').missions.active.map(mission=>mission.kind)).toEqual(['cafe','protocolo','pizza']);
  const event = {type:'filed',actor:'a',item:1,kind:'document',at:1,position:{x:0,y:0},witnesses:[]} as const;
  economy.recordGameplay({...event,witnesses:[]});
  economy.recordGameplay({...event,witnesses:[]});
  expect(view('a')).toMatchObject({wallet:8,walletIncome:0,popularity:45,progression:{xp:50},missions:{completed:[{kind:'protocolo'}]}});
  expect(view('a').missions.active).toHaveLength(3);
  expect(new Set(view('a').missions.active.map(mission=>mission.kind)).size).toBe(3);
  expect(view('b')).toMatchObject({wallet:8,missions:{completed:[]}});
  expect(view('b').missions.active.map(mission=>mission.kind)).toContain('protocolo');
});

test('pizza earns XP only on consumption after assignment', () => {
  const economy = new PoliticalEconomy();
  economy.reset([{id:'a',name:'A'}],() => 0);
  const view = () => economy.view('a',[],0,false,() => true)!;
  const event = {actor:'a',kind:'pizza',item:1,position:{x:0,y:0},witnesses:[]} as const;
  economy.recordGameplay({...event,witnesses:[],type:'purchased',at:1});
  expect(view().missions.completed).toEqual([]);
  const original = view().missions.active.find(mission=>mission.kind==='pizza');
  expect(original).toBeDefined();
  economy.recordGameplay({...event,witnesses:[],type:'used',at:2});
  expect(view()).toMatchObject({wallet:8,walletIncome:0,progression:{xp:20},missions:{completed:[{kind:'pizza',id:original!.id}]}});
  expect(view().missions.active).toHaveLength(3);
  expect(view().missions.active.some(mission=>mission.kind==='pizza')).toBe(false);
});

test('the coffee machine shares its recharge between players and both coffee actions',()=>{
  const cooldowns = new StationCooldowns();
  const match = new PlenaryMatch(1,cooldowns);
  const game = new Gameplay(cooldowns);
  const cafe = at(host,'coffee');
  const visitor = at(people[1],'coffee');
  const players = [cafe,visitor];
  match.start(host.id,players,0);
  const world = (now:number) => match.gameplayWorld(players,now,()=>false);
  const supply = {kind:'supply',place:'coffee'} as const;
  const {duration,feedback} = stationRecharge.coffee;

  expect(game.drinkStationCoffee(cafe,world(1))).toBe('Café bebido.');
  expect(game.act(visitor,supply,world(1))).toBe(feedback);
  expect(game.view(visitor,world(2)).stationCooldowns).toEqual({coffee:duration-1});
  expect(game.view(visitor,world(1+duration)).stationCooldowns).toEqual({});
  expect(game.act(visitor,supply,world(1+duration))).toBe('Objeto guardado no inventário.');
  expect(game.drinkStationCoffee(cafe,world(1+duration))).toBe(feedback);
  expect(game.drinkStationCoffee(cafe,world(1+2*duration))).toBe('Café bebido.');
});

test('the Corregedoria returns feedback for each audit, even without new records', () => {
  const match = new PlenaryMatch(1);
  match.start(host.id,[host],0);
  expect(match.act(host,'audit',1)?.text).toContain('Chegue mais perto');
  const player = at(host,'audit');
  const first = match.act(player,'audit',2);
  expect(first?.text).toContain('Nenhum registro novo');
  expect(match.act(player,'audit',3)).toEqual(first);
});

test('only an accepted filing schedules a ballot, with a cooldown and no repeat votes',()=>{
  const match = new PlenaryMatch(2);
  match.start(host.id,people,0,()=>.9);
  const file = (project:number,at:number,item:number)=> match.gameplayWorld(people,at,()=>false).publish({
    type:'filed',actor:host.id,item,project,position:host,at,witnesses:[],
  });
  const view = (now:number) => match.view(honest.id,ids,now);
  match.advance(NEGOTIATION_MS);
  expect(view(NEGOTIATION_MS).project).toBeUndefined();
  file(2,NEGOTIATION_MS,1);
  file(0,NEGOTIATION_MS,2);
  expect(view(NEGOTIATION_MS)).toMatchObject({project:2,proposer:host.nick,remaining:NEGOTIATION_MS/1_000});
  match.advance(2*NEGOTIATION_MS-1);
  expect(view(2*NEGOTIATION_MS-1).phase).toBe('negotiation');
  match.advance(2*NEGOTIATION_MS);
  expect(view(2*NEGOTIATION_MS)).toMatchObject({phase:'ballot',project:2,proposer:host.nick});
  const closed = 2*NEGOTIATION_MS+BALLOT_MS;
  match.advance(closed);
  expect(view(closed)).toMatchObject({phase:'negotiation',protocolCooldown:60,outcome:{project:2,proposer:host.nick}});
  expect(view(closed).project).toBeUndefined();
  const blocked = match.gameplayWorld(people,closed+59_999,()=>false);
  expect(blocked.projectFilingError?.(host.id,0)).toContain('1 s');
  const open = match.gameplayWorld(people,closed+60_000,()=>false);
  expect(open.projectFilingError?.(host.id,2)).toContain('já foi votado');
  expect(open.projectFilingError?.(host.id,0)).toBeUndefined();
});

test('parliamentarians can install a device and the fire still requires an extinguisher',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const site = 0;
  const installer = {...honest,x:fireSites[site].x,y:fireSites[site].y+10};
  expect(match.actOnFire(installer,'plant',site,0)).toBeUndefined();
  expect(match.fireInteraction(installer,0,86,true,false)?.option?.kind).toBe('plant');
  expect(match.actOnFire(installer,'plant',site,0,false,1)).toBe('Instalando dispositivo…');
  expect(match.fireInteraction(installer,1000,86,true,false)?.progress).toBeCloseTo(1/3);
  expect(match.fireInteraction(traitor,1000,86,false,false)).toBeUndefined();
  match.advance(fireRules.install);
  match.updateFireInstallation(fireRules.install,()=>installer,()=>true,()=>true);
  const ignites = fireRules.install+fireRules.fuse;
  match.advance(ignites-fireRules.smoke);
  expect(match.fireInteraction(installer,ignites-fireRules.smoke,86,false,false)).toMatchObject({smoke:site,option:{kind:'disarm'}});
  expect(match.fireInteraction(traitor,ignites-fireRules.smoke,86,false,false)).toBeUndefined();
  match.advance(ignites);
  expect(match.view(honest.id,ids,ignites).fire?.site).toBe(site);
  const later = ignites+fireRules.tick;
  match.advance(later);
  expect(match.view(honest.id,ids,later).stability).toBe(48-fireRules.damage);
  expect(match.actOnFire(installer,'extinguish',site,later)).toBeUndefined();
  expect(match.actOnFire(installer,'extinguish',site,later,true)).toBe('Incêndio apagado.');
  expect(match.view(honest.id,ids,later).fire).toBeUndefined();
});

test('an informal loan and a later manual repayment conserve both wallets',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const lender = {...host,x:140,y:146};
  const borrower = {...honest,x:148,y:146};
  const group = [lender,borrower,traitor];
  const wallet = (player:Player) => match.view(player.id,ids,0).politics!.wallet;
  match.politics(lender,{kind:'transfer',to:borrower.id,amount:3},group,1);
  expect([wallet(lender),wallet(borrower)]).toEqual([5,11]);
  match.advance(10_000);
  expect([wallet(lender),wallet(borrower)]).toEqual([5,11]);
  match.politics(borrower,{kind:'transfer',to:lender.id,amount:3},group,10_001);
  expect([wallet(lender),wallet(borrower)]).toEqual([8,8]);
});

test('a public intention can be withdrawn or contradicted by the actual vote',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  publishProjectFiling(match,host);
  match.declareVote(host.id,'yes',1);
  expect(match.view(honest.id,ids,1).voteIntents).toEqual([{id:host.id,name:host.nick,vote:'yes'}]);
  match.declareVote(host.id,null,2);
  expect(match.view(honest.id,ids,2).voteIntents).toEqual([]);
  match.declareVote(host.id,'yes',3);
  match.advance(NEGOTIATION_MS);
  match.declareVote(host.id,'no',NEGOTIATION_MS+1);
  expect(match.view(honest.id,ids,NEGOTIATION_MS+1).voteIntents?.[0]?.vote).toBe('yes');
  match.vote(host.id,'no',NEGOTIATION_MS+2);
  expect(match.view(host.id,ids,NEGOTIATION_MS+2).vote).toBe('no');
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  expect(match.view(honest.id,ids,NEGOTIATION_MS+BALLOT_MS).voteIntents).toEqual([]);
});

test('another hearing is possible but the isolated player has immunity after returning',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const view = (now:number)=>match.view(host.id,ids,now);
  const accuse = (target:Player,now:number)=>match.politics(at(host,'panel'),{kind:'hearing',target:target.id},people,now);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  economy.changePopularity(host.id,17);
  accuse(honest,50);
  match.vote(host.id,'yes',60);
  match.vote(traitor.id,'yes',60);
  const returned = 50+HEARING_MS+60_000;
  match.advance(50+HEARING_MS);
  match.advance(returned);
  accuse(honest,returned+1);
  expect(view(returned+1).phase).toBe('negotiation');
  expect(view(returned+1).politics?.directory.find(p=>p.id===honest.id)?.eligible).toBe(false);
  accuse(traitor,returned+2);
  expect(view(returned+2).hearing?.target).toBe(traitor.nick);
  match.advance(returned+2+HEARING_MS);
  const expiry = returned+120_000;
  match.advance(expiry);
  accuse(honest,expiry);
  expect(view(expiry).hearing?.target).toBe(honest.nick);
});

test('a closed office door hides players from authoritative world visibility',()=>{
  const office = privateOffices[0];
  const [left,top,width,height] = office.door;
  const x = left+width/2;
  const inside = {x,y:top-12};
  const outside = {x,y:top+height+12};
  expect(characterVisible(outside,inside)).toBe(true);
  expect(characterVisible({...outside,barriers:[office.door]},inside)).toBe(false);
});

test('only a victim or direct witness can report an infraction, once, at the desk',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const desk = (player:Player)=>({...player,...stations.audit});
  const world = match.gameplayWorld(people,10,()=>false);
  const strike = {type:'hit',actor:traitor.id,target:honest.id,at:10,position:honest,witnesses:[]} as const;
  world.publish({...strike,witnesses:[]});
  const incident = match.complaintView(honest.id).available[0]!;
  expect(match.complaintView(host.id).available).toEqual([]);
  expect(match.submitComplaint(desk(host),incident.id,11)).toContain('indisponível');
  expect(match.submitComplaint(honest,incident.id,11)).toContain('balcão');
  const beforeReward = match.economySummary(0);
  expect(match.submitComplaint(desk(honest),incident.id,11)).toBeUndefined();
  expect(match.submitComplaint(desk(honest),incident.id,11)).toContain('indisponível');
  expect(match.economySummary(0)).toMatchObject({humans:beforeReward.humans+1,reserve:beforeReward.reserve-1,discrepancy:0});
  expect(match.complaintView(host.id).history).toEqual([incident]);
  expect(match.view(honest.id,ids,11).politics?.wallet).toBe(9);
  expect(match.view(traitor.id,ids,11).politics?.popularity).toBe(32);

  world.publish({...strike,at:12,witnesses:[host.id]});
  expect(match.complaintView(host.id).available).toEqual([]);
  world.publish({...strike,at:10_011,witnesses:[host.id]});
  const witnessed = match.complaintView(host.id).available[0]!;
  expect(match.submitComplaint(desk(host),witnessed.id,10_012)).toBeUndefined();
  expect(match.complaintView(honest.id).available).toEqual([]);
});

test('the monetary summary reconciles physical issuance, trade, treasury and project spending',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  publishProjectFiling(match,host);
  const game = new Gameplay();
  const player = {...host,x:140,y:146};
  const receiver = {...honest,x:148,y:146};
  const group = [player,receiver,traitor];
  const values = [0,0,.117,.172];
  game.reset(0,()=>values.shift() ?? .5);
  const world = match.gameplayWorld(group,4000,()=>false);
  game.tick(world,true);
  const [item] = game.view(player,world).nearby;
  expect(match.economySummary(game.physicalCash())).toMatchObject({spawned:3,physical:3,discrepancy:0});
  game.act(player,{kind:'collect',item:item.id},world);
  match.politics(player,{kind:'transfer',to:receiver.id,amount:3},group,4001);
  expect(world.spend!(player.id,1.5)).toBe(true);
  expect(match.economySummary(game.physicalCash())).toMatchObject({transferred:3,reserveFees:1.5,discrepancy:0});
  Object.assign(player,terminals.treasury.point);
  expect(game.act(player,{kind:'deliver',item:item.id,place:'treasury',target:'partial'},world)).toContain('R$ 15 mil');
  expect(match.economySummary(game.physicalCash())).toMatchObject({treasury:1.5,physical:1.5,discrepancy:0});
  expect(game.view(player,world).inventory).toContainEqual(expect.objectContaining({id:item.id,cash:1.5}));
  expect(game.act(player,{kind:'deliver',item:item.id,place:'treasury'},world)).toContain('Tesouraria');
  expect(match.economySummary(game.physicalCash())).toMatchObject({treasury:3,physical:0,discrepancy:0});
  match.advance(NEGOTIATION_MS);
  match.vote(host.id,'yes',NEGOTIATION_MS+1);
  match.vote(honest.id,'yes',NEGOTIATION_MS+1);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  expect(match.economySummary(game.physicalCash())).toMatchObject({projects:28,discrepancy:0});
  match.advance(ELECTION_RULES.interval);
  expect(match.economySummary(game.physicalCash())).toMatchObject({budget:-8,publicDuty:6,salaries:9,discrepancy:0});
});

test('NPC issuance, paid agreements, robbery and reserve fees conserve the same funds',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const npc:Player = {...traitor,id:'npc-parliamentarian-1',npc:true};
  const game = new Gameplay();
  const world = match.gameplayWorld([...people,npc],1,()=>false);
  const summary = () => match.economySummary(game.physicalCash());

  match.addParliamentarian(npc);
  const issued = summary().npcIssued;
  expect(issued).toBeGreaterThan(0);
  match.addParliamentarian(npc);
  match.addParliamentarian(host);
  expect(summary()).toMatchObject({npcIssued:issued,npcs:issued,humans:24,discrepancy:0});

  expect(world.payNpc!(host.id,npc.id,2)).toBe(true);
  expect(world.payNpc!(host.id,npc.id,100)).toBe(false);
  expect(summary()).toMatchObject({npcs:issued+2,humans:22,transferred:2,discrepancy:0});

  expect(game.robNpc(host,npc,world)).toContain('Maleta roubada');
  expect(game.robNpc(host,npc,world)).toBe('O parlamentar está sem dinheiro.');
  expect(summary()).toMatchObject({npcs:0,physical:issued+2,discrepancy:0});

  for (const invalid of [-1,NaN,Infinity,0,.05]) expect(world.spend!(host.id,invalid)).toBe(false);
  for (const fee of [.1,.2,.3,5.4]) expect(world.spend!(host.id,fee)).toBe(true);
  expect(world.wallet!(host.id)).toBe(0);
  expect(summary()).toMatchObject({reserveFees:6,physical:issued+2,discrepancy:0});
});

test('failed mail payments and expired cash preserve the ledger across retries',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const player = {...host,x:140,y:146};
  const game = new Gameplay();
  const values = [0,0,.117,.172];
  game.reset(0,()=>values.shift() ?? .5);
  const world = match.gameplayWorld([player,honest,traitor],4000,()=>false);
  game.tick(world,true);
  const [cash] = game.view(player,world).nearby;
  expect(cash.kind).toBe('briefcase');
  world.now += 55_000;
  expect(game.view(player,world).nearby).toEqual([]);
  expect(game.act(player,{kind:'collect',item:cash.id},world)).toBe('Objeto indisponível.');
  game.tick(world,false);
  game.tick(world,false);
  const summary = () => match.economySummary(game.physicalCash());
  expect(summary()).toMatchObject({spawned:3,expired:3,physical:0,discrepancy:0});

  const mail = new InternalMail();
  Object.assign(player,stations.audit);
  const message = {subject:'Aviso',body:'Teste'};
  expect(world.spend!(player.id,7)).toBe(true);
  const before = summary();
  expect(mail.publish(player,message,world)).toContain('Saldo insuficiente');
  expect(mail.view()).toEqual([]);
  expect(summary()).toEqual(before);
  expect(world.payNpc!(player.id,'missing',1)).toBe(false);
  match.politics({...honest,x:player.x+8,y:player.y},{kind:'transfer',to:player.id,amount:1},[player],world.now);
  expect(mail.publish(player,message,world)).toBeUndefined();
  expect(mail.publish(player,message,world)).toContain('Aguarde');
  expect(mail.view()).toHaveLength(1);
  expect(summary()).toMatchObject({reserveFees:8.5,transferred:1,expired:3,discrepancy:0});
});

test.each([0,2,3])('the deadline counts rejected projects toward the three-vote goal (%i)',count=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,[host],0,()=>.9);
  Reflect.set(Reflect.get(match,'fire'),'next',Infinity);
  let now = 0;
  for (let index=0; index<count; index++) {
    const project = index+3; // Rejection leaves stability intact.
    match.gameplayWorld([host],now,()=>false).publish({type:'filed',actor:host.id,project,at:now,position:host,witnesses:[]});
    match.advance(now+=NEGOTIATION_MS);
    const ballot = match.view(host.id,[host.id],now);
    expect(ballot.remaining).toBe(BALLOT_MS/1_000);
    expect(ballot.sessionRemaining).toBe(600-now/1_000);
    match.vote(host.id,'no',now+1);
    match.advance(now+=BALLOT_MS);
    now+=60_000;
  }
  match.advance(ELECTION_RULES.matchDuration);
  const result = match.view(host.id,[host.id],ELECTION_RULES.matchDuration);
  expect(result.outcomes.map(outcome=>outcome.passed)).toEqual(Array(count).fill(false));
  expect(result.winner).toBe(count===3 ? 'Parlamentar' : undefined);
  expect(result.congressDestroyed).toBe(count<3 ? true : undefined);
});

test('the speech mission returns after renewal and propaganda stays available',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  const resetDraw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['propaganda','discurso','cafe','passeio','selfieSolo']);
  };
  const active = () => match.view(host.id,ids,0).politics!.missions.active.map(mission=>mission.kind);
  expect(match.electionAction(at(host,'panel'),{kind:'advertise'},1,false)).toBeUndefined();
  const ad = match.electionAction(at(host,'press'),{kind:'advertise'},1,false);
  expect(ad).toEqual({name:host.nick,character:host.character,number:100});
  expect(match.electionAction(at(host,'press'),{kind:'advertise'},2,false)).toEqual(ad);
  match.electionAction(at(host,'panel'),{kind:'speech'},2,false);
  resetDraw();
  match.refreshAgendaEligibility();
  expect(active()).toEqual(['propaganda','cafe','passeio']);

  resetDraw();
  Reflect.set(match,'ends',ELECTION_RULES.interval+100);
  match.advance(ELECTION_RULES.interval);
  expect(active()).toEqual(['propaganda','discurso','cafe']);
  expect(match.electionAction(at(host,'press'),{kind:'advertise'},ELECTION_RULES.interval+1,false)).toEqual(ad);
  expect(match.view(host.id,ids,0).politics?.missions.completed).toContainEqual(expect.objectContaining({kind:'propaganda'}));
});

test('a station rejects a nearby player blocked by a barrier or carrying someone',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const {x,y} = stations.coffee;
  const nearby:Player = {...host,x:x+8,y};
  const game = new Gameplay();
  const world = match.gameplayWorld(people,1,()=>false);
  expect(game.drinkStationCoffee(host,world)).toBeUndefined();
  expect(game.drinkStationCoffee({...nearby,barriers:[[x+3,y-2,2,4]]},world)).toBeUndefined();
  expect(game.drinkStationCoffee({...nearby,carrying:true},world)).toBeUndefined();
  expect(game.drinkStationCoffee(nearby,world)).toBe('Café bebido.');
});

test('a project applies its full impact and public debt drains stability until repaid',()=>{
  const match = new PlenaryMatch(1);
  const ids = [host.id];
  match.start(host.id,[host],0,()=>0);
  Reflect.set(Reflect.get(match,'fire'),'next',Infinity);
  publishProjectFiling(match,host);
  Reflect.set(match,'budget',24.7);
  match.advance(NEGOTIATION_MS);
  match.vote(host.id,'yes',NEGOTIATION_MS+1);
  const passedAt = NEGOTIATION_MS+BALLOT_MS;
  const firstPenalty = passedAt+publicDebtRules.interval;
  match.advance(passedAt);
  const view = (now:number)=>match.view(host.id,ids,now);
  expect(view(passedAt)).toMatchObject({budget:-3.3,stability:70,debtPenaltyIn:30,outcome:{
    passed:true,deficit:3.3,applied:{budget:-28,stability:22},
  }});

  match.advance(firstPenalty-1);
  expect(view(firstPenalty-1)).toMatchObject({stability:70,debtPenaltyIn:1});
  match.advance(firstPenalty);
  expect(view(firstPenalty)).toMatchObject({stability:66,debtPenaltyIn:30});
  const deposit = (amount:number,now:number)=>match.gameplayWorld([host],now,()=>false).deposit!(host.id,amount);
  expect(deposit(2.4,firstPenalty+1)).toBe(true);
  expect(view(firstPenalty+1)).toMatchObject({budget:-.9,debtPenaltyIn:30});
  expect(publicDebtStabilityLoss(view(firstPenalty+1).budget)).toBe(1);
  expect(deposit(.9,firstPenalty+2)).toBe(true);
  expect(view(firstPenalty+2).debtPenaltyIn).toBeUndefined();
  expect(view(ELECTION_RULES.interval-1)).toMatchObject({budget:0});
  match.advance(ELECTION_RULES.interval);
  expect(view(ELECTION_RULES.interval)).toMatchObject({budget:-9,debtPenaltyIn:30,stability:66});
  expect(view(ELECTION_RULES.interval).election?.result?.salary).toBe(3);
  match.advance(firstPenalty+publicDebtRules.interval);
  expect(view(firstPenalty+publicDebtRules.interval).stability).toBe(66);
  const nextPenalty = ELECTION_RULES.interval+publicDebtRules.interval;
  match.advance(nextPenalty);
  expect(view(nextPenalty).stability).toBe(62);
  Reflect.set(match,'stability',4);
  const collapseAt = nextPenalty+publicDebtRules.interval;
  match.advance(collapseAt);
  expect(view(collapseAt)).toMatchObject({phase:'finished',stability:0,reason:'A dívida pública derrubou a estabilidade.'});
});

test('the last ballot does not redraw a voting mission from an already credited vote',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  publishProjectFiling(match,host);
  Reflect.set(match,'round',bills.length-1);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['votacao','apoio','cafe','passeio','selfieSolo','leitura']);
  match.refreshAgendaEligibility();
  const missions = ()=>match.view(host.id,ids,0).politics!.missions;
  expect(missions().active.map(m=>m.kind)).toContain('votacao');
  match.advance(NEGOTIATION_MS);
  match.vote(host.id,'no',NEGOTIATION_MS+1);
  expect(missions().completed.map(m=>m.kind)).toEqual(['votacao']);
  expect(missions().active.map(m=>m.kind)).toContain('apoio');
  expect(missions().active.map(m=>m.kind)).not.toContain('votacao');
  match.vote(host.id,'yes',NEGOTIATION_MS+2);
  expect(missions().completed.map(m=>m.kind)).toEqual(['votacao','apoio']);
  expect(missions().active.map(m=>m.kind)).not.toContain('apoio');
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['votacao','apoio','cafe']);
  match.refreshAgendaEligibility();
  expect(missions().active.map(m=>m.kind)).toContain('votacao');
  expect(missions().active.map(m=>m.kind)).toContain('apoio');
});

test('cassation requires at least three eligible players to be called',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  economy.changePopularity(host.id,17);
  economy.earn(host.id,cassationFee);
  const call = () => match.callCassation(at(host,'audit'),50);
  const view = () => match.view(host.id,ids,50);

  match.setPlayerConnected(honest.id,false);
  expect(view().politics?.canCallHearing).toBe(true);
  call();
  expect(view().cassationIn).toBeUndefined();

  match.setPlayerConnected(honest.id,true);
  call();
  expect(view().cassationIn).toBe(30);
});

test('cassation can be called at 40 popularity',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  economy.earn(host.id,cassationFee);
  const call = () => match.callCassation(at(host,'audit'),50);
  const view = () => match.view(host.id,ids,50);

  economy.changePopularity(host.id,-1);
  expect(view().politics?.popularity).toBe(39);
  call();
  expect(view().cassationIn).toBeUndefined();

  economy.changePopularity(host.id,1);
  expect(view().politics?.canCallHearing).toBe(false);
  call();
  expect(view().cassationIn).toBe(30);
});

test('splitting cassation votes leaves mandates intact and resumes the project timer',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  publishProjectFiling(match,host);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  economy.changePopularity(host.id,17);
  match.gameplayWorld([],0,()=>false).earn(host.id,cassationFee);
  expect(match.callCassation(at(host,'audit'),50)).toBeUndefined();
  const open = 50+CASSATION_NOTICE_MS;
  const view = (now:number)=>match.view(host.id,ids,now);
  expect(view(50).cassationIn).toBe(30);
  match.advance(open);
  expect(view(open).cassation?.quorum).toBe(2);
  expect(match.allowsPlenaryCombat).toBe(true);
  match.castCassation(host.id,honest.id,open);
  match.castCassation(honest.id,traitor.id,open);
  match.castCassation(traitor.id,null,open);
  expect(view(open).cassation?.voted).toBe(3);
  match.advance(open+HEARING_MS);
  expect(view(open+HEARING_MS)).toMatchObject({phase:'negotiation',electorate:3,remaining:Math.ceil((NEGOTIATION_MS-open-HEARING_MS)/1_000),
    cassationResult:{text:expect.stringContaining('Ninguém foi cassado')}});
});

test('cassation charges the caller once and can be called again after an inconclusive vote',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const caller = at(host,'audit');
  expect(readPoliticsAction({kind:'hearing',target:traitor.id})).toBeUndefined();
  expect(readPoliticsAction({kind:'call-cassation'})).toBeUndefined();
  expect(canStand(caller.x,caller.y)).toBe(true);
  economy.earn(host.id,cassationFee-1-economy.wallet(host.id));
  expect(match.callCassation(caller,1)).toContain('Saldo insuficiente');
  expect(economy.wallet(host.id)).toBe(cassationFee-1);
  expect(match.view(host.id,ids,1).cassationIn).toBeUndefined();

  economy.earn(host.id,cassationFee+1);
  expect(match.callCassation(at(host,'panel'),2)).toContain('Corregedoria');
  expect(economy.wallet(host.id)).toBe(2*cassationFee);
  expect(match.callCassation(caller,3)).toBeUndefined();
  expect(match.callCassation(caller,4)).toContain('indisponível');
  expect(economy.wallet(host.id)).toBe(cassationFee);

  const openedAt = 3+CASSATION_NOTICE_MS;
  match.advance(openedAt);
  const resolvedAt = openedAt+HEARING_MS;
  match.advance(resolvedAt);
  expect(match.view(host.id,ids,resolvedAt).cassationResult?.text).toContain('Ninguém foi cassado');
  expect(match.callCassation(caller,resolvedAt+1)).toBeUndefined();
  expect(economy.wallet(host.id)).toBe(0);
  expect(match.economySummary(0).cassationFees).toBe(2*cassationFee);
});

test('a cassation called at the last possible instant resolves before the session ends',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  const caller = at(host,'audit');
  const deadline = ELECTION_RULES.matchDuration;
  const lastCall = deadline-CASSATION_NOTICE_MS-HEARING_MS;
  const wallet = match.view(host.id,ids,0).politics!.wallet;
  expect(match.callCassation(caller,lastCall+1)).toContain('indisponível');
  expect(match.view(host.id,ids,lastCall+1).politics!.wallet).toBe(wallet);
  match.gameplayWorld([],lastCall,()=>false).earn(host.id,cassationFee);
  expect(match.callCassation(caller,lastCall)).toBeUndefined();
  const openedAt = lastCall+CASSATION_NOTICE_MS;
  match.advance(openedAt);
  for (const voter of [host,honest]) match.castCassation(voter.id,traitor.id,openedAt);
  match.advance(deadline);
  const result = match.view(host.id,ids,deadline);
  expect(result.phase).toBe('finished');
  expect(result.cassationResult?.text).toContain('Clodovil perdeu o mandato com 2 votos');
});

test('cassation counts the same connected votes in the HUD and the final tally',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  match.gameplayWorld([],0,()=>false).earn(host.id,cassationFee);
  expect(match.callCassation(at(host,'audit'),50)).toBeUndefined();
  const openedAt = 50+CASSATION_NOTICE_MS;
  match.advance(openedAt);
  match.castCassation(host.id,traitor.id,openedAt);
  match.castCassation(honest.id,null,openedAt);
  match.castCassation(traitor.id,host.id,openedAt);
  const ballot = (id=host.id)=>match.view(id,ids,openedAt).cassation!;
  expect(ballot()).toMatchObject({electorate:3,quorum:2,voted:3,choice:traitor.id});
  match.setPlayerConnected(traitor.id,false);
  expect(ballot()).toMatchObject({electorate:2,quorum:2,voted:1});
  expect(ballot().choice).toBeUndefined();
  expect(ballot(honest.id).choice).toBeNull();
  expect(ballot(traitor.id).choice).toBeUndefined();
  match.setPlayerConnected(traitor.id,true);
  expect(ballot()).toMatchObject({electorate:3,voted:3,choice:traitor.id});
  match.setPlayerConnected(traitor.id,false);
  match.advance(openedAt+HEARING_MS);
  expect(match.view(host.id,ids,openedAt+HEARING_MS).cassationResult?.text).toContain('Ninguém foi cassado');
});

test('project votes expose portraits and current choices without roles; abstentions do not count as no',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  publishProjectFiling(match,host);
  match.advance(NEGOTIATION_MS);
  match.vote(host.id,'yes',NEGOTIATION_MS+1);
  match.vote(honest.id,'abstain',NEGOTIATION_MS+2);
  const view = match.view(traitor.id,ids,NEGOTIATION_MS+3);
  expect(view.billVoters).toEqual([
    {id:host.id,name:host.nick,character:host.character,vote:'yes'},
    {id:honest.id,name:honest.nick,character:honest.character,vote:'abstain'},
    {id:traitor.id,name:traitor.nick,character:traitor.character,vote:undefined},
  ]);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  const result = match.view(traitor.id,ids,NEGOTIATION_MS+BALLOT_MS);
  expect(result.outcome).toMatchObject({yes:1,no:0,passed:false});
  expect(result.billVoters).toBeUndefined();
});

test.each(['PROJ-N04','PROJ-N12','PROJ-N13'])('%s pays only on approval with a balanced public ledger',id=>{
  const project = bills.findIndex(bill=>bill.id===id);
  for (const approved of [false,true]) {
    const match = new PlenaryMatch(1);
    match.start(host.id,people,0,()=>.9);
    const view = (now:number)=>match.view(host.id,ids,now);
    const before = view(0);
    match.gameplayWorld(people,1,()=>false).publish({
      type:'filed',project,actor:host.id,item:1,position:terminals.protocol.point,at:0,witnesses:[],
    });
    match.advance(NEGOTIATION_MS);
    const cost = -view(NEGOTIATION_MS).yes.budget;
    expect(cost).toBe(id==='PROJ-N04' ? 3 : id==='PROJ-N12' ? 1.5 : 6);
    if (approved) for (const voter of [host,honest]) match.vote(voter.id,'yes',NEGOTIATION_MS+1);
    match.advance(NEGOTIATION_MS+BALLOT_MS);
    const after = view(NEGOTIATION_MS+BALLOT_MS);
    expect(after.outcome?.passed).toBe(approved);
    expect(after.budget).toBe(before.budget-(approved ? cost : 0));
    expect(after.politics!.wallet).toBe(before.politics!.wallet+(approved ? cost/3 : 0));
    expect(match.economySummary(0).discrepancy).toBe(0);
  }
});

test.each([true,false])('treasury deposits respect the vote and bonus deadline, approval=%s',approved=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const project = bills.findIndex(bill=>bill.id==='PROJ-N17');
  match.gameplayWorld(people,1,()=>false).publish({
    type:'filed',project,actor:host.id,item:1,position:terminals.protocol.point,at:0,witnesses:[],
  });
  match.advance(NEGOTIATION_MS);
  for (const voter of [host,honest]) match.vote(voter.id,approved ? 'yes' : 'no',NEGOTIATION_MS+1);
  const passedAt = NEGOTIATION_MS+BALLOT_MS;
  match.advance(passedAt);
  expect(match.view(host.id,ids,passedAt).outcome?.passed).toBe(approved);
  const popularity = (id:string,at:number)=>match.view(id,ids,at).politics!.popularity;
  const before = popularity(host.id,passedAt);
  match.gameplayWorld(people,passedAt+1,()=>false).deposit!(host.id,1);
  expect(popularity(host.id,passedAt+1)).toBe(before+(approved ? 2 : 1));
  const expired = passedAt+90_000;
  const honestBefore = popularity(honest.id,expired);
  match.gameplayWorld(people,expired,()=>false).deposit!(honest.id,1);
  expect(popularity(honest.id,expired)).toBe(honestBefore+1);
});

test('the extintor bill delays the next ignition only when approved and funded',()=>{
  const project = bills.findIndex(bill=>bill.id==='PROJ-N10');
  for (const approved of [true,false]) {
    const match = new PlenaryMatch(1);
    match.start(host.id,people,0,()=>.9);
    match.gameplayWorld(people,1,()=>false).publish({
      type:'filed',project,actor:host.id,item:1,position:terminals.protocol.point,at:0,witnesses:[],
    });
    match.advance(NEGOTIATION_MS);
    if (approved) for (const voter of [host,honest]) match.vote(voter.id,'yes',NEGOTIATION_MS+1);
    const fire = Reflect.get(match,'fire');
    const next = Reflect.get(fire,'next');
    match.advance(NEGOTIATION_MS+BALLOT_MS);
    expect(Reflect.get(fire,'next')).toBe(next+(approved ? fireRules.safetyDelay : 0));
    expect(match.economySummary(0)).toMatchObject({projects:approved ? 3 : 0,discrepancy:0});
  }
});

test.each(['recovery','coffee','furniture','equipment','mail','campaign'] as const)('the %s policy only persists after a successful vote and expires',policy=>{
  const project = bills.findIndex(bill=>bill.effect?.kind==='policy' && bill.effect.policy===policy);
  for (const approved of [false,true]) {
    const match = new PlenaryMatch(1);
    match.start(host.id,people,0,()=>.9);
    match.gameplayWorld(people,1,()=>false).publish({
      type:'filed',project,actor:host.id,item:1,position:terminals.protocol.point,at:0,witnesses:[],
    });
    match.advance(NEGOTIATION_MS);
    if (approved) for (const voter of [host,honest]) match.vote(voter.id,'yes',NEGOTIATION_MS+1);
    const now = NEGOTIATION_MS+BALLOT_MS;
    match.advance(now);
    expect(match.view(host.id,ids,now).policies?.[policy]).toBe(approved ? now+120_000 : undefined);
    expect(match.gameplayWorld(people,now+119_999,()=>false).policies?.[policy]).toBe(approved ? now+120_000 : undefined);
    expect(match.view(host.id,ids,now+120_000).policies?.[policy]).toBeUndefined();
    expect(match.economySummary(0).discrepancy).toBe(0);
  }
});

test('a shop subsidy spends public funds and the purchase conserves money',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const world = match.gameplayWorld(people,1,()=>false);
  const before = match.view(host.id,ids,1);
  expect(world.spendSubsidized!(host.id,.3,.2)).toBe(true);
  const after = match.view(host.id,ids,1);
  expect(after.politics!.wallet).toBe(before.politics!.wallet-.3);
  expect(after.budget).toBe(before.budget-.2);
  expect(match.economySummary(0).discrepancy).toBe(0);
  expect(world.spendSubsidized!(host.id,1,after.budget+1)).toBe(false);
  expect(match.view(host.id,ids,1).politics!.wallet).toBe(after.politics!.wallet);
});

test('Plantão de Emergência credits extinguishing from inside the affected room only',()=>{
  const match = new PlenaryMatch(1);
  const site = fireSites.findIndex(point=>point.x===554 && point.y===519);
  match.start(host.id,people,0,()=>(site+.5)/fireSites.length);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const {agenda} = Reflect.get(economy,'accounts').get(honest.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['plantaoEmergencia','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const now = fireRules.firstAfter;
  const point = fireSites[site];
  const player = {...honest,...point};
  const outside = {...player,y:point.y+fireRules.radius};
  const missions = ()=>match.view(honest.id,ids,now).politics!.missions;
  expect(missions().active.some(mission=>mission.kind==='plantaoEmergencia')).toBe(true);
  expect(match.actOnFire(player,'extinguish',site,now,true)).toBeUndefined();
  match.advance(now);
  expect(match.actOnFire(outside,'extinguish',site,now,true)).toBeUndefined();
  expect(match.actOnFire(player,'extinguish',site,now,false)).toBeUndefined();
  expect(missions().completed.some(mission=>mission.kind==='plantaoEmergencia')).toBe(false);
  expect(match.actOnFire(player,'extinguish',site,now,true)).toBe('Incêndio apagado.');
  expect(missions().completed.some(mission=>mission.kind==='plantaoEmergencia')).toBe(true);
  expect(match.actOnFire(player,'extinguish',site,now+1,true)).toBeUndefined();
});

test('Plantão de Emergência cannot be claimed after the fire has expired',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const {agenda} = Reflect.get(economy,'accounts').get(honest.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['plantaoEmergencia','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const now = fireRules.firstAfter;
  const site = Math.floor(.9*fireSites.length);
  const point = fireSites[site];
  match.advance(now);
  const expired = now+fireRules.duration;
  match.advance(expired);
  expect(match.actOnFire({...honest,...point},'extinguish',site,expired,true)).toBeUndefined();
  const view = match.view(honest.id,ids,expired);
  expect(view.fire).toBeUndefined();
  expect(view.politics!.missions.active).toContainEqual(expect.objectContaining({kind:'plantaoEmergencia',current:0}));
});

test('replaying a server-identified event does not apply progress twice',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['contribuinte','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const world = match.gameplayWorld(people,10,()=>false);
  const deposit = {type:'delivered',actor:host.id,item:1,position:terminals.treasury.point,at:10,place:'treasury',amount:2,witnesses:[]} as const;
  const settled = {...deposit,witnesses:[],eventId:world.nextEventId!()};
  const active = ()=>match.view(host.id,ids,10).politics!.missions.active.find(mission=>mission.kind==='contribuinte')?.current;
  expect(world.publish(settled)).toBe(true);
  expect(world.publish({...settled})).toBe(false);
  expect(active()).toBe(2);
  world.publish({...settled,eventId:world.nextEventId!()});
  expect(active()).toBe(4);
});

test('a previous match event cannot reserve the new match’s document ID',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,[host],0,()=>.9)).toBe(true);
  const before = match.gameplayWorld([host],1,()=>false);
  const filed = {
    type:'filed',actor:host.id,item:1,project:2,position:terminals.protocol.point,at:1,witnesses:[],
    eventId:before.nextEventId!(),
  } as const;
  expect(before.publish({...filed,witnesses:[]})).toBe(true);
  match.leave(host.id,2);
  expect(match.start(host.id,[host],3,()=>.9)).toBe(true);

  const after = match.gameplayWorld([host],4,()=>false);
  const view = ()=>match.view(host.id,[host.id],4);
  expect(after.publish({...filed,at:4,witnesses:[]})).toBe(false);
  expect(view().project).toBeUndefined();
  expect(after.publish({...filed,at:4,eventId:after.nextEventId!(),witnesses:[]})).toBe(true);
  expect(view().project).toBe(2);
});

test('a previous gameplay world cannot settle transactions against the new match',()=>{
  const match = new PlenaryMatch(1);
  const npc:Player = {...host,id:'npc-parliamentarian-1',npc:true};
  expect(match.start(host.id,[host],0,()=>.9)).toBe(true);
  match.addParliamentarian(npc);
  const previous = match.gameplayWorld([host,npc],1,()=>false);
  match.leave(host.id,2);
  expect(match.start(host.id,[host],3,()=>.9)).toBe(true);
  match.addParliamentarian(npc);
  const next = match.gameplayWorld([host,npc],4,()=>false);
  const state = ()=>({
    economy:match.economySummary(0),
    politics:match.view(host.id,[host.id],4).politics,
  });
  const initial = state();

  expect(previous.spend!(host.id,1)).toBe(false);
  expect(previous.spendSubsidized!(host.id,1,1)).toBe(false);
  expect(previous.settleBet!(host.id,1,2,2)).toBe(false);
  expect(previous.deposit!(host.id,1)).toBe(false);
  expect(previous.payNpc!(host.id,npc.id,1)).toBe(false);
  expect(previous.takeWallet!(npc.id)).toBe(0);
  expect(previous.lootWallet!(host.id,.5)).toBe(0);
  expect(previous.projectFilingError!(host.id,0)).toBe('Partida encerrada.');
  previous.cashFlow!('expired',1);
  previous.earn(host.id,1);
  previous.earnXp!(host.id,20);
  expect(state()).toEqual(initial);

  expect(next.spend!(host.id,1)).toBe(true);
  next.earnXp!(host.id,20);
  expect(state().politics).toMatchObject({wallet:initial.politics!.wallet-1,progression:{xp:20}});
});

test('Investimento Político counts paid advertisements after assignment across renewals',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,[host],0,()=>.9)).toBe(true);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['investimentoPolitico','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const view = (now:number)=>match.view(host.id,[host.id],now);
  const announce = (now:number)=>match.electionAction(at(host,'press'),{kind:'advertise'},now,false);
  const progress = (now:number)=>view(now).politics!.missions.active.find(mission=>mission.kind==='investimentoPolitico')?.current;
  expect(progress(0)).toBe(0);
  expect(match.electionAction(host,{kind:'advertise'},1,false)).toBeUndefined();
  expect(announce(2)).toBeDefined();
  expect(announce(3)).toBeDefined();
  expect(progress(3)).toBe(4);
  expect(view(3).politics).toMatchObject({wallet:8-ELECTION_RULES.advertisementCost*2,popularity:50});

  publishProjectFiling(match,host);
  match.advance(NEGOTIATION_MS);
  match.vote(host.id,'yes',NEGOTIATION_MS+1);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  match.advance(ELECTION_RULES.interval);
  expect(announce(ELECTION_RULES.interval+1)).toBeDefined();
  const result = view(ELECTION_RULES.interval+1).politics!;
  expect(result.missions.completed).toContainEqual(expect.objectContaining({kind:'investimentoPolitico',current:5}));
  expect(result.progression.xp).toBeGreaterThanOrEqual(50);
  expect(match.economySummary(0).discrepancy).toBe(0);
});

test('PEC da Reeleição Infinita increases the paid ad weight in polling and the actual renewal while active',()=>{
  for (const approved of [false,true]) {
    const match = new PlenaryMatch(1);
    expect(match.start(host.id,people,0,()=>.5)).toBe(true);
    const project = bills.findIndex(bill=>bill.id==='PROJ-N09');
    match.gameplayWorld(people,1,()=>false).publish({
      type:'filed',project,actor:host.id,item:1,position:terminals.protocol.point,at:0,witnesses:[],
    });
    expect(match.electionAction(at(host,'press'),{kind:'advertise'},2,false)).toBeDefined();
    match.advance(NEGOTIATION_MS);
    if (approved) for (const voter of [host,honest]) match.vote(voter.id,'yes',NEGOTIATION_MS+1);
    const close = NEGOTIATION_MS+BALLOT_MS;
    match.advance(close);
    const view = (now:number)=>match.view(host.id,ids,now);
    const estimate = (now:number)=>view(now).election?.polls.find(poll=>poll.id===host.id)?.estimate;
    const during = estimate(close+1)!;
    const after = estimate(close+120_000)!;
    if (approved) expect(during).toBeGreaterThan(after);
    else expect(during).toBe(after);
    match.advance(ELECTION_RULES.interval);
    expect(view(ELECTION_RULES.interval).election?.result?.offices.find(person=>person.id===host.id)?.percentage).toBe(during);
    expect(match.economySummary(0).discrepancy).toBe(0);
    match.advance(ELECTION_RULES.matchDuration);
    expect(view(ELECTION_RULES.matchDuration).policies?.campaign).toBeUndefined();
  }
});

test('Pix missions only enter the agenda with usable payment quotas and solvent distinct senders',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const agenda = Reflect.get(economy,'accounts').get(host.id).agenda;
  const view = ()=>match.view(host.id,ids,100).politics!;
  const pay = (from:Player,to:Player,amount=1)=>match.politics(from,{kind:'transfer',to:to.id,amount},people,1);
  const draw = ()=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['pixVinte','doisPix','cafe','passeio','selfieSolo']);
    match.refreshAgendaEligibility();
    return view().missions.active.map(mission=>mission.kind);
  };
  const quota = view().paymentsLeft;
  for (let payment=0;payment<quota;payment++) expect(pay(host,traitor)).toBe(true);
  expect(economy.spend(honest.id,economy.wallet(honest.id))).toBe(true);
  expect(draw()).toEqual(['cafe','passeio','selfieSolo']);
  economy.earn(honest.id,1);
  expect(draw()).toEqual(['doisPix','cafe','passeio']);
  expect(pay(host,honest,2)).toBe(false);
  expect(pay(traitor,host)).toBe(true);
  expect(pay(traitor,host)).toBe(true);
  expect(view().missions.active.find(mission=>mission.kind==='doisPix')?.current).toBe(1);
  expect(pay(honest,host)).toBe(true);
  expect(view().missions.completed).toContainEqual(expect.objectContaining({kind:'doisPix',current:2}));
});

test('a Pix mission keeps credit from a player who left while another unused sender remains',()=>{
  const match = new PlenaryMatch(1);
  const fourth = {...host,id:'fourth',nick:'Quarto'};
  const players = [host,honest,fourth,traitor];
  expect(match.start(host.id,players,0,()=>.9)).toBe(true);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['doisPix','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const view = ()=>match.view(host.id,players.map(({id})=>id),100).politics!.missions;
  const pay = (from:Player,now:number)=>match.politics(from,{kind:'transfer',to:host.id,amount:1},players,now);
  expect(pay(honest,1)).toBe(true);
  const active = view().active.find(mission=>mission.kind==='doisPix');
  expect(active?.current).toBe(1);
  match.leave(honest.id,2);
  expect(view().active).toContainEqual(active!);
  expect(pay(fourth,3)).toBe(true);
  expect(view().completed).toContainEqual(expect.objectContaining({id:active!.id,current:2}));
});

test.each(['approved','rejected','borrowed'] as const)('Minha Pinga, Minha Vida: %s',scenario=>{
  const players = people.map(person=>({...person}));
  const [rafa,bia,caio] = players;
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  expect(match.start(rafa.id,players,0,()=>.9)).toBe(true);
  game.reset(0,()=>.9,players);
  const inventory = (player:Player,now:number)=>game.view(player,match.gameplayWorld(players,now,()=>false)).inventory;
  const project = bills.findIndex(bill=>bill.id==='PROJ-N02');
  match.gameplayWorld(players,1,()=>false).publish({
    type:'filed',project,actor:rafa.id,item:1,position:terminals.protocol.point,at:0,witnesses:[],
  });
  // A full backpack leaves the allocated dose on the map.
  const create = Reflect.get(game,'create').bind(game);
  for (let i=0;i<INVENTORY_SLOTS;i++) create('coffee',{holder:bia.id});
  match.setPlayerConnected(caio.id,false);
  if (scenario==='borrowed') {
    Reflect.set(match,'budget',.5);
    Reflect.get(match,'cash').projects += ELECTION_RULES.startingBudget-.5;
  }
  const before = match.view(rafa.id,ids,1).budget;
  match.advance(NEGOTIATION_MS);
  if (scenario!=='rejected') for (const player of [rafa,bia]) match.vote(player.id,'yes',NEGOTIATION_MS+1);
  const at = NEGOTIATION_MS+BALLOT_MS;
  const deliver = (recipients:readonly string[])=>{
    expect(recipients).toEqual([rafa.id,bia.id]);
    for (const id of recipients) game.distributePinga(players.find(player=>player.id===id)!,at);
  };
  match.advance(at,deliver);
  match.advance(at,deliver);
  const result = match.view(rafa.id,ids,at);
  expect(result.outcome?.passed).toBe(scenario!=='rejected');
  expect(result.budget).toBe(before-(scenario==='rejected' ? 0 : 1));
  expect(match.economySummary(game.physicalCash()).discrepancy).toBe(0);
  const doses = inventory(rafa,at).filter(item=>item.kind==='pinga');
  expect(doses).toHaveLength(scenario==='rejected' ? 0 : 1);
  if (scenario==='rejected') return;
  expect(doses[0].quantity ?? 1).toBe(1);
  expect(inventory(bia,at)).toHaveLength(INVENTORY_SLOTS);
  const world = match.gameplayWorld(players,at+1,()=>false);
  const dropped = game.view(bia,world).ground.find(item=>item.kind==='pinga');
  expect(dropped).toMatchObject({x:bia.x,y:bia.y});
  expect(game.act(rafa,{kind:'use',item:doses[0].id},world)).toBe('Objeto utilizado.');
  const {factor,durationMs} = pinga.effect.speed;
  expect(rafa.speedModifier).toEqual({factor,remainingMs:durationMs});
  for (let elapsed=STEP_MS;elapsed<durationMs;elapsed+=STEP_MS) restMovement(rafa);
  expect(rafa.speedModifier).toEqual({factor,remainingMs:STEP_MS});
  restMovement(rafa);
  expect(rafa.speedModifier).toBeUndefined();
  expect(inventory(rafa,at+1)).not.toContainEqual(expect.objectContaining({kind:'pinga'}));
  match.setPlayerConnected(caio.id,true);
  expect(inventory(caio,at+1)).toHaveLength(0);
});

test.each([true,false])('energy savings applies to actual maintenance and sabotage rules after approval=%s',approved=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  const project = bills.findIndex(bill=>bill.id==='PROJ-N11');
  match.gameplayWorld(people,1,()=>false).publish({
    type:'filed',project,actor:host.id,item:1,position:terminals.protocol.point,at:0,witnesses:[],
  });
  match.advance(NEGOTIATION_MS);
  if (approved) for (const voter of [host,honest]) match.vote(voter.id,'yes',NEGOTIATION_MS+1);
  const passedAt = NEGOTIATION_MS+BALLOT_MS;
  match.advance(passedAt);
  expect(match.view(host.id,ids,passedAt).policies?.energySavings).toBe(approved ? passedAt+energySavings.duration : undefined);

  const players = [{...host,...powerPanels[0]},{...honest,...powerPanels[1]}];
  const saboteur = {...traitor,...powerPanels[0]};
  const now = passedAt+1;
  expect(match.actOnPower(saboteur,{kind:'sabotage',panel:0},now)).toBe('Energia cortada.');
  match.actOnPower(players[0],{kind:'repair',panel:0},now);
  match.actOnPower(players[1],{kind:'repair',panel:1},now);
  const restored = now+powerRules.repairMs;
  match.advancePower(restored,id=>players.find(player=>player.id===id));
  expect(match.view(traitor.id,ids,restored+energySavings.sabotageCooldown-1).canSabotagePower).toBeUndefined();
  expect(match.view(traitor.id,ids,restored+energySavings.sabotageCooldown).canSabotagePower).toBe(approved ? true : undefined);

  match.advance(ELECTION_RULES.interval);
  expect(match.economySummary(0)).toMatchObject({
    publicDuty:ELECTION_RULES.publicDuty-(approved ? energySavings.publicDutyDiscount : 0),discrepancy:0,
  });
  expect(match.view(host.id,ids,passedAt+energySavings.duration).policies?.energySavings).toBeUndefined();
  match.leave(traitor.id,ELECTION_RULES.interval+1);
  expect(match.view(host.id,ids,ELECTION_RULES.interval+1).policies?.energySavings).toBeUndefined();
});

test.each([true,false])('selective transparency only charges eligible private audit evidence, approval=%s',approved=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const project = bills.findIndex(bill=>bill.id==='PROJ-N08');
  match.gameplayWorld(people,1,()=>false).publish({
    type:'filed',project,actor:host.id,item:1,position:terminals.protocol.point,at:0,witnesses:[],
  });
  match.advance(NEGOTIATION_MS);
  if (approved) for (const player of [host,honest]) match.vote(player.id,'yes',NEGOTIATION_MS+1);
  const resolution = NEGOTIATION_MS+BALLOT_MS;
  match.advance(resolution);
  const now = resolution+1;
  const view = (at=now)=>match.view(traitor.id,ids,at);
  const wallet = ()=>view().politics!.wallet;
  const start = wallet();
  const auditor = at(traitor,'audit');
  expect(match.act(auditor,'audit',now)?.text).toContain('Nenhum registro');
  expect(wallet()).toBe(start);
  expect(match.politics(host,{kind:'transfer',to:honest.id,amount:1},people,now)).toBe(true);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  expect(economy.spend(traitor.id,start)).toBe(true);
  const audit = match.act(auditor,'audit',now);
  expect(audit?.text).toContain(approved ? 'Saldo insuficiente' : 'Documento encontrado');
  expect(view().politics!.evidence).toHaveLength(approved ? 0 : 1);
  if (approved) {
    expect(match.politics(honest,{kind:'transfer',to:traitor.id,amount:2},people,now+1)).toBe(true);
    expect(match.act(auditor,'audit',now+1)?.text).toContain('Documento encontrado');
    expect(wallet()).toBe(1);
    expect(match.act(auditor,'audit',now+2)?.text).toContain('limite');
    expect(wallet()).toBe(1);
    expect(view(now+policyDuration).policies?.bankAudit).toBeUndefined();
  }
  expect(match.economySummary(0).discrepancy).toBe(0);
});

test('successive shop and mail policies keep their own deadlines and public costs',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  const view = (at:number)=>match.view(host.id,ids,at);
  const coffeeProject = bills.findIndex(bill=>bill.id==='PROJ-N05');
  const mail = bills.findIndex(bill=>bill.id==='PROJ-N16');
  const first = NEGOTIATION_MS+BALLOT_MS;
  const nextFiling = first+projectRules.cooldownMs;
  const nextVote = nextFiling+NEGOTIATION_MS;
  const second = nextVote+BALLOT_MS;
  publishProjectFiling(match,host,coffeeProject);
  match.advance(NEGOTIATION_MS);
  const coffee = view(NEGOTIATION_MS);
  for (const voter of [host,honest]) match.vote(voter.id,'yes',NEGOTIATION_MS+1);
  match.advance(first);
  expect(view(first).outcome).toMatchObject({passed:true,applied:{budget:coffee.yes.budget}});
  expect(view(first).budget).toBe(coffee.budget+coffee.yes.budget);
  expect(view(first).policies).toEqual({coffee:first+policyDuration});

  publishProjectFiling(match,host,mail,nextFiling);
  expect(view(first+policyDuration).policies).toEqual({});
  match.advance(nextVote);
  const mailBallot = view(nextVote);
  for (const voter of [host,honest]) match.vote(voter.id,'yes',nextVote+1);
  match.advance(second);
  expect(view(second).outcomes.map(result=>result.passed)).toEqual([true,true]);
  expect(view(second).budget).toBe(mailBallot.budget+mailBallot.yes.budget);
  expect(view(second).policies).toEqual({mail:second+policyDuration});
  expect(view(second+policyDuration).policies).toEqual({});
  expect(match.economySummary(0).discrepancy).toBe(0);
});

test('Herói Inesperado requires an active crisis below the shared stability threshold',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const account = Reflect.get(economy,'accounts').get(honest.id);
  Reflect.set(account.agenda,'missions',[]);
  Reflect.set(account.agenda,'missionDeck',['heroiInesperado']);
  const now = fireRules.firstAfter;
  const view = ()=>match.view(honest.id,ids,now);
  const active = ()=>view().politics!.missions.active.some(mission=>mission.kind==='heroiInesperado');

  Reflect.set(match,'stability',CRISIS_MISSION_STABILITY_LIMIT-1);
  match.refreshAgendaEligibility();
  expect(active()).toBe(false);
  Reflect.set(match,'stability',CRISIS_MISSION_STABILITY_LIMIT);
  match.advance(now);
  const site = view().fire!.site;
  expect(site).toBeDefined();
  match.refreshAgendaEligibility();
  expect(active()).toBe(false);
  Reflect.set(match,'stability',CRISIS_MISSION_STABILITY_LIMIT-1);
  match.refreshAgendaEligibility();
  expect(active()).toBe(true);

  const player = {...honest,...fireSites[site]};
  const before = view().politics!.progression.xp;
  expect(match.actOnFire(player,'extinguish',site,now,true)).toBe('Incêndio apagado.');
  expect(view().politics!.missions.completed.some(mission=>mission.kind==='heroiInesperado')).toBe(true);
  expect(match.actOnFire(player,'extinguish',site,now,true)).toBeUndefined();
  expect(view().politics!.progression.xp).toBe(before+55);
});

test('a project waits for an overlapping hearing and keeps the original proposer',()=>{
  const match = new PlenaryMatch(2);
  match.start(host.id,people,0,()=>.9);
  publishProjectFiling(match,host,4);
  (Reflect.get(match,'economy') as PoliticalEconomy).changePopularity(honest.id,20);
  const startHearing = NEGOTIATION_MS-10_000;
  match.politics(at(honest,'panel'),{kind:'hearing',target:traitor.id},people,startHearing);
  match.advance(NEGOTIATION_MS);
  expect(match.phase).toBe('hearing');
  const hearingEnds = startHearing+HEARING_MS;
  match.advance(hearingEnds);
  match.advance(hearingEnds+1);
  expect(match.view(honest.id,ids,hearingEnds+1)).toMatchObject({
    phase:'ballot',project:4,proposer:host.nick,remaining:BALLOT_MS/1000,
  });
});

test('emergency maintenance is assigned during an outage and rewards both repair operators',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  const accounts = Reflect.get(Reflect.get(match,'economy'),'accounts');
  for (const player of people) {
    const {agenda} = accounts.get(player.id);
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['manutencaoEmergencia','cafe','passeio']);
  }
  const missions = (id:string,now:number)=>match.view(id,ids,now).politics!.missions;
  const isMaintenance = ({kind}:{kind:string})=>kind==='manutencaoEmergencia';
  match.refreshAgendaEligibility();
  expect(missions(host.id,0).active.some(isMaintenance)).toBe(false);
  const operators = [{...host,...powerPanels[0]},{...honest,...powerPanels[1]}];
  expect(match.actOnPower({...traitor,...powerPanels[0]},{kind:'sabotage',panel:0},10)).toBe('Energia cortada.');
  for (const player of people) expect(missions(player.id,10).active.some(isMaintenance)).toBe(true);
  match.actOnPower(operators[0],{kind:'repair',panel:0},11);
  match.actOnPower(operators[1],{kind:'repair',panel:1},11);
  const end = 11+powerRules.repairMs;
  const findOperator = (id:string)=>operators.find(player=>player.id===id);
  match.advancePower(end-1,findOperator);
  expect(missions(host.id,end-1).completed.some(isMaintenance)).toBe(false);
  match.advancePower(end,findOperator);
  for (const player of operators) expect(missions(player.id,end).completed.filter(isMaintenance)).toHaveLength(1);
  expect(missions(traitor.id,end).active.some(isMaintenance)).toBe(false);
  expect(missions(traitor.id,end).completed.some(isMaintenance)).toBe(false);
});

test.each([1,2])('the hearing resolves with the published threshold when %i voters support removal',yesVotes=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  economy.changePopularity(host.id,20);
  match.politics(at(host,'panel'),{kind:'hearing',target:honest.id},people,10);
  const initial = match.view(host.id,ids,10);
  expect(initial.hearing).toMatchObject({voted:0,quorum:2});
  match.vote(host.id,'yes',11);
  match.vote(traitor.id,yesVotes===2 ? 'yes' : 'no',12);
  const during = match.view(host.id,ids,12);
  expect(during.hearing).toMatchObject({voted:2,quorum:2,vote:'yes'});
  match.advance(10+HEARING_MS);
  const after = match.view(honest.id,ids,10+HEARING_MS);
  expect(after.hearing).toBeUndefined();
  expect(after.hearingResult).toContain(yesVotes===2 ? 'aprovado' : 'rejeitado');
});

test('a captured phone game can be reported once with a photo and pays the reporter',()=>{
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  const reporter = {...host,...stations.audit};
  const subject = {...honest,x:reporter.x+12,y:reporter.y};
  const players = [reporter,subject,traitor];
  expect(match.start(reporter.id,players,0,()=>.9)).toBe(true);
  const world = match.gameplayWorld(players,100,()=>false);
  const capture = () => {
    expect(game.act(reporter,{kind:'photo'},world)).toBe('Foto guardada no álbum.');
    world.now += 2000;
    return game.photoView(reporter.id,world.now).album.at(-1)!.photo;
  };

  game.act(subject,{kind:'phone-open'},world);
  const innocent = capture();
  game.act(subject,{kind:'game-start'},world);
  const proof = capture();
  const duplicate = capture();
  expect(match.complaintView(reporter.id,[innocent,proof]).proofs).toEqual([
    {photo:proof.id,kind:'phone-game',target:subject.id,accused:subject.nick},
  ]);
  expect(match.submitComplaint(reporter,subject.id,world.now,innocent)).toContain('incompatível');
  expect(match.submitComplaint({...reporter,x:0,y:0},subject.id,world.now,proof)).toContain('balcão');
  expect(match.submitComplaint(reporter,subject.id,world.now,proof)).toBeUndefined();
  expect(match.submitComplaint(reporter,subject.id,world.now,duplicate)).toContain('incompatível');
  expect(match.complaintView(reporter.id,[proof,duplicate]).proofs).toEqual([]);
  expect(match.view(reporter.id,ids,world.now).politics).toMatchObject({wallet:9,popularity:48,progression:{xp:25}});
  expect(match.view(subject.id,ids,world.now).politics?.popularity).toBe(32);
  const [decision] = match.complaintView(subject.id).history;
  expect(decision).toMatchObject({kind:'phone-game',accused:subject.nick,hasPhoto:true});
  const mail = new InternalMail();
  mail.publishComplaint(decision);
  expect(mail.view()[0]).toMatchObject({author:'Corregedoria',subject:'Infração confirmada · Jogo no celular',
    body:expect.stringContaining(subject.nick)});
});


test('legacy public support commands are rejected',()=>{
  expect(readElectionAction({kind:'support',to:honest.id})).toBeUndefined();
  expect(readElectionAction({kind:'support',to:''})).toBeUndefined();
});

test('the Pix agenda uses the same amount for the wallet check and exact payment',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const agenda = Reflect.get(economy,'accounts').get(host.id).agenda;
  expect(economy.spend(host.id,economy.wallet(host.id)-PIX_MISSION_AMOUNT+1)).toBe(true);
  const missions = ()=>match.view(host.id,ids,10).politics!.missions;
  const draw = ()=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['pixVinte','cafe','passeio','selfieSolo']);
    match.refreshAgendaEligibility();
  };

  draw();
  expect(missions().active.some(row=>row.kind==='pixVinte')).toBe(false);
  economy.earn(host.id,2*PIX_MISSION_AMOUNT);
  draw();
  expect(missions().active).toContainEqual(expect.objectContaining({kind:'pixVinte',current:0}));
  const pay = (amount:number,now:number)=>match.politics(host,{kind:'transfer',to:honest.id,amount},people,now);
  expect(pay(PIX_MISSION_AMOUNT-1,1)).toBe(true);
  expect(missions().active).toContainEqual(expect.objectContaining({kind:'pixVinte',current:0}));
  expect(pay(PIX_MISSION_AMOUNT,2)).toBe(true);
  expect(missions().completed).toContainEqual(expect.objectContaining({kind:'pixVinte',current:1}));
});
