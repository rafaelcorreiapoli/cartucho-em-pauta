import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProjectImpact} from './project-impact';
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
