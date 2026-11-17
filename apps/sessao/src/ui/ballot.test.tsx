import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Ballot,CassationBallot} from './ballot';
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
