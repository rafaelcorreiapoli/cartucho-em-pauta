import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {NEGOTIATION_MS} from '../plenary';
import {ProjectHeading,projectHeading} from './project-heading';

test('the heading displays the active project and switches to the isolation clock',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
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

test('the vote HUD counts distinct queued projects from authoritative filings',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>0);
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
  expect(markup).toContain('Projeto 1 · +1 na pauta');
});
