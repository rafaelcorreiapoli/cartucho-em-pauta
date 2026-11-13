import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {SessionResult} from './results';
import {PlenaryMatch} from '../server/PlenaryMatch';
import {NEGOTIATION_MS,BALLOT_MS} from './plenary';
import type {Player} from './map';

test('a player outside the plenary receives the final result in the modal content',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,direction:0,moving:false,x:140,y:146};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>0);
  const deadline = 30*60_000;
  for (let now=0;now<=deadline;now+=Math.min(NEGOTIATION_MS,BALLOT_MS)) match.advance(now);
  const view = match.view(player.id,[player.id],deadline);
  expect(view.phase).toBe('finished');
  const markup = renderToStaticMarkup(<SessionResult {...view}/>);
  expect(markup).toContain(view.reason!);
  expect(markup).not.toContain('Infiltração:');
});
