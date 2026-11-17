import {publishProjectFiling} from '../../server/project-test-fixture';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {ProjectDetails,ProjectIntents} from './project-intents';

test('the HUD reflects declarations and withdrawals from the gameserver',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  publishProjectFiling(match,player);
  const render = ()=>renderToStaticMarkup(<ProjectIntents view={match.view(player.id,[player.id],1)} id={player.id} declare={()=>{}}/>);
  expect(render()).not.toContain('Retirar');
  match.declareVote(player.id,'yes',1);
  expect(render()).toContain('data-intent="yes" aria-pressed="true"');
  expect(render()).toContain('Rafa');
  expect(render()).toContain('Retirar');
  match.declareVote(player.id,null,2);
  expect(render()).not.toContain('intent-summary');
  expect(render()).not.toContain('Retirar');
});

test('the project details render an audit note from the authoritative view',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>0);
  publishProjectFiling(match,player);
  const view = match.view(player.id,[player.id],1);
  const markup = renderToStaticMarkup(<ProjectDetails id={player.id} declare={()=>{}}
    view={{...view,audit:'fraud',auditNote:'Documento encontrado.'}}/>);
  expect(markup).toContain('Auxílio Churrasco');
  expect(markup).toContain('Parlamentares aptos a votar: 1');
  expect(markup).toContain('Votos a favor para aprovar: 1');
  expect(markup).toContain('Documento encontrado. Fraude encontrada.');
});
