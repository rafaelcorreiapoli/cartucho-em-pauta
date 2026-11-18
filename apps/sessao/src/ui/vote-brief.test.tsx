import {publishProjectFiling} from '../../server/project-test-fixture';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {BALLOT_MS,NEGOTIATION_MS} from '../plenary';
import type {Player} from '../map';
import {VoteBrief} from './vote-brief';

test('the result brief presents the authoritative outcome and impacts',()=>{
  const match = new PlenaryMatch(1);
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,x:140,y:146};
  match.start(player.id,[player],0,()=>0);
  publishProjectFiling(match,player);
  const getOutcomes = ()=>match.view(player.id,[player.id],0).outcomes;
  match.advance(NEGOTIATION_MS);
  match.vote(player.id,'yes',NEGOTIATION_MS+1);
  const firstEnd = NEGOTIATION_MS+BALLOT_MS;
  match.advance(firstEnd);
  const nextFiling = firstEnd+60_000;
  publishProjectFiling(match,player,1,match.gameTime(nextFiling));
  match.advance(nextFiling+NEGOTIATION_MS);
  match.advance(nextFiling+NEGOTIATION_MS+BALLOT_MS);
  const [first,second] = getOutcomes();
  expect(renderToStaticMarkup(<VoteBrief outcome={first}/>)).toContain('id="brief-yes">1');
  expect(renderToStaticMarkup(<VoteBrief outcome={first}/>)).toContain('id="brief-budget" data-effect="loss">−R$ 280 mil');
  const brief = renderToStaticMarkup(<VoteBrief outcome={second}/>);
  expect(brief).toContain('Projeto rejeitado');
  expect(brief).toContain('id="brief-stability" data-effect="loss"');
});

test('the official result distinguishes an abstention from an uncast vote',()=>{
  const match = new PlenaryMatch(1);
  const host:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,x:140,y:146};
  const players = [host,{...host,id:'b',nick:'B'},{...host,id:'c',nick:'C'}];
  const ids = players.map(({id})=>id);
  expect(match.start(host.id,players,0,()=>.9)).toBe(true);
  publishProjectFiling(match,host);
  match.advance(NEGOTIATION_MS);
  match.vote(host.id,'abstain',NEGOTIATION_MS+1);
  match.vote('b','yes',NEGOTIATION_MS+1);
  match.vote('b','abstain',NEGOTIATION_MS+2);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  const {outcome} = match.view(host.id,ids,NEGOTIATION_MS+BALLOT_MS);
  expect(outcome).toMatchObject({passed:false,yes:0,no:0,abstentions:2,absences:1});
  expect(renderToStaticMarkup(<VoteBrief outcome={outcome!}/>)).toContain('2 abstenções · 1 sem voto');
});
