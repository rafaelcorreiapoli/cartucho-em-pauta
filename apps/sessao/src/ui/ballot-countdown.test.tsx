import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {NEGOTIATION_MS} from '../plenary';
import {BallotCountdownMessage} from './ballot-countdown';

test('the countdown announces the time published by the gameserver',()=>{
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  for (const [offset,expected] of [[5000,5],[1001,2],[1,1]]) {
    const {ballotCountdown} = match.view(player.id,[player.id],NEGOTIATION_MS-offset);
    expect(ballotCountdown).toBe(expected);
    const markup = renderToStaticMarkup(<BallotCountdownMessage seconds={ballotCountdown!}/>);
    expect(markup).toContain(`id="ballot-countdown-message" role="status">Votação começando em ${expected}…`);
  }
});
