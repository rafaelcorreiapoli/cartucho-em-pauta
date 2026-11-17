import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {PoliticalEconomy} from '../../server/PoliticalEconomy';
import type {Player} from '../map';
import {bills,BALLOT_MS,CASSATION_NOTICE_MS,hearingPolicyFee,NEGOTIATION_MS,stations} from '../plenary';
import {ELECTION_RULES} from '../elections';
import {HEARING_MS} from '../politics';
import {InstitutionalActions,institutionalActions} from './institutional-actions';

const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
  id:nick,nick,character,x:140,y:146,direction:0,moving:false,
}));
const [rafa,bia] = players;
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

test('the panel projects valid targets and the enacted hearing fee',()=>{
  const match = new PlenaryMatch(1);
  expect(match.start(rafa.id,players,0,()=>.9)).toBe(true);
  const panel = {...rafa,...stations.panel};
  const view = (now:number)=>match.view(rafa.id,ids,now);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  expect(institutionalActions(view(0),panel).hearing).toBeUndefined();
  economy.changePopularity(rafa.id,20);
  expect(institutionalActions(view(1),panel).hearing?.candidates.map(({id})=>id)).toEqual(ids.slice(1));
  const withoutCassation = paint(institutionalActions({...view(1),canCallCassation:false},panel));
  expect(withoutCassation).toContain('id="hearing-form"');
  expect(withoutCassation).not.toContain('Convocar cassação');
  match.gameplayWorld(players,2,()=>false).publish({
    type:'filed',project:bills.findIndex(bill=>bill.id==='PROJ-N06'),
    actor:rafa.id,item:1,position:stations.amendment,at:0,witnesses:[],
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


test.each(['hearing','call-cassation'] as const)('the HUD and gameserver enforce the last full voting window for %s',kind=>{
  const match = new PlenaryMatch(1);
  expect(match.start(rafa.id,players,0,()=>.9)).toBe(true);
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  economy.changePopularity(rafa.id,20);
  const caller = {...rafa,...stations.panel};
  const deadline = ELECTION_RULES.matchDuration;
  const cassation = kind==='call-cassation';
  const notice = cassation ? CASSATION_NOTICE_MS : 0;
  const lastCall = deadline-notice-HEARING_MS;
  const action = kind==='hearing' ? {kind,target:bia.id} : {kind};
  const view = (now:number)=>match.view(rafa.id,ids,now);
  const control = cassation ? 'Convocar cassação' : 'Afastamento temporário';
  expect(paint(institutionalActions(view(lastCall+1),caller))).not.toContain(control);
  match.politics(caller,action,players,lastCall+1);
  expect(view(lastCall+1).phase).toBe('negotiation');
  expect(view(lastCall+1).cassationIn).toBeUndefined();

  expect(paint(institutionalActions(view(lastCall),caller))).toContain(control);
  match.politics(caller,action,players,lastCall);
  const opened = lastCall+notice;
  const voters = players.filter(player=>player!==bia);
  const before = view(opened).stability;
  if (cassation) {
    match.advance(opened+1);
    expect(view(opened+1).cassation).toBeDefined();
    for (const voter of voters) match.castCassation(voter.id,bia.id,opened+2);
  } else {
    expect(view(opened).hearing?.target).toBe(bia.nick);
    for (const voter of voters) match.vote(voter.id,'yes',opened+1);
  }
  match.advance(deadline);
  const finished = view(deadline);
  expect(finished.phase).toBe('finished');
  if (cassation) expect(finished.cassationResult?.text).toContain('Bia perdeu o mandato com 2 votos');
  else {
    expect(finished.hearingResult).toContain('Bia: afastamento aprovado');
    expect(finished.stability).toBe(before);
  }
});
