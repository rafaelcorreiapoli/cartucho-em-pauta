import {cassationFee} from './npcs';
import {publishProjectFiling} from '../server/project-test-fixture';
import type {PoliticalEconomy} from '../server/PoliticalEconomy';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {CassationResult,ElectionResult,ResultsContent,SessionResult} from './results';
import {PlenaryMatch} from '../server/PlenaryMatch';
import {ELECTION_RULES} from './elections';
import {HEARING_MS} from './politics';
import {NEGOTIATION_MS,BALLOT_MS,CASSATION_NOTICE_MS,stabilityRules,stations} from './plenary';
import type {Player} from './map';

test('a player outside the plenary receives the final result in the modal content',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,direction:0,moving:false,x:140,y:146};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>0);
  Reflect.set(Reflect.get(match,'fire'),'next',Infinity);
  Reflect.set(match,'stability',stabilityRules.target-1);
  const deadline = ELECTION_RULES.matchDuration;
  match.advance(NEGOTIATION_MS);
  expect(match.phase).toBe('negotiation');
  match.advance(deadline);
  const view = match.view(player.id,[player.id],deadline);
  expect(view.phase).toBe('finished');
  const markup = renderToStaticMarkup(<SessionResult {...view}/>);
  expect(view.outcomes).toEqual([]);
  expect(view.winner).toBeUndefined();
  expect(view.congressDestroyed).toBe(true);
  expect(markup).toContain('O Congresso terminou abaixo da meta de estabilidade.');
  expect(markup).toContain('aria-label="Parlamentares" data-result="lost"');
  expect(markup).toContain('Sem vencedores');
  expect(markup).not.toContain('data-result="won"');
});

test.each(['Parlamentar','Infiltrado',undefined] as const)('finale reveals the full cast only after finish (%s)',winner=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    id:String(character),nick,character,direction:0,moving:false,x:140,y:146,
  }));
  const ids = players.map(player=>player.id);
  const match = new PlenaryMatch(1);
  match.start(ids[0],players,0,()=>0);
  expect(match.view(ids[1],ids,0).finalRoster).toBeUndefined();
  // A departure may finish the match, and the original cast must still be shown.
  if (winner==='Parlamentar') match.leave(ids[0],1);
  else if (winner===undefined) match.leave(ids[2],1);
  else { Reflect.set(match,'stability',0); match.advance(1_200_000); }
  const view = match.view(ids[1],ids,2);
  expect(view.phase).toBe('finished');
  expect(view.winner).toBe(winner);
  expect(view.finalRoster).toEqual([
    {id:'0',name:'Rafa',character:0,role:'Infiltrado'},
    {id:'1',name:'Bia',character:1,role:'Parlamentar'},
    {id:'2',name:'Caio',character:2,role:'Parlamentar'},
  ]);
  const html = renderToStaticMarkup(<SessionResult {...view}/>);
  expect(html).toContain(winner==='Parlamentar' ? 'O Congresso foi salvo!' : winner==='Infiltrado' ? 'O Congresso foi destruído!' : 'Sessão encerrada');
  for (const {nick} of players) expect(html).toContain(nick);
  if (winner) {
    const winningTeam = winner==='Infiltrado' ? 'Infiltrados' : 'Parlamentares';
    const losingTeam = winner==='Infiltrado' ? 'Parlamentares' : 'Infiltrados';
    expect(html).toContain(`aria-label="${winningTeam}" data-result="won"`);
    expect(html).toContain(`aria-label="${losingTeam}" data-result="lost"`);
    expect(html).toContain('finale-verdict">Vitória');
    expect(html).toContain('finale-verdict">Derrota');
    expect(html).toContain('finale-particles');
  } else {
    expect(html).toContain('Sem vencedores');
    expect(html).not.toContain('data-result="won"');
  }
});

test('a solo collapse shows a parliamentary defeat without an infiltrator victory',()=>{
  const markup = renderToStaticMarkup(<SessionResult stability={0}
    finalRoster={[{id:'a',name:'Rafa',character:0,role:'Parlamentar'}]}/>);
  expect(markup).toContain('aria-label="Parlamentares" data-result="lost"');
  expect(markup).toContain('Sem vencedores');
  expect(markup).not.toContain('data-result="won"');
});

test('interim results expose both native dialog dismissal controls',()=>{
  const markup = renderToStaticMarkup(<ResultsContent><p>Resultado da cassação</p></ResultsContent>);
  expect(markup).toContain('id="result-title"');
  expect(markup).toContain('aria-label="Fechar resultados"');
  expect(markup).toContain('Continuar');
  expect(markup.match(/method="dialog"/g)).toHaveLength(2);
  expect(markup).toContain('Resultado da cassação');
});

test('an authoritative mandate renewal renders inside the shared results dialog',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,direction:0,moving:false,x:140,y:146};
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>0);
  publishProjectFiling(match,player);
  match.advance(NEGOTIATION_MS);
  match.vote(player.id,'yes',NEGOTIATION_MS+1);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  match.advance(ELECTION_RULES.interval+BALLOT_MS);
  const result = match.view(player.id,[player.id],ELECTION_RULES.interval+BALLOT_MS).election?.result;
  expect(result?.cycle).toBe(1);
  const html = renderToStaticMarkup(<ResultsContent><ElectionResult result={result!}/></ResultsContent>);
  expect(html).toContain('Renovação de Mandato 1');
  expect(html).toContain('Rafa');
  expect(html).toContain('Continuar');
});

test('an authoritative cassation without a majority renders its verdict',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    id:String(character),nick,character,direction:0,moving:false,x:140,y:146,
  }));
  const [host,first,second] = players;
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  match.start(host.id,players,0,()=>.9);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  economy.changePopularity(host.id,17);
  match.gameplayWorld([],0,()=>false).earn(host.id,cassationFee);
  expect(match.callCassation({...host,...stations.audit},50)).toBeUndefined();
  const open = 50+CASSATION_NOTICE_MS;
  match.advance(open);
  match.castCassation(host.id,first.id,open);
  match.castCassation(first.id,second.id,open);
  const end = open+HEARING_MS;
  match.advance(end);
  const outcome = match.view(host.id,ids,end).cassationResult;
  expect(outcome?.text).toContain('Ninguém foi cassado');
  const html = renderToStaticMarkup(<ResultsContent><CassationResult text={outcome!.text}/></ResultsContent>);
  expect(html).toContain('Resultado da cassação');
  expect(html).toContain('Ninguém foi cassado');
});
