import { PoliticalEconomy } from './PoliticalEconomy';
import { ELECTION_RULES } from '../src/elections';
import { expect, test } from 'bun:test';
import { HEARING_MS } from '../src/politics';

import { BALLOT_MS, NEGOTIATION_MS, stations } from '../src/plenary';
import { canStand, localPerception, type Player } from '../src/map';
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

test('the new wings and all stations are reachable from the corridor', () => {
  for (const {x,y} of [...Object.values(stations),{x:860,y:506},{x:449,y:504}]) {
    expect(findRoute(host,{x,y}).at(-1)).toEqual({x,y});
  }
});

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
  match.politics(traitor,{kind:'accept',offer:offer.id},people,10);
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

test('campaign unlocks a hearing, then a wrong removal costs stability and the player can still trade', () => {
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
  expect(view(host).politics?.wallet).toBe(7);
  match.advance(resumed+NEGOTIATION_MS-50);
  match.vote(honest.id,'yes',resumed+NEGOTIATION_MS);
  expect(view(honest).vote).toBeUndefined();
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
