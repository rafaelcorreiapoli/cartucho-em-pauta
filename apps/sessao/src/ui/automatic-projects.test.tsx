import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {AutomaticProjectHistory,AutomaticProjectAnnouncement} from './automatic-projects';
import {automaticProjects,type AutomaticProject} from '../automatic-projects';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {createHudModel} from './hud-model';
import {money} from '../politics';

test('history shows a countdown and four secret slots, revealing only approved projects',()=>{
  const hidden = renderToStaticMarkup(<AutomaticProjectHistory state={{approved:[],total:4,nextIn:300}}/>);
  expect(hidden).toContain('Próxima aprovação');
  expect(hidden).toContain('5:00');
  expect(hidden.match(/Não revelado/g)).toHaveLength(4);
  for (const project of Object.values(automaticProjects)) expect(hidden).not.toContain(project.shortName);
  const history = renderToStaticMarkup(<AutomaticProjectHistory state={{approved:[{project:'porrete',at:300000,cost:6,recipients:6}],total:4,nextIn:90}}/>);
  expect(history).toContain('Porrete');
  expect(history.match(/Não revelado/g)).toHaveLength(3);
  expect(history).toContain('1:30');
});

test.each(Object.keys(automaticProjects) as AutomaticProject[])('approval %s shows image, joke, actual cost and effect',project=>{
  const html = renderToStaticMarkup(<AutomaticProjectAnnouncement approval={{project,at:300000,cost:6,recipients:6}} onClose={()=>{}}/>);
  expect(html).toContain(automaticProjects[project].name);
  expect(html).toContain(automaticProjects[project].description);
  expect(html).toContain(automaticProjects[project].effect);
  expect(html).toContain(`/automatic-projects/${automaticProjects[project].image}.webp`);
  expect(html).toContain('60.000,00');
});

test('automatic-project HUD channel clears on disabled mode, game end and rematch',()=>{
  const hud = createHudModel();
  const base = new PlenaryMatch(1).view('a',['a'],0);
  const state = {approved:[],total:4,nextIn:300};
  hud.render({...base,phase:'negotiation',automaticProjects:state});
  expect(hud.automaticProjects.get()?.state).toEqual(state);
  hud.render({...base,phase:'negotiation'});
  expect(hud.automaticProjects.get()).toBeUndefined();
  hud.render({...base,phase:'finished',automaticProjects:state});
  expect(hud.automaticProjects.get()).toBeUndefined();
  hud.render({...base,phase:'lobby',automaticProjects:state});
  expect(hud.automaticProjects.get()).toBeUndefined();
  expect(money(1.25)).toBe('R$ 12,5 mil');
});
