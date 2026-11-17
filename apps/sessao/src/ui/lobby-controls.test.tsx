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
