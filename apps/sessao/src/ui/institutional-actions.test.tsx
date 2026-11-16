import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {PoliticalEconomy} from '../../server/PoliticalEconomy';
import type {Player} from '../map';
import {bills,BALLOT_MS,hearingPolicyFee,NEGOTIATION_MS,stations} from '../plenary';
import {CABINET_GRANT} from '../politics';
import {InstitutionalActions,institutionalActions} from './institutional-actions';

const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
  id:nick,nick,character,x:140,y:146,direction:0,moving:false,
}));
const [rafa,bia] = players;
const ids = players.map(({id})=>id);
const paint = (model:ReturnType<typeof institutionalActions>)=>
  renderToStaticMarkup(<InstitutionalActions model={model} send={()=>{}}/>);

test('the grant control appears at the cabinet and disappears after the authoritative grant',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(rafa.id,players,0,()=>.9)).toBe(true);
  const cabinet = {...rafa,...stations.cabinet};
  const view = (now:number)=>match.view(rafa.id,ids,now);
  expect(institutionalActions(view(0),rafa).grant).toBeUndefined();
  const before = view(0);
  const markup = paint(institutionalActions(before,cabinet));
  expect(markup).toContain('aria-pressed="true">Aplicar tudo</button>');
  expect(markup).toContain('Desviar R$ 10 mil');
  expect(markup).toContain('type="submit">Aplicar verba');
  match.politics(rafa,{kind:'grant',diverted:1},players,1);
  expect(view(1).budget).toBe(before.budget);
  match.politics(cabinet,{kind:'grant',diverted:1},players,2);
  const after = view(2);
  expect(after.budget).toBe(before.budget-CABINET_GRANT);
  expect(after.politics!.wallet).toBe(before.politics!.wallet+1);
  expect(paint(institutionalActions(after,cabinet))).not.toContain('id="cabinet-form"');
});

test('the panel projects valid targets and the enacted hearing fee',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(rafa.id,players,0,()=>.9)).toBe(true);
  const panel = {...rafa,...stations.panel};
  const view = (now:number)=>match.view(rafa.id,ids,now);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  expect(institutionalActions(view(0),panel).hearing).toBeUndefined();
  economy.changePopularity(rafa.id,20);
  expect(institutionalActions(view(1),panel).hearing?.candidates.map(({id})=>id)).toEqual(ids.slice(1));
  match.gameplayWorld(players,2,()=>false).publish({
    type:'filed',project:bills.findIndex(bill=>bill.id==='PROJ-N06'),
    actor:rafa.id,item:1,position:stations.amendment,at:2,witnesses:[],
  });
  match.advance(NEGOTIATION_MS);
  expect(institutionalActions(view(NEGOTIATION_MS),panel).hearing).toBeUndefined();
  for (const voter of [rafa,bia]) match.vote(voter.id,'yes',NEGOTIATION_MS+1);
  const now = NEGOTIATION_MS+BALLOT_MS;
  match.advance(now);
  const before = view(now).politics!.wallet;
  const initial = paint(institutionalActions(view(now),panel));
  expect(initial).toContain('Convocar cassação · R$ 20 mil');
  expect(initial).toContain('disabled="">Convocar votação · R$ 20 mil');
  economy.spend(rafa.id,before-hearingPolicyFee+1);
  const unaffordable = paint(institutionalActions(view(now),panel));
  expect(unaffordable).toContain('disabled="">Convocar cassação · R$ 20 mil');
  match.politics(panel,{kind:'hearing',target:bia.id},players,now+1);
  expect(view(now+1).phase).toBe('negotiation');
  economy.earn(rafa.id,1);
  match.politics(panel,{kind:'hearing',target:bia.id},players,now+2);
  expect(view(now+2).hearing?.target).toContain(bia.nick);
  expect(view(now+2).politics!.wallet).toBe(0);
  expect(paint(institutionalActions(view(now+2),panel))).not.toContain('id="hearing-form"');
});
