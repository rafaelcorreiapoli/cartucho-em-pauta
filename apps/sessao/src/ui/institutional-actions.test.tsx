import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {stations} from '../plenary';
import {InstitutionalActions,institutionalActions} from './institutional-actions';

const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
  id:nick,nick,character,x:140,y:146,direction:0,moving:false,
}));
const [rafa] = players;
const ids = players.map(({id})=>id);
const paint = (model:ReturnType<typeof institutionalActions>)=>
  renderToStaticMarkup(<InstitutionalActions model={model} send={()=>{}} close={()=>{}}/>);

test('the grant control appears at the cabinet with a preview and a server-authoritative cooldown',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(rafa.id,players,0,()=>.9)).toBe(true);
  const cabinet = {...rafa,...stations.cabinet};
  const view = (now:number)=>match.view(rafa.id,ids,now);
  expect(institutionalActions(view(0),rafa).grant).toBeUndefined();
  const before = view(0);
  const markup = paint(institutionalActions(before,cabinet));
  expect(markup).toContain('aria-pressed="true">Saúde</button>');
  expect(markup).toContain('Desviar 25%');
  expect(markup).toContain('Até +2 PV por jogador em pé');
  expect(markup).toContain('aria-label="Fechar ações institucionais"');
  expect(markup).toContain('type="submit">Aplicar verba');
  match.politics(rafa,{kind:'grant',area:'health',amount:4,diversion:25},players,1);
  expect(view(1).budget).toBe(before.budget);
  match.politics(cabinet,{kind:'grant',area:'health',amount:4,diversion:25},players,2);
  const after = view(2);
  expect(after.budget).toBe(before.budget-4);
  expect(after.politics!.wallet).toBe(before.politics!.wallet+1);
  expect(paint(institutionalActions(after,cabinet))).toContain('Disponível em 60 s');
});
