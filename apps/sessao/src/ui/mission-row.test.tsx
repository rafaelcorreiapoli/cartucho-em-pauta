import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {MissionRow} from './hud';
import {targetedAgendas,type Mission} from '../politics';

test('active and completed targeted missions render the public nickname',()=>{
  for (const kind of Object.keys(targetedAgendas) as (keyof typeof targetedAgendas)[]) {
    const mission:Mission = {id:1,kind,current:0,target:1,person:{id:'private-session',name:'Bia'}};
    const active = renderToStaticMarkup(<MissionRow mission={mission}/>);
    const complete = renderToStaticMarkup(<MissionRow mission={{...mission,current:1}} done/>);
    expect(active).toContain('Bia');
    expect(active).not.toContain('private-session');
    expect(complete).toContain('Bia');
    expect(complete).toContain('data-done="true"');
  }
});

test('the furniture spending objective displays currency on both sides of its progress',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:2,kind:'ostentacao',current:3,target:5}}/>);
  expect(markup).toContain('R$ 30 mil / R$ 50 mil');
});

test('an opposition mission shows progress across successive ballots',()=>{
  const mission:Mission = {id:3,kind:'oposicao',current:1,target:2};
  const markup = renderToStaticMarkup(<MissionRow mission={mission}/>);
  expect(markup).toContain('Vote contra dois projetos rejeitados');
  expect(markup).toContain('1 / 2');
  expect(renderToStaticMarkup(<MissionRow mission={{...mission,current:2}} done/>)).toContain('data-done="true"');
});
