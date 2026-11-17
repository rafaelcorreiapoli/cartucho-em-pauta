import {publishProjectFiling} from '../../server/project-test-fixture';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {BALLOT_MS,bankAuditFee,bills,NEGOTIATION_MS,stations,type Station} from '../plenary';
import type {Player} from '../map';
import {LegislativeStationActions,legislativeStationActions} from './legislative-station-actions';

test('station controls show complaints and follow the amendment and correction state without exposing the infiltrator',()=>{
  const people:Player[] = ['Rafa','Bia','Caio'].map((id,character)=>({
    id,nick:id,character,x:0,y:0,direction:0,moving:false,
  }));
  const [host,auditor,traitor] = people;
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
  publishProjectFiling(match,host);
  const ids = people.map(({id})=>id);
  const render = (player:Player,station?:Station,now=1)=>renderToStaticMarkup(
    <LegislativeStationActions actions={legislativeStationActions(match.view(player.id,ids,now),station)} send={()=>{}}/>,
  );

  expect(render(host)).toBe('');
  expect(render(host,'amendment')).toContain('data-action="amendment"');
  match.act({...host,...stations.amendment},'amendment',1);
  expect(render(host,'amendment')).toBe('');
  expect(render(host,'panel')).toBe('');
  expect(render(traitor,'panel')).toContain('data-action="fraud"');
  match.act({...traitor,...stations.panel},'fraud',2);
  expect(render(traitor,'panel')).toBe('');
  expect(render(host,'panel')).toBe('');
  expect(render(auditor,'audit')).toContain('data-action="denounce"');
  match.act({...auditor,...stations.audit},'audit',3);
  expect(render(auditor,'panel')).toContain('data-action="panel"');
  expect(render(host,'panel')).toBe('');
  match.act({...auditor,...stations.panel},'panel',4);
  expect(render(auditor,'panel')).toBe('');
  expect(render(auditor,'audit',NEGOTIATION_MS-1)).toBe('');
  match.advance(NEGOTIATION_MS);
  expect(render(auditor,'audit',NEGOTIATION_MS)).toBe('');
});

test.each([true,false])('audit server fees still follow the approved policy, approval=%s',approved=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((id,character)=>({
    id,nick:id,character,...stations.audit,direction:0,moving:false,
  }));
  const [host,recipient,auditor] = players;
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,players,0,()=>.9)).toBe(true);
  const project = bills.findIndex(bill=>bill.id==='PROJ-N08');
  match.gameplayWorld(players,0,()=>false).publish({
    type:'filed',project,actor:host.id,item:1,position:stations.amendment,at:0,witnesses:[],
  });
  match.advance(NEGOTIATION_MS);
  if (approved) for (const player of [host,recipient]) match.vote(player.id,'yes',NEGOTIATION_MS+1);
  const resolved = NEGOTIATION_MS+BALLOT_MS;
  match.advance(resolved);
  const view = (now:number)=>match.view(auditor.id,ids,now);
  const now = resolved+1;
  const balance = view(now).politics!.wallet;
  expect(match.act(auditor,'audit',now)?.text).toContain('Nenhum registro');
  expect(view(now).politics!.wallet).toBe(balance);
  expect(match.politics(host,{kind:'transfer',to:recipient.id,amount:1},players,now+1)).toBe(true);
  expect(match.act(auditor,'audit',now+2)?.text).toContain('Documento encontrado');
  expect(view(now+2).politics!.wallet).toBe(balance-(approved ? bankAuditFee : 0));
});
