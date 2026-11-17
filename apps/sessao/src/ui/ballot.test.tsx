import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Ballot,CassationBallot,hearingBallotState} from './ballot';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {stations} from '../plenary';
import type {Player} from '../map';
import {ProjectImpact} from "./project-ballot";

const state = {eligible:true,mandate:true,voted:2,electorate:5,quorum:3,cast:()=>{}};

test('the ballot renders the quorum, participation and selected vote',()=>{
  const html = renderToStaticMarkup(<Ballot {...state} hearing={false} vote="yes"/>);
  expect(html).toContain('2/5 votaram · 3 votos a favor para aprovar');
  expect(html).toContain('data-vote="yes" aria-pressed="true"');
  expect(html).toContain('--meter-ratio:0.4');
});

test('the hearing ballot disables voting for a suspended player',()=>{
  const html = renderToStaticMarkup(<Ballot {...state} hearing eligible={false}/>);
  expect(html).toContain('Você está afastado da votação.');
  expect(html).toContain('Não afastar');
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});

test('cassation shows other candidates and the private skip selection',()=>{
  const html = renderToStaticMarkup(<CassationBallot ownId="self" cast={()=>{}} state={{
    candidates:[{id:'self',name:'Meu nick',character:0},{id:'other',name:'Outro nick',character:1}],
    eligible:true,voted:1,electorate:2,quorum:2,choice:null,
  }}/>);
  expect(html).not.toContain('Meu nick');
  expect(html).toContain('Outro nick');
  expect(html).toContain('aria-keyshortcuts="2" aria-pressed="true">Pular voto');
});

test('project impacts signal each number independently of the vote outcome',()=>{
  const approved = renderToStaticMarkup(<ProjectImpact approved impact={{stability:22,budget:-28}}/>);
  expect(approved).toContain('data-effect="gain">+22');
  expect(approved).toContain('data-effect="loss">−R$ 280 mil');
  const rejected = renderToStaticMarkup(<ProjectImpact approved={false} impact={{stability:-14,budget:0}}/>);
  expect(rejected).toContain('data-effect="loss">−14');
  expect(rejected).toContain('data-effect="neutral">R$ 0 mil');
});


test('the hearing HUD renders the quorum and participation from the gameserver snapshot',()=>{
  const players:Player[] = ['Rafa','Bia','Caio','Duda'].map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,...stations.panel,
  }));
  const [host,target] = players;
  const ids = players.map(player=>player.id);
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,players,0,()=>.9)).toBe(true);
  expect(hearingBallotState(match.view(host.id,ids,0))).toBeNull();
  Reflect.get(match,'economy').changePopularity(host.id,20);
  match.politics(host,{kind:'hearing',target:target.id},players,10);
  match.vote(host.id,'yes',11);
  const view = match.view(host.id,ids,11);
  expect(view.hearing).toMatchObject({quorum:3,voted:1,vote:'yes'});
  const hearing = hearingBallotState(view)!;
  const html = renderToStaticMarkup(<Ballot {...hearing} cast={()=>{}}/>);
  expect(html).toContain('1/4 votaram · 3 votos a favor para afastar');
  expect(html).toContain('Seu voto: afastar');
  expect(hearingBallotState({...view,hearing:{...view.hearing!,quorum:undefined}})?.quorum).toBe(3);
  expect(hearingBallotState({...view,hearing:{...view.hearing!,quorum:4}})?.quorum).toBe(4);
});
