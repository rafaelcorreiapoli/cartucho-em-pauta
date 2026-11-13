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
