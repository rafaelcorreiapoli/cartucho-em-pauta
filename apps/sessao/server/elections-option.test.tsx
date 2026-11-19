import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from './PlenaryMatch';
import {PersonalAgenda} from './PersonalAgenda';
import {ELECTION_RULES} from '../src/elections';
import {stations} from '../src/plenary';
import {electionStationActions} from '../src/ui/election-station-actions';
import {publishProjectFiling} from './project-test-fixture';
import {ElectionIndicator} from '../src/election-panel';
import type {Player} from '../src/map';

const players:Player[] = ['a','b','c','d','e','f'].map((id,character)=>({id,nick:id,character,x:140+36*character,y:146,direction:0,moving:false}));
const ids = players.map(player=>player.id);
const metrics = {wallet:8,popularity:40};

test('disabling elections removes electoral missions but keeps popularity and megaphone missions',()=>{
  const blocked = ['propaganda','discurso','investimentoPolitico','campanhaUltimaHora'];
  for (let seed=0;seed<100;seed++) {
    const agenda = new PersonalAgenda(metrics,6,()=>seed/100,()=>{},new Set(),true,true,false);
    expect(agenda.view(metrics).active.some(({kind})=>blocked.includes(kind))).toBe(false);
    const deck = Reflect.get(agenda,'missionDeck') as string[];
    expect(deck.some(kind=>blocked.includes(kind))).toBe(false);
    expect(deck).toContain('campanha');
    expect(deck).toContain('discursoMegafone');
  }
});

test('disabled elections never renew mandates or expose campaign controls and reject server actions',()=>{
  const match = new PlenaryMatch(1);
  match.start(ids[0],players,0,()=>.9,1,false,true,true,false);
  const before = match.view(ids[0],ids,1).politics!;
  for (const [kind,station] of [['advertise','press'],['speech','panel'],['interview','tv'],['object','panel']] as const) {
    expect(match.electionAction({...players[0],...stations[station]},{kind},1,true)).toBeUndefined();
  }
  const view = match.view(ids[0],ids,1);
  expect(view.electionsEnabled).toBe(false);
  expect(view.election).toBeUndefined();
  expect(view.politics?.wallet).toBe(before.wallet);
  expect(view.politics?.popularity).toBe(before.popularity);
  expect(match.speaker(1)).toBeUndefined();
  for (const station of ['press','panel','tv'] as const) expect(electionStationActions(view,station,true).actions).toEqual([]);
  expect(renderToStaticMarkup(<ElectionIndicator open={()=>false}/>)).not.toContain('Pesquisa Eleitoral');
  match.advance(ELECTION_RULES.interval+1);
  expect(players.every(player=>match.view(player.id,ids,ELECTION_RULES.interval+1).mandate)).toBe(true);
  expect(match.view(ids[0],ids,ELECTION_RULES.interval+1).electorate).toBe(6);
});

test('project voting can still run with elections disabled',()=>{
  const match = new PlenaryMatch(1);
  match.start(ids[0],players,0,()=>.9,1,false,true,true,false);
  publishProjectFiling(match,players[0]);
  Reflect.get(match,'proposal').voteAt = 10;
  match.advance(10);
  expect(match.view(ids[0],ids,10).phase).toBe('ballot');
  match.vote(ids[0],'yes',11);
  expect(match.view(ids[0],ids,11).vote).toBe('yes');
});
