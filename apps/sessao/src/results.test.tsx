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
