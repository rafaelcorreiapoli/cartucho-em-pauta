import {publishProjectFiling} from '../../server/project-test-fixture';

import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProjectImpact} from './project-impact';
import {ProjectBallot} from './project-ballot';
import {bills,NEGOTIATION_MS,pingaProgram,policyDiscountPercent,policyDuration,recoveryPolicy,stations} from '../plenary';

import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';

test('the project cards display the impacts sent by the gameserver',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  publishProjectFiling(match,player);

  const {yes,no} = match.view(player.id,[player.id],1);
  const markup = renderToStaticMarkup(<ProjectImpact yes={yes} no={no}/>);
  expect(markup).toContain(`id="yes-stability" data-effect="gain">+${yes.stability}</strong>`);
  expect(markup).toContain(`id="yes-budget" data-effect="loss">−R$ 280 mil</strong>`);
  expect(markup).toContain(`id="no-stability" data-effect="loss">−14</strong>`);
});

test('zero has no sign or gain styling',()=>{
  const markup = renderToStaticMarkup(<ProjectImpact yes={{stability:0,budget:0}} no={{stability:0,budget:0}}/>);
  expect(markup.match(/data-effect="neutral">0<\/strong>/g)).toHaveLength(2);
  expect(markup.match(/data-effect="neutral">R\$ 0 mil<\/strong>/g)).toHaveLength(2);
});

test('the ballot displays the catalog banner, policy details and gameserver-funded allowance',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  expect(bills.filter(bill=>bill.id.startsWith('PROJ-N'))).toHaveLength(15);
  for (const bill of bills.filter(entry=>entry.id.startsWith('PROJ-N'))) {
    const match = new PlenaryMatch(1);
    expect(match.start(player.id,[player],0,()=>0)).toBe(true);
    const project = bills.indexOf(bill);
    match.gameplayWorld([player],1,()=>false).publish({
      type:'filed',actor:player.id,item:1,project,position:stations.amendment,at:0,witnesses:[],
    });
    match.advance(NEGOTIATION_MS);
    const view = match.view(player.id,[player.id],NEGOTIATION_MS);
    const markup = renderToStaticMarkup(<ProjectBallot {...view} ownId={player.id} eligible cast={()=>{}}/>);
    expect(markup).toContain(bill.name);
    expect(markup).toContain(`Protocolado por ${player.nick}`);
    expect(markup).toContain(bill.banner!);
    if (bill.effect?.kind==='policy') {
      expect(markup).toContain(bill.effect.detail);
      if (bill.effect.policy==='recovery') {
        expect(markup).toContain(`${recoveryPolicy.hpPerTick} PV a cada ${recoveryPolicy.tickMs/1_000} s durante ${policyDuration/1_000} s`);
      }
      if (['coffee','furniture','equipment','mail'].includes(bill.effect.policy)) {
        expect(markup).toContain(`${policyDiscountPercent}% de desconto`);
        expect(markup).toContain(`por ${policyDuration/1_000} s`);
      }
    } else if (bill.effect?.kind==='pinga-distribution') {
      expect(view.yes.budget).toBe(-pingaProgram.doseCost);
      expect(markup).toContain(pingaProgram.detail);
    } else if (bill.effect?.kind==='allowance') {
      expect(view.yes.budget).toBe(-bill.effect.perMandate);
      expect(markup).toContain('Pagamento único por mandato');
    } else if (bill.effect?.kind==='fire-safety') {
      expect(view.yes.budget).toBe(-3);
      expect(markup).toContain('Mais tempo entre incêndios até o fim da partida');
    } else {
      expect(bill.effect?.kind).toBe('treasury-reputation');
      expect(markup).toContain('Até +2 popularidade por entrega · 90 s');
    }
  }
});
