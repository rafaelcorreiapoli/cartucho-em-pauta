import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {bills,stations} from '../plenary';
import {LegislativeBrief} from './legislative-brief';

test('the Secretary shows the filed project only',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  const view = ()=>match.view(player.id,[player.id],11);
  const initial = renderToStaticMarkup(<LegislativeBrief activity="secretary" view={view()}/>);
  expect(initial).toContain('Nenhum projeto em pauta');
  expect(initial).not.toContain('Próximos na pauta');
  const world = match.gameplayWorld([player],10,()=>false);
  for (const project of [2,1]) world.publish({
    type:'filed',actor:player.id,kind:'document',item:project+1,project,position:stations.amendment,at:10,witnesses:[],
  });
  const agenda = renderToStaticMarkup(<LegislativeBrief activity="secretary" view={view()}/>);
  expect(agenda).toContain(bills[2].name);
  expect(agenda).not.toContain(bills[1].name);
});

test('the Archive shows only the public ledger, even for a player who holds private evidence',()=>{
  const rafa:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const bia = {...rafa,id:'b',nick:'Bia'};
  const players = [rafa,bia];
  const match = new PlenaryMatch(1);
  expect(match.start(rafa.id,players,0,()=>0)).toBe(true);
  const render = ()=>renderToStaticMarkup(<LegislativeBrief activity="archive"
    view={match.view(bia.id,players.map(({id})=>id),3)}/>);
  match.politics(rafa,{kind:'transfer',to:bia.id,amount:2,clandestine:true},players,1);
  expect(render()).toContain('Nenhum registro público.');
  match.politics(rafa,{kind:'transfer',to:bia.id,amount:1,clandestine:false},players,2);
  const archive = render();
  expect(archive).toContain('Rafa → Bia · R$ 10 mil · pagamento público.');
  expect(archive).not.toContain('R$ 20 mil');
});
