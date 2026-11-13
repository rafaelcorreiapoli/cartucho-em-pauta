import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
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
