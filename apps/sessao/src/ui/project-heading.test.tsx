import {publishProjectFiling} from '../../server/project-test-fixture';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {BALLOT_MS,NEGOTIATION_MS} from '../plenary';
import {ELECTION_RULES} from '../elections';
import {ProjectCatalog} from './project-catalog';
import {ProjectHeading,projectHeading} from './project-heading';

test('the heading displays the active project and switches to the isolation clock',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  publishProjectFiling(match,player);
  const view = match.view(player.id,[player.id],1);
  const markup = renderToStaticMarkup(<ProjectHeading {...projectHeading(view)}/>);
  expect(markup).toContain('Auxílio Churrasco');
  expect(markup).toContain('Votação em');
  expect(markup).toContain('data-urgent="false"');
  const isolated = renderToStaticMarkup(<ProjectHeading {...projectHeading({...view,isolationSeconds:8})}/>);
  expect(isolated).toContain('Isolamento');
  expect(isolated).toContain('0:08');
  expect(isolated).toContain('data-urgent="true"');
});

test('the HUD shows the session clock before any filing',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>0);
  const initial = renderToStaticMarkup(<ProjectHeading {...projectHeading(match.view(player.id,[player.id],0))}/>);
  expect(initial).toContain('Nenhum projeto em pauta');
  expect(initial).toContain('0 projetos votados');
  expect(initial).toContain('Fim da sessão');
  const world = match.gameplayWorld([player],10,()=>false);
  const file = (item:number,project:number)=>world.publish({
    type:'filed',actor:player.id,item,project,at:10,position:player,witnesses:[],
  });
  file(1,0);
  file(2,1);
  file(2,1);
  match.advance(NEGOTIATION_MS);
  const markup = renderToStaticMarkup(<ProjectHeading {...projectHeading(match.view(player.id,[player.id],NEGOTIATION_MS))}/>);
  expect(markup).toContain('Auxílio Churrasco');
  expect(markup).toContain('Protocolado por Rafa');
});

test('protocol and both project views agree on the exact filing deadline',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  const deadline = ELECTION_RULES.matchDuration-NEGOTIATION_MS-BALLOT_MS;
  const view = (now:number)=>match.view(player.id,[player.id],now);
  const reason = (now:number)=>match.gameplayWorld([player],now,()=>false).projectFilingError?.(player.id,0);
  expect(reason(deadline)).toBeUndefined();
  expect(renderToStaticMarkup(<ProjectCatalog {...view(deadline)}/>)).toContain('Disponível');
  expect(reason(deadline+1)).toBe('Não há tempo para votar outro projeto nesta partida.');
  const closed = view(deadline+1);
  const catalog = renderToStaticMarkup(<ProjectCatalog {...closed}/>);
  expect(catalog).toContain('Protocolo de projetos encerrado.');
  expect(catalog).toContain('Fora do prazo');
  expect(catalog).not.toContain('Solicite um documento');
  expect(renderToStaticMarkup(<ProjectHeading {...projectHeading(closed)}/>)).toContain('Protocolo de projetos encerrado.');
});
