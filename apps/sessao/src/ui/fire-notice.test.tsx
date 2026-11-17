import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Fire} from '../../server/Fire';
import {fireRules,fireSites} from '../fire';
import {objects} from '../gameplay';
import {FireNotice} from './hud';

test('the fire notice reads the authoritative loss rate and stops advertising damage while paused',()=>{
  const fire = new Fire();
  fire.reset(0,()=>0);
  fire.advance(fireRules.firstAfter,true);
  expect(fire.advance(fireRules.firstAfter+fireRules.tick,true)).toBe(fireRules.damage);
  const active = renderToStaticMarkup(<FireNotice fire={fire.view(true)!}/>);
  expect(active).not.toContain("Incidentes ativos");
  expect(active).toContain('data-paused="false"');
  expect(active).toContain("Incêndio");
  expect(active).toContain(fireSites[0].name);
  expect(active).toContain(`−${fireRules.damage} de estabilidade a cada ${fireRules.tick/1000} s`);
  expect(fire.advance(fireRules.firstAfter+fireRules.tick*2,false)).toBe(0);
  const paused = renderToStaticMarkup(<FireNotice fire={fire.view(false)!}/>);
  expect(paused).toContain('Pausado');
  expect(paused).toContain('data-paused="true"');
  expect(paused).not.toContain('de estabilidade');
});

test('the shop describes the fuse duration used by the fire simulation',()=>{
  const fire = new Fire();
  const player = {id:'a',nick:'A',character:0,direction:0,moving:false,...fireSites[0]};
  fire.reset(0,()=>0);
  expect(fire.plant(player,0,1,0)).toBe(true);
  fire.advance(fireRules.install,true);
  expect(fire.updateInstallation(player,fireRules.install,()=>true,()=>true)).toBe('Incendiário instalado.');
  const description = objects.incendiary.description;
  const fuseSeconds = Number(description.match(/após (\d+) segundos/)?.[1]);
  expect(fuseSeconds).toBe(fireRules.fuse/1000);

  const ignition = fireRules.install+fuseSeconds*1000;
  fire.advance(ignition-1,true);
  expect(fire.view(true)).toBeUndefined();
  fire.advance(ignition,true);
  expect(fire.view(true)?.site).toBe(0);
});
