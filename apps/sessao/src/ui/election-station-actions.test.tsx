import {publishProjectFiling} from '../../server/project-test-fixture';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {NEGOTIATION_MS,stations,type Station} from '../plenary';
import {ELECTION_RULES} from '../elections';
import {money} from '../politics';
import {canStand,type Player} from '../map';
import {ElectionStationActions,electionStationActions} from './election-station-actions';

test('campaign controls match the current station, voice state and completed actions',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,x:0,y:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  publishProjectFiling(match,player);
  const render = (station?:Station,voice=false,now=1)=>renderToStaticMarkup(
    <ElectionStationActions {...electionStationActions(match.view(player.id,[player.id],now),station,voice)} send={()=>{}}/>,
  );
  expect(render()).toBe('');
  expect(render('press')).toContain(money(ELECTION_RULES.advertisementCost));
  expect(render('press')).not.toContain('Discursar');
  expect(match.electionAction({...player,...stations.press},{kind:'advertise'},1,false)).toBeDefined();
  expect(render('press')).toContain('Contratar campanha · Duda Mendonça');
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

test('the gameserver and HUD close campaigning during a project countdown',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,direction:0,moving:false,...stations.press};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  publishProjectFiling(match,player);
  const now = NEGOTIATION_MS-1;
  const view = ()=>match.view(player.id,[player.id],now);
  const wallet = view().politics!.wallet;
  expect(electionStationActions(view(),'press',false).actions).toEqual([]);
  expect(match.electionAction(player,{kind:'advertise'},now,false)).toBeUndefined();
  expect(view().politics!.wallet).toBe(wallet);
  expect(view().election?.personal?.advertised).toBe(false);
});

test('the HUD closes election station actions after the final renewal',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,direction:0,moving:false,...stations.panel};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  for (let cycle=1;cycle<=ELECTION_RULES.cycles;cycle++) match.advance(cycle*ELECTION_RULES.interval);
  const now = ELECTION_RULES.cycles*ELECTION_RULES.interval+1;
  const view = ()=>match.view(player.id,[player.id],now);
  expect(view().election?.remaining).toBe(0);
  expect(electionStationActions(view(),'press',false).actions).not.toContain('advertise');
  expect(electionStationActions(view(),'panel',false).actions).toEqual([]);
  expect(electionStationActions(view(),'tv',true).actions).toEqual([]);
});

test('speech is available behind the central microphone, not beside the dais',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,x:480,y:590,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(canStand(player.x,player.y)).toBe(true);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  publishProjectFiling(match,player);
  match.electionAction({...player,x:548,y:620},{kind:'speech'},1,false);
  expect(match.view(player.id,[player.id],1).election?.personal?.spoke).toBe(false);
  match.electionAction(player,{kind:'speech'},2,false);
  expect(match.view(player.id,[player.id],2).election?.personal?.spoke).toBe(true);
});
