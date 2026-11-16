import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {NEGOTIATION_MS,stations,type Station} from '../plenary';
import {ELECTION_RULES} from '../elections';
import {money} from '../politics';
import type {Player} from '../map';
import {ElectionStationActions,electionStationActions} from './election-station-actions';

test('campaign controls match the current station, voice state and completed actions',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,x:0,y:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const render = (station?:Station,voice=false,now=1)=>renderToStaticMarkup(
    <ElectionStationActions {...electionStationActions(match.view(player.id,[player.id],now),station,voice)} send={()=>{}}/>,
  );
  expect(render()).toBe('');
  expect(render('press')).toContain(money(ELECTION_RULES.advertisementCost));
  expect(render('press')).not.toContain('Discursar');
  expect(match.electionAction({...player,...stations.press},{kind:'advertise'},1,false)).toBeDefined();
  expect(render('press')).toBe('');
  expect(render('panel')).toContain('Discursar');
  match.electionAction({...player,...stations.panel},{kind:'speech'},2,false);
  expect(render('panel')).not.toContain('Discursar');
  expect(render('tv')).toContain('Ative a voz');
  expect(render('tv')).not.toContain('id="interview"');
  expect(render('tv',true)).toContain('id="interview"');
  match.electionAction({...player,...stations.tv},{kind:'interview'},3,false);
  expect(render('tv',true,3)).toContain('id="interview"');
  match.electionAction({...player,...stations.tv},{kind:'interview'},4,true);
  expect(render('tv',true,4)).toBe('');
  expect(render('panel',true,NEGOTIATION_MS-1)).toBe('');
});
