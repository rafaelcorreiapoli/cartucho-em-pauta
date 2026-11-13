import { InternalMail } from './InternalMail';
import {Gameplay} from './Gameplay';
import {terminals} from '../src/gameplay';
import {privateOffices} from '../src/private-offices';
import {fireRules,fireSites} from '../src/fire';
import { PoliticalEconomy } from './PoliticalEconomy';
import { ELECTION_RULES } from '../src/elections';
import { expect, test } from 'bun:test';
import { HEARING_MS } from '../src/politics';

import { BALLOT_MS, NEGOTIATION_MS, stations } from '../src/plenary';
import { canStand, localPerception, worldVisible, type Player } from '../src/map';
import { findRoute } from '../src/navigation';
import { PlenaryMatch } from './PlenaryMatch';

const ids = ['lula','bolsonaro','trump'];
const people = ids.map((id,character):Player => ({id,nick:['Lula','Bolsonaro','Trump'][character],character,x:140+36*character,y:146,direction:0,moving:false}));
const [host,honest,traitor] = people;
const at = (player:Player, station:keyof typeof stations) => ({...player,...stations[station]});

test('fraud shows different figures until a player audits and reports it', () => {
  const match = new PlenaryMatch(1);
  expect(match.start(honest.id,people,0)).toBe(false);
  expect(match.start(host.id,[],0)).toBe(false);
  expect(match.start(host.id,people,0,() => .9)).toBe(true);
  const view = (player:Player) => match.view(player.id,ids,0);
  expect(view(host).role).toBe('Parlamentar');
  expect(view(host).infiltratorName).toBeUndefined();
  expect(view(traitor).role).toBe('Infiltrado');
  match.act(at(honest,'panel'),'fraud',1);
  match.act(traitor,'fraud',2);
  expect(view(host).yes.budget).toBe(-28);
  match.act(at(traitor,'panel'),'fraud',3);
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
  let now = 0;
  for (let round=0;round<3;round++) {
    if (round===0) {
      match.act(at(host,'amendment'),'amendment',now+1);
      match.act(at(traitor,'panel'),'fraud',now+2);
      expect(match.view(host.id,ids,now).yes.budget).toBe(0);
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
      expect(view.budget).toBe(20);
      expect(view.outcome?.applied).toEqual({budget:-12,stability:14});
    }
  }
  match.advance(ELECTION_RULES.matchDuration);
  expect(match.view(host.id,ids,now)).toMatchObject({phase:'finished',winner:'Parlamentar',infiltratorName:'Trump'});
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
  const view = (player:Player) => match.view(player.id,ids,0);
  const accounts = [host,honest,traitor].map(player => view(player).politics!);
  for (const account of accounts) expect(account.missions.active).toHaveLength(3);
  expect(view(host).politics?.wallet).toBe(8);
  match.politics(host,{kind:'grant',diverted:3},people,1); // Too far from the cabinet.
  expect(view(host).budget).toBe(32);
  match.politics(at(host,'cabinet'),{kind:'grant',diverted:3},people,2);
  match.politics(at(host,'cabinet'),{kind:'grant',diverted:3},people,3);
  expect(view(host)).toMatchObject({budget:28,stability:47,politics:{wallet:11}});
  expect(view(honest).politics?.evidence).toEqual([]);
  match.politics(host,{kind:'transfer',to:honest.id,amount:2,clandestine:true},people,4);
  match.politics(host,{kind:'transfer',to:traitor.id,amount:2,clandestine:false},people,5); // Beyond trade distance.
  match.politics(host,{kind:'transfer',to:honest.id,amount:100,clandestine:false},people,6);
  expect(view(host).politics?.wallet).toBe(9);
  expect(view(honest).politics?.wallet).toBe(10);
  expect(view(traitor).politics?.ledger).toEqual([]);
  match.politics(honest,{kind:'transfer',to:traitor.id,amount:1,clandestine:false},people,7);
  expect(view(host).politics?.ledger.at(-1)?.kind).toBe('public-transfer');

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

test('campaign unlocks a hearing, then a wrong removal costs stability and isolates the player for sixty seconds', () => {
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,() => .9);
  const view = (player:Player) => match.view(player.id,ids,0);
  match.politics(at(host,'panel'),{kind:'hearing',target:honest.id},people,10);
  expect(view(host).phase).toBe('negotiation');
  match.politics(at(host,'press'),{kind:'campaign'},people,20);
  match.politics(at(host,'press'),{kind:'campaign'},people,21);
  expect(view(host).politics).toMatchObject({wallet:6,popularity:57,canCallHearing:true});
  match.politics(at(host,'panel'),{kind:'hearing',target:honest.id},people,50);
  expect(view(host).hearing?.target).toContain('Bolsonaro');
  match.vote(host.id,'yes',60);
  match.vote(traitor.id,'yes',60);
  const resumed = 50+HEARING_MS;
  match.advance(resumed);
  expect(view(host)).toMatchObject({phase:'negotiation',stability:36,electorate:2});
  expect(view(honest).politics?.suspended).toBe(true);
  expect(view(honest).role).toBe('Parlamentar');
  match.politics(honest,{kind:'transfer',to:host.id,amount:1,clandestine:false},people,resumed+1);
  expect(view(host).politics?.wallet).toBe(6);
  expect(match.view(honest.id,ids,resumed).isolationSeconds).toBe(60);
  expect(match.canHandleObjects(honest.id,resumed)).toBe(false);
  match.advance(resumed+59_999);
  expect(match.view(honest.id,ids,resumed+59_999).isolationSeconds).toBe(1);
  match.advance(resumed+60_000);
  expect(match.view(honest.id,ids,resumed+60_000).isolationSeconds).toBeUndefined();
  expect(match.canHandleObjects(honest.id,resumed+60_000)).toBe(true);
  match.advance(resumed+NEGOTIATION_MS-50);
  match.vote(honest.id,'yes',resumed+NEGOTIATION_MS);
  expect(view(honest).vote).toBe('yes');
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

test('room activities require proximity, and a cafezinho completes its mission', () => {
  const match = new PlenaryMatch(1);
  match.start(host.id,[host],0,() => .4);
  const missions = () => match.view(host.id,[host.id],1).politics!.missions;
  expect(missions().active.some(mission => mission.kind==='cafe')).toBe(true);
  expect(match.roomActivity(host,'coffee',1)).toBeUndefined();
  const cafe = at(host,'coffee');
  expect(match.roomActivity(cafe,'coffee',2)?.text).toContain('Cafezinho tomado');
  expect(missions().completed.map(mission => mission.kind)).toEqual(['cafe']);
  expect(missions().active).toHaveLength(3);
  match.roomActivity(cafe,'coffee',3);
  expect(missions().completed).toHaveLength(1);
  expect(missions().active.some(mission => mission.kind==='cafe')).toBe(false);
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

test('validated filings schedule distinct successive ballots, with the standard bill as fallback',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const world = match.gameplayWorld(people,10,()=>false);
  const file = (project:number)=>world.publish({
    type:'filed',actor:host.id,kind:'document',project,position:stations.amendment,at:10,witnesses:[],
  });
  file(2);
  file(2);
  file(0);
  const view = (now:number)=>match.view(host.id,ids,now);
  expect(view(10)).toMatchObject({project:2,queuedProjects:[2,0]});
  match.advance(NEGOTIATION_MS);
  expect(view(NEGOTIATION_MS)).toMatchObject({phase:'ballot',project:2,queuedProjects:[0]});
  match.vote(host.id,'yes',NEGOTIATION_MS+1);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  expect(view(NEGOTIATION_MS+BALLOT_MS)).toMatchObject({phase:'ballot',project:0,outcome:{project:2}});
  expect(view(NEGOTIATION_MS+BALLOT_MS).vote).toBeUndefined();
  match.advance(NEGOTIATION_MS+BALLOT_MS*2);
  expect(view(NEGOTIATION_MS+BALLOT_MS*2).outcomes.map(result=>result.project)).toEqual([2,0]);
  match.advance(NEGOTIATION_MS*2+BALLOT_MS*2);
  expect(view(NEGOTIATION_MS*2+BALLOT_MS*2)).toMatchObject({phase:'ballot',project:2});
});

test('only infiltrators can start a fire, and nearby parliamentarians can put it out',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const now = fireRules.firstAfter/2;
  match.advance(now);
  const view = (player:Player, at=now) => match.view(player.id,ids,at);
  const site = view(traitor).sabotageFireSite!;
  expect(site).toBeDefined();
  expect(view(honest).sabotageFireSite).toBeUndefined();
  expect(match.actOnFire({...honest,...fireSites[site]},'ignite',site,now)).toBeUndefined();
  expect(match.actOnFire(traitor,'ignite',site,now)).toBeUndefined();
  expect(match.actOnFire({...traitor,...fireSites[site]},'ignite',site,now)).toBe('Incêndio provocado.');
  expect(view(honest).fire?.site).toBe(site);
  match.advance(now+fireRules.tick);
  expect(view(honest,now+fireRules.tick).stability).toBe(48-fireRules.damage);
  expect(match.actOnFire(honest,'extinguish',site,now+fireRules.tick)).toBeUndefined();
  expect(match.actOnFire({...honest,...fireSites[site].extinguisher},'extinguish',site,now+fireRules.tick)).toBe('Incêndio apagado.');
  expect(view(honest,now+fireRules.tick).fire).toBeUndefined();
});

test('an informal loan and a later manual repayment conserve both wallets',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const lender = {...host,x:140,y:146};
  const borrower = {...honest,x:148,y:146};
  const group = [lender,borrower,traitor];
  const wallet = (player:Player) => match.view(player.id,ids,0).politics!.wallet;
  match.politics(lender,{kind:'transfer',to:borrower.id,amount:3,clandestine:true},group,1);
  expect([wallet(lender),wallet(borrower)]).toEqual([5,11]);
  match.advance(10_000);
  expect([wallet(lender),wallet(borrower)]).toEqual([5,11]);
  match.politics(borrower,{kind:'transfer',to:lender.id,amount:3,clandestine:true},group,10_001);
  expect([wallet(lender),wallet(borrower)]).toEqual([8,8]);
});

test('a public intention can be withdrawn or contradicted by the actual vote',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
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
  match.politics(at(host,'press'),{kind:'campaign'},people,20);
  match.politics(at(host,'press'),{kind:'campaign'},people,21);
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
  expect(worldVisible(outside,inside)).toBe(true);
  expect(worldVisible({...outside,barriers:[office.door]},inside)).toBe(false);
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
  match.politics(player,{kind:'transfer',to:receiver.id,amount:3,clandestine:true},group,4001);
  expect(world.spend!(player.id,1.5)).toBe(true);
  expect(match.economySummary(game.physicalCash())).toMatchObject({transferred:3,reserveFees:1.5,discrepancy:0});
  Object.assign(player,terminals.treasury.point);
  expect(game.act(player,{kind:'deliver',item:item.id,place:'treasury'},world)).toContain('Tesouraria');
  expect(match.economySummary(game.physicalCash())).toMatchObject({treasury:3,physical:0,discrepancy:0});
  match.advance(NEGOTIATION_MS);
  match.vote(host.id,'yes',NEGOTIATION_MS+1);
  match.vote(honest.id,'yes',NEGOTIATION_MS+1);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  expect(match.economySummary(game.physicalCash())).toMatchObject({projects:28,discrepancy:0});
  match.advance(ELECTION_RULES.interval);
  expect(match.economySummary(game.physicalCash())).toMatchObject({publicDuty:4.2,salaries:2.7,discrepancy:0});
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
  match.politics({...honest,x:player.x+8,y:player.y},{kind:'transfer',to:player.id,amount:1,clandestine:false},[player],world.now);
  expect(mail.publish(player,message,world)).toBeUndefined();
  expect(mail.publish(player,message,world)).toContain('Aguarde');
  expect(mail.view()).toHaveLength(1);
  expect(summary()).toMatchObject({reserveFees:8.5,transferred:1,expired:3,discrepancy:0});
});

test('the agenda counts queued ballots even at the end of the standard project rotation',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  Reflect.set(match,'round',2);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  const prepareDraw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['oposicao','cafe','passeio','selfieSolo']);
  };
  const active = () => match.view(host.id,ids,10).politics!.missions.active;
  prepareDraw();
  match.refreshAgendaEligibility();
  expect(active().some(mission=>mission.kind==='oposicao')).toBe(false);

  const world = match.gameplayWorld(people,10,()=>false);
  const file = (project:number) => world.publish({
    type:'filed',actor:host.id,kind:'document',project,position:stations.amendment,at:10,witnesses:[],
  });
  file(2);
  prepareDraw();
  file(0);
  expect(active().find(mission=>mission.kind==='oposicao')).toMatchObject({current:0,target:2});

  match.advance(NEGOTIATION_MS);
  match.vote(host.id,'no',NEGOTIATION_MS+1);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  expect(active().find(mission=>mission.kind==='oposicao')).toMatchObject({current:1,target:2});
  match.vote(host.id,'no',NEGOTIATION_MS+BALLOT_MS+1);
  match.advance(NEGOTIATION_MS+2*BALLOT_MS);
  expect(match.view(host.id,ids,0).politics?.missions.completed).toContainEqual(expect.objectContaining({kind:'oposicao'}));
});

test('campaign missions return to the draw after renewal resets used actions',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  const resetDraw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['propaganda','discurso','cafe','passeio','selfieSolo']);
  };
  const active = () => match.view(host.id,ids,0).politics!.missions.active.map(mission=>mission.kind);
  match.electionAction(at(host,'press'),{kind:'advertise'},1,false);
  match.electionAction(at(host,'panel'),{kind:'speech'},2,false);
  resetDraw();
  match.refreshAgendaEligibility();
  expect(active()).toEqual(['cafe','passeio','selfieSolo']);

  resetDraw();
  Reflect.set(match,'ends',ELECTION_RULES.interval+100);
  match.advance(ELECTION_RULES.interval);
  expect(active()).toEqual(['propaganda','discurso','cafe']);
  match.electionAction(at(host,'press'),{kind:'advertise'},ELECTION_RULES.interval+1,false);
  expect(match.view(host.id,ids,0).politics?.missions.completed).toContainEqual(expect.objectContaining({kind:'propaganda'}));
});

test('a used amendment stays out of the mission draw until the next negotiation',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  const {agenda} = Reflect.get(economy,'accounts').get(host.id);
  const resetDraw = () => {
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['emenda','cafe','passeio','selfieSolo']);
  };
  const active = () => match.view(host.id,ids,0).politics!.missions.active.map(mission=>mission.kind);
  match.act(at(honest,'amendment'),'amendment',1);
  resetDraw();
  match.refreshAgendaEligibility();
  expect(active()).toEqual(['cafe','passeio','selfieSolo']);
  resetDraw();
  match.advance(NEGOTIATION_MS);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  expect(active()).toContain('emenda');
  match.act(at(host,'amendment'),'amendment',NEGOTIATION_MS+BALLOT_MS+1);
  expect(match.view(host.id,ids,0).politics?.missions.completed).toContainEqual(expect.objectContaining({kind:'emenda'}));
});

test('a station rejects a nearby player blocked by a barrier or carrying someone',()=>{
  const match = new PlenaryMatch(1);
  match.start(host.id,people,0,()=>.9);
  const {x,y} = stations.coffee;
  const nearby:Player = {...host,x:x+8,y};
  expect(match.roomActivity({...nearby,barriers:[[x+3,y-2,2,4]]},'coffee',1)).toBeUndefined();
  expect(match.roomActivity({...nearby,carrying:true},'coffee',2)).toBeUndefined();
  expect(match.roomActivity(nearby,'coffee',3)?.activity).toBe('coffee');
});
