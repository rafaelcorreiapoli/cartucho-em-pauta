import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {bills,stations} from '../plenary';
import {LegislativeBrief} from './legislative-brief';

test('the Secretary shows the authoritative agenda after filings and the default before them',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  const view = ()=>match.view(player.id,[player.id],11);
  const initial = renderToStaticMarkup(<LegislativeBrief activity="secretary" view={view()}/>);
  expect(initial).toContain(bills[0].name);
  expect(initial).not.toContain('Próximos na pauta');
  const world = match.gameplayWorld([player],10,()=>false);
  for (const project of [2,1]) world.publish({
    type:'filed',actor:player.id,kind:'document',item:project+1,project,position:stations.amendment,at:10,witnesses:[],
  });
  const agenda = renderToStaticMarkup(<LegislativeBrief activity="secretary" view={view()}/>);
  expect(agenda).toContain(bills[2].name);
  expect(agenda).toContain(`<ol><li>${bills[1].name}</li></ol>`);
  const impact = renderToStaticMarkup(<LegislativeBrief activity="support" view={view()}/>);
  expect(impact).toContain('id="brief-yes-stability"');
  expect(impact).toContain(bills[2].name);
});
