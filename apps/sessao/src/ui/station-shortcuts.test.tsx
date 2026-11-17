import {publishProjectFiling} from '../../server/project-test-fixture';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {NEGOTIATION_MS,stations,type Station} from '../plenary';
import {StationShortcuts,stationShortcuts} from './station-shortcuts';

test('the contextual shortcuts reflect room activities and consumed public grants',()=>{
  const player:Player = {id:'a',nick:'Rafa',character:0,x:140,y:146,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.4)).toBe(true);
  publishProjectFiling(match,player);
  const view = (now:number)=>match.view(player.id,[player.id],now);
  const render = (station?:Station,now=1)=>renderToStaticMarkup(
    <StationShortcuts actions={stationShortcuts(view(now),station ? {...player,...stations[station]} : player,station)}
      select={()=>{}}/>,
  );

  expect(render()).toBe('');
  expect(render('coffee')).toContain('Beber café');
  expect(render('coffee')).not.toContain('Aplicar verba');
  expect(render('cabinet')).toContain('Aplicar verba');
  expect(render('cabinet')).not.toContain('Consultar orçamento');
  match.politics({...player,...stations.cabinet},{kind:'grant',diverted:0},[player],4);
  expect(render('cabinet',4)).toBe('');
  expect(render('secretary')).toBe('');
  expect(render('archive')).toBe('');
  expect(render('coffee',NEGOTIATION_MS-1)).toBe('');
});
