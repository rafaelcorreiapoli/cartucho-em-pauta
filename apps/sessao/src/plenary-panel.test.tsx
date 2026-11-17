import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../server/PlenaryMatch';
import {publishProjectFiling} from '../server/project-test-fixture';
import {BALLOT_MS,NEGOTIATION_MS} from './plenary';
import type {Player} from './map';
import {LegislativeDock} from './plenary-panel';

test('the legislative dock presents the authoritative project, current vote and result in one tree',()=>{
  const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,x:140,y:146};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  publishProjectFiling(match,player);
  const markup = (now:number,showBrief=false)=>{
    const view = match.view(player.id,[player.id],now);
    return renderToStaticMarkup(<LegislativeDock view={view} id={player.id} command={()=>{}}
      outcomes={view.outcomes} brief={showBrief ? view.outcome : undefined}/>);
  };

  const proposal = markup(1);
  expect(proposal).toContain('Auxílio Churrasco');
  expect(proposal).toContain('id="ballot-host" hidden=""');
  expect(proposal).not.toContain('data-vote="yes"');

  match.advance(NEGOTIATION_MS);
  match.vote(player.id,'yes',NEGOTIATION_MS+1);
  const ballot = markup(NEGOTIATION_MS+1);
  expect(ballot).toContain('data-vote-state="yes"');
  expect(ballot).toMatch(/<button[^>]*data-vote="yes"[^>]*aria-pressed="true"/);
  expect(ballot).not.toContain('id="bill">');

  const finished = NEGOTIATION_MS+BALLOT_MS;
  match.advance(finished);
  const result = markup(finished,true);
  expect(result).toContain('Projeto aprovado');
  expect(result).toContain('aria-label="Votação 1 de 1"');
  expect(result).not.toContain('data-vote="yes"');
});
