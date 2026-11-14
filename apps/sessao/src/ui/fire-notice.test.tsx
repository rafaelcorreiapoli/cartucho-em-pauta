import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Fire} from '../../server/Fire';
import {fireRules,fireSites} from '../fire';
import {FireNotice} from './hud';

test('the fire notice reads the authoritative loss rate and stops advertising damage while paused',()=>{
  const fire = new Fire();
  expect(fire.ignite(0)).toBe(true);
  expect(fire.advance(fireRules.tick,true)).toBe(fireRules.damage);
  const active = renderToStaticMarkup(<FireNotice fire={fire.view(true)!}/>);
  expect(active).not.toContain("Incidentes ativos");
  expect(active).toContain('data-paused="false"');
  expect(active).toContain("Incêndio");
  expect(active).toContain(fireSites[0].name);
  expect(active).toContain(`−${fireRules.damage} de estabilidade a cada ${fireRules.tick/1000} s`);
  expect(fire.advance(fireRules.tick*2,false)).toBe(0);
  const paused = renderToStaticMarkup(<FireNotice fire={fire.view(false)!}/>);
  expect(paused).toContain('Pausado');
  expect(paused).toContain('data-paused="true"');
  expect(paused).not.toContain('de estabilidade');
});
