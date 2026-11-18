import {cassationFee} from '../npcs';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Ballot,CassationBallot,ballotPalette,ballotShortcut,hearingBallotState} from './ballot';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {CASSATION_NOTICE_MS,stations} from '../plenary';
import type {Player} from '../map';
import {HEARING_MS} from '../politics';
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

test('cassation shows the local candidate with voting disabled and their skip selection',()=>{
  const html = renderToStaticMarkup(<CassationBallot ownId="self" cast={()=>{}} state={{
    candidates:[{id:'self',name:'Meu nick',character:0},{id:'other',name:'Outro nick',character:1}],
    eligible:true,voted:1,electorate:2,quorum:2,choice:null,
  }}/>);
  expect(html).toContain('disabled="" aria-label="Meu nick"');
  expect(html).toContain('Outro nick');
  expect(html).toContain('aria-keyshortcuts="2" aria-pressed="true">Pular voto');
});

test('project impacts signal each number independently of the vote outcome',()=>{
  const approved = renderToStaticMarkup(<ProjectImpact budget={32} approved impact={{stability:22,budget:-28}}/>);
  expect(approved).toContain('data-effect="gain">+22');
  expect(approved).toContain('data-effect="loss">−R$ 280 mil');
  const rejected = renderToStaticMarkup(<ProjectImpact budget={32} approved={false} impact={{stability:-14,budget:0}}/>);
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
  expect(ballotShortcut(view,host.id,'n',true)).toBeUndefined();
  expect(ballotPalette(view,host.id,true)).toEqual([{name:'Afastar',vote:'yes'},{name:'Não afastar',vote:'no'}]);
  expect(ballotPalette({...view,mandate:false},host.id,true)).toEqual([]);
  expect(ballotShortcut(view,host.id,'r',true)).toEqual({kind:'bill',vote:'no'});
  expect(ballotShortcut({...view,mandate:false},host.id,'y',true)).toBeUndefined();
  const hearing = hearingBallotState(view)!;
  const html = renderToStaticMarkup(<Ballot {...hearing} cast={()=>{}}/>);
  expect(html).toContain('1/4 votaram · 3 votos a favor para afastar');
  expect(html).toContain('Seu voto: afastar');
  expect(hearingBallotState({...view,hearing:{...view.hearing!,quorum:undefined}})?.quorum).toBe(3);
  expect(hearingBallotState({...view,hearing:{...view.hearing!,quorum:4}})?.quorum).toBe(4);
});

test('a hearing retains votes through reconnect and removes permanently departed voters from the tally',()=>{
  const players:Player[] = ['Rafa','Bia','Caio','Duda'].map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,...stations.panel,
  }));
  const [host,target,departing,other] = players;
  const ids = players.map(player=>player.id);
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,players,0,()=>.9)).toBe(true);
  Reflect.get(match,'economy').changePopularity(host.id,20);
  match.politics(host,{kind:'hearing',target:target.id},players,10);
  match.vote(host.id,'yes',11);
  match.vote(departing.id,'yes',11);
  match.vote(other.id,'no',11);
  const render = (now:number)=>renderToStaticMarkup(<Ballot {...hearingBallotState(match.view(host.id,ids,now))!} cast={()=>{}}/>);
  match.setPlayerConnected(departing.id,false);
  expect(render(12)).toContain('3/4 votaram · 3 votos a favor para afastar');
  match.setPlayerConnected(departing.id,true);
  expect(render(13)).toContain('3/4 votaram · 3 votos a favor para afastar');

  match.leave(departing.id,14);
  expect(render(14)).toContain('2/3 votaram · 2 votos a favor para afastar');
  match.advance(10+HEARING_MS);
  const result = match.view(host.id,ids,10+HEARING_MS);
  expect(result.hearingResult).toContain('afastamento rejeitado (1 votos pelo afastamento)');
  expect(match.isolated(target.id)).toBe(false);
});

test('cassation removes a disconnected target and shows the gameserver participation count',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,...stations.panel,
  }));
  const [host,target,observer] = players;
  const ids = players.map(player=>player.id);
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,players,0,()=>.9)).toBe(true);
  match.gameplayWorld([],0,()=>false).earn(host.id,cassationFee);
  expect(match.callCassation({...host,...stations.audit},10)).toBeUndefined();
  const openedAt = 10+CASSATION_NOTICE_MS;
  match.advance(openedAt);
  const selected = ballotShortcut(match.view(host.id,ids,openedAt),host.id,'1',true);
  const skipped = ballotShortcut(match.view(observer.id,ids,openedAt),observer.id,'3',true);
  expect(selected).toEqual({kind:'cassation',candidate:target.id});
  expect(skipped).toEqual({kind:'cassation',candidate:null});
  if (selected?.kind==='cassation') match.castCassation(host.id,selected.candidate,openedAt);
  if (skipped?.kind==='cassation') match.castCassation(observer.id,skipped.candidate,openedAt);
  const render = ()=>renderToStaticMarkup(<CassationBallot state={match.view(host.id,ids,openedAt).cassation!}
    ownId={host.id} cast={()=>{}}/>);
  expect(render()).toContain('2/3</strong> votaram · 2 votos para cassar');
  expect(render()).toContain('Convocada por');
  expect(render()).toContain('aria-label="Votos em Bia"');
  expect(render()).toContain('aria-label="Quem pulou o voto"');
  expect(match.view(target.id,ids,openedAt).cassation).toMatchObject({
    caller:{id:host.id,name:host.nick,character:host.character},
    votes:[{voter:host.id,candidate:target.id},{voter:observer.id,candidate:null}],
  });
  expect(match.view(target.id,ids,openedAt).cassation?.caller).not.toHaveProperty('role');
  match.setPlayerConnected(target.id,false);
  expect(ballotPalette(match.view(host.id,ids,openedAt),host.id,true)).toEqual([
    {name:observer.nick,candidate:observer.id},{name:'Pular voto',candidate:null},
  ]);
  expect(ballotShortcut(match.view(host.id,ids,openedAt),host.id,'1',true))
    .toEqual({kind:'cassation',candidate:observer.id});
  expect(render()).toContain('1/2</strong> votaram · 2 votos para cassar');
  expect(render()).not.toContain('Bia');
  expect(match.view(host.id,ids,openedAt).cassation?.votes).toEqual([{voter:observer.id,candidate:null}]);
  expect(render()).not.toContain('aria-pressed="true"');
});
