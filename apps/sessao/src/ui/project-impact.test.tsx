import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProjectImpact} from './project-impact';
import {ProjectBallot} from './project-ballot';
import {bills,NEGOTIATION_MS,stations} from '../plenary';

import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';

test('the project cards display the impacts sent by the gameserver',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  const {yes,no} = match.view(player.id,[player.id],1);
  const markup = renderToStaticMarkup(<ProjectImpact yes={yes} no={no}/>);
  expect(markup).toContain(`id="yes-stability" data-effect="gain">+${yes.stability}</strong>`);
  expect(markup).toContain(`id="yes-budget" data-effect="loss">${yes.budget}</strong>`);
  expect(markup).toContain(`id="no-stability" data-effect="loss">${no.stability}</strong>`);
});

test('zero has no sign or gain styling',()=>{
  const markup = renderToStaticMarkup(<ProjectImpact yes={{stability:0,budget:0}} no={{stability:0,budget:0}}/>);
  expect(markup.match(/data-effect="neutral">0<\/strong>/g)).toHaveLength(4);
});

test('the ballot displays the catalog banner, policy details and gameserver-funded allowance',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  for (const id of ['PROJ-N03','PROJ-N05','PROJ-N06','PROJ-N07','PROJ-N09','PROJ-N12','PROJ-N15','PROJ-N16']) {
    const match = new PlenaryMatch(1);
    expect(match.start(player.id,[player],0,()=>0)).toBe(true);
    const project = bills.findIndex(entry=>entry.id===id);
    const bill = bills[project];
    match.gameplayWorld([player],1,()=>false).publish({
      type:'filed',actor:player.id,item:1,project,position:stations.amendment,at:1,witnesses:[],
    });
    match.advance(NEGOTIATION_MS);
    const view = match.view(player.id,[player.id],NEGOTIATION_MS);
    const markup = renderToStaticMarkup(<ProjectBallot {...view} ownId={player.id} eligible cast={()=>{}}/>);
    expect(markup).toContain(bill.name);
    expect(markup).toContain(bill.banner!);
    if (bill.effect?.kind==='policy') expect(markup).toContain(bill.effect.detail);
    else {
      expect(view.yes.budget).toBe(-0.5);
      expect(markup).toContain('Pagamento único por mandato');
    }
  }
});
