import { expect, test } from 'bun:test';
import { BALLOT_MS, NEGOTIATION_MS, stations } from '../src/plenary';
import { canStand, localPerception, type Player } from '../src/map';
import { findRoute } from '../src/navigation';
import { PlenaryMatch } from './PlenaryMatch';

const ids = ['lula','bolsonaro','trump'];
const people = ids.map((id,character):Player => ({id,character,x:140+36*character,y:146,direction:0,moving:false}));
const [host,honest,traitor] = people;
const at = (player:Player, station:keyof typeof stations) => ({...player,...stations[station]});

test('fraud shows different figures until a player audits and reports it', () => {
  const match = new PlenaryMatch();
  expect(match.start(honest.id,people,0)).toBe(false);
  expect(match.start(host.id,people.slice(0,2),0)).toBe(false);
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
  match.act(at(honest,'audit'),'audit',4);
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
  const match = new PlenaryMatch();
  match.start(host.id,people,0,() => .9);
  let now = 0;
  for (let round=0;round<3;round++) {
    if (round===0) {
      match.act(at(host,'amendment'),'amendment',now+1);
      match.act(at(traitor,'panel'),'fraud',now+2);
      expect(match.view(host.id,ids,now).yes.budget).toBe(12);
    }
    match.advance(now+=NEGOTIATION_MS);
    match.vote(host.id,'yes',now);
    match.vote(honest.id,'yes',now);
    match.vote(honest.id,round===0 ? 'yes' : 'no',now+1);
    match.vote(traitor.id,'yes',now+BALLOT_MS); // Deadline is exclusive.
    match.advance(now+=BALLOT_MS);
    const view = match.view(host.id,ids,now);
    expect(view.outcome?.passed).toBe(round===0);
    if (round===0) expect(view.budget).toBe(20);
  }
  expect(match.view(host.id,ids,now)).toMatchObject({phase:'finished',winner:'Parlamentar',infiltratorName:'Trump · rump'});
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
