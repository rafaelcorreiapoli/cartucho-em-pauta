import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {LobbyControls,lobbyControlsState} from './lobby-controls';
import type {Player} from '../map';

const commands = {changeNpcCount:()=>{},start:()=>{},back:()=>{}};

test('only the host can configure the lobby and guests still see the confirmed NPC count',()=>{
  const match = new PlenaryMatch(6);
  const ids = ['a','b','c','d','e','f'];
  const render = (id:string,players:string[])=>renderToStaticMarkup(
    <LobbyControls state={lobbyControlsState({...match.view(id,players,0),lobbyNpcCount:3},id,true)} commands={commands}/>,
  );
  const guest = render('b',ids);
  expect(guest).toContain('data-count="3" aria-pressed="true" disabled=""');
  expect(guest).toContain('Aguardando quem criou a sala');
  expect(guest).not.toContain('id="start-match"');
  expect(guest).not.toContain('id="infiltrator-count"');
  const belowMinimum = render('a',ids.slice(0,5));
  expect(belowMinimum).toContain('5/6 jogadores para iniciar');
  expect(belowMinimum).toContain('id="start-match" type="button" disabled=""');
  const host = render('a',ids);
  expect(host).toContain('id="infiltrator-count"');
  expect(host).not.toContain('Iniciar como infiltrado');
  expect(host).toContain('id="start-match" type="button">Iniciar sessão');
});

test('the solo lobby waits for assets and removes its controls after the server starts the match',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,x:140,y:146,direction:0,moving:false};
  const match = new PlenaryMatch(1,undefined,true);
  const render = (ready:boolean)=>renderToStaticMarkup(
    <LobbyControls state={lobbyControlsState(match.view(player.id,[player.id],0),player.id,ready)} commands={commands}/>,
  );
  expect(render(false)).toContain('id="start-match" type="button" disabled=""');
  expect(render(true)).toContain('id="start-match" type="button">Iniciar sessão');
  expect(render(true)).toContain('>Iniciar como infiltrado</button>');
  expect(render(false)).toContain('disabled="">Iniciar como infiltrado</button>');
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  expect(render(true)).toBe('');
});

 test('phone games setting shows the confirmed value and is restricted to the host',()=>{
  const match = new PlenaryMatch(6);
  const ids = ['a','b','c','d','e','f'];
  const render = (id:string)=>renderToStaticMarkup(<LobbyControls
    state={lobbyControlsState({...match.view(id,ids,0),phoneGamesEnabled:false},id,true)} commands={commands}/>);
  expect(render('a')).toContain('type="checkbox"/> Joguinhos de celular');
  expect(render('b')).toContain('type="checkbox" disabled=""/> Joguinhos de celular');
});

 test('project voting setting shows the confirmed value and only the host can change it',()=>{
  const match = new PlenaryMatch(6);
  const ids = ['a','b','c','d','e','f'];
  const render = (id:string)=>renderToStaticMarkup(<LobbyControls
    state={lobbyControlsState({...match.view(id,ids,0),projectVotingEnabled:false},id,true)} commands={commands}/>);
  expect(render('a')).toContain('type="checkbox"/> Votações de projetos');
  expect(render('b')).toContain('type="checkbox" disabled=""/> Votações de projetos');
});

test('only the host can change the election setting and guests see its confirmed value',()=>{
  const match = new PlenaryMatch(6);
  const ids = ['a','b','c','d','e','f'];
  const render = (id:string)=>renderToStaticMarkup(<LobbyControls
    state={lobbyControlsState({...match.view(id,ids,0),electionsEnabled:false},id,true)} commands={commands}/>);
  expect(render('a')).toContain('type="checkbox"/> Eleição para eliminação');
  expect(render('b')).toContain('type="checkbox" disabled=""/> Eleição para eliminação');
});

test('photo setting is visible to guests and configurable only by the host',()=>{
  const match = new PlenaryMatch(6);
  const ids = ['a','b','c','d','e','f'];
  const render = (id:string)=>renderToStaticMarkup(<LobbyControls state={lobbyControlsState({...match.view(id,ids,0),photosEnabled:false},id,true)} commands={commands}/>);
  expect(render('a')).toContain('type="checkbox"/> Câmera e fotos');
  expect(render('b')).toContain('type="checkbox" disabled=""/> Câmera e fotos');
});

test('surveillance setting is host-only and guests see its confirmed value',()=>{
  const match = new PlenaryMatch(6);
  const ids = ['a','b','c','d','e','f'];
  const render = (id:string)=>renderToStaticMarkup(<LobbyControls state={lobbyControlsState({...match.view(id,ids,0),surveillanceEnabled:false},id,true)} commands={commands}/>);
  expect(render('a')).toContain('type="checkbox"/> Vigilância');
  expect(render('b')).toContain('type="checkbox" disabled=""/> Vigilância');
});

test.each([['decorationsEnabled','Decoração'],['portraitsAndVipEnabled','Retratos e área VIP']])('lobby exposes independent host-only setting %s',(flag,label)=>{
  const match = new PlenaryMatch(6);
  const ids = ['a','b','c','d','e','f'];
  const render = (id:string)=>renderToStaticMarkup(<LobbyControls state={lobbyControlsState({...match.view(id,ids,0),[flag]:false},id,true)} commands={commands}/>);
  expect(render('a')).toContain('type="checkbox"/> '+label);
  expect(render('b')).toContain('type="checkbox" disabled=""/> '+label);
});

test('lobby shows confirmed grant, budget and duration choices to host and guests',()=>{
  const match = new PlenaryMatch(6);
  const ids = ['a','b','c','d','e','f'];
  for (const id of ['a','b']) {
    const html = renderToStaticMarkup(<LobbyControls state={lobbyControlsState({
      ...match.view(id,ids,0),grantsEnabled:false,initialBudget:-5,matchMinutes:20,initialWallet:50,
    },id,true)} commands={commands}/>);
    expect(html).toContain('Aplicar verba');
    expect(html).toContain('aria-label="Patrimônio inicial"');
    expect(html).toContain('aria-pressed="true">50</button>');
    expect(html).toContain('aria-label="Orçamento inicial"');
    expect(html).toContain('aria-label="Tempo de jogo"');
    expect(html).toContain('aria-pressed="true">−R$ 50 mil</button>');
    expect(html).toContain('aria-pressed="true">20 min</button>');
    if (id==='b') expect(html).toContain('type="checkbox" disabled=""/> Aplicar verba');
  }
});

 test('positive starting budget displays fifty thousand instead of five hundred thousand',()=>{
  const match = new PlenaryMatch(1);
  const html = renderToStaticMarkup(<LobbyControls state={lobbyControlsState({...match.view('a',['a'],0),initialBudget:5},'a',true)} commands={commands}/>);
  expect(html).toContain('aria-pressed="true">+R$ 50 mil</button>');
  expect(html).not.toContain('500 mil');
});

test('Federal addon defaults off, shows the confirmed state and is host-only',()=>{
  const match = new PlenaryMatch(6),ids = ['a','b','c','d','e','f'];
  expect(lobbyControlsState(match.view('a',ids,0),'a',true).federalPatrolEnabled).toBe(false);
  for (const enabled of [false,true]) for (const id of ['a','b']) {
    const html = renderToStaticMarkup(<LobbyControls state={lobbyControlsState({
      ...match.view(id,ids,0),federalPatrolEnabled:enabled,
    },id,true)} commands={commands}/>);
    expect(html).toContain('Japonês da Federal');
    expect(html).toContain('10 segundos na solitária');
    expect(html).toContain(`type="checkbox"${id==='b' ? ' disabled=""' : ''}${enabled ? ' checked=""' : ''}/> Japonês da Federal`);
  }
});
