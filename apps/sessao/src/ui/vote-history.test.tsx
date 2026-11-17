import {publishProjectFiling} from '../../server/project-test-fixture';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {BALLOT_MS,NEGOTIATION_MS} from '../plenary';
import type {Player} from '../map';
import {VoteBrief,VoteHistory} from './vote-history';

test('the history renders the latest authoritative result and enables previous pages',()=>{
  const match = new PlenaryMatch(1);
  const player:Player = {id:'a',nick:'A',character:0,direction:0,moving:false,x:140,y:146};
  match.start(player.id,[player],0,()=>0);
  publishProjectFiling(match,player);
  const getOutcomes = ()=>match.view(player.id,[player.id],0).outcomes;
  expect(renderToStaticMarkup(<VoteHistory outcomes={getOutcomes()}/>)).toBe('');
  match.advance(NEGOTIATION_MS);
  match.vote(player.id,'yes',NEGOTIATION_MS+1);
  const firstEnd = NEGOTIATION_MS+BALLOT_MS;
  match.advance(firstEnd);
  expect(renderToStaticMarkup(<VoteHistory outcomes={getOutcomes()}/>)).toContain('Auxílio Churrasco: aprovado. 1 a favor, 0 contra.');
  const nextFiling = firstEnd+60_000;
  publishProjectFiling(match,player,1,nextFiling);
  match.advance(nextFiling+NEGOTIATION_MS);
  match.advance(nextFiling+NEGOTIATION_MS+BALLOT_MS);
  const markup = renderToStaticMarkup(<VoteHistory outcomes={getOutcomes()}/>);
  expect(markup).toContain('Votação 2 de 2');
  const [first,second] = getOutcomes();
  expect(renderToStaticMarkup(<VoteBrief outcome={first}/>)).toContain('id="brief-yes">1');
  const brief = renderToStaticMarkup(<VoteBrief outcome={second}/>);
  expect(brief).toContain('Projeto rejeitado');
  expect(brief).toContain('id="brief-stability" data-effect="loss"');

  expect(markup).toContain('Wi-Fi na Praça: rejeitado. 0 a favor, 0 contra.');
  expect(markup).toContain('Ninguém votou');
  expect(markup).toContain(`Protocolado por ${player.nick}`);
  expect(markup).toContain('aria-label="Votação anterior">');
  expect(markup).toContain('aria-label="Próxima votação" disabled=""');
});
