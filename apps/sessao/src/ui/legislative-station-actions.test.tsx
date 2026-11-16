import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {NEGOTIATION_MS,stations,type Station} from '../plenary';
import type {Player} from '../map';
import {LegislativeStationActions,legislativeStationActions} from './legislative-station-actions';

test('station controls follow actual amendment, audit and correction state without exposing the infiltrator',()=>{
  const people:Player[] = ['Rafa','Bia','Caio'].map((id,character)=>({
    id,nick:id,character,x:0,y:0,direction:0,moving:false,
  }));
  const [host,auditor,traitor] = people;
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,people,0,()=>.9)).toBe(true);
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
  expect(render(auditor,'audit')).toContain('data-action="audit"');
  match.act({...auditor,...stations.audit},'audit',3);
  expect(render(auditor,'panel')).toContain('data-action="panel"');
  expect(render(host,'panel')).toBe('');
  match.act({...auditor,...stations.panel},'panel',4);
  expect(render(auditor,'panel')).toBe('');
  expect(render(auditor,'audit',NEGOTIATION_MS-1)).toBe('');
  match.advance(NEGOTIATION_MS);
  expect(render(auditor,'audit',NEGOTIATION_MS)).toBe('');
});
