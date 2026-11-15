import {expect,test} from 'bun:test';
import {fireOptions,fireSites} from './fire';

test('extinguishing requires proximity to the flames and an extinguisher, and sabotage stays private',()=>{
  const site = fireSites[0];
  const active = {site:0,remaining:15,damage:2,paused:false};
  expect(fireOptions(site,active,undefined,true)).toMatchObject({kind:'extinguish',site:0});
  expect(fireOptions(site,active,undefined,false)).toBeUndefined();
  expect(fireOptions(site.extinguisher,active,undefined,true)).toBeUndefined();
  expect(fireOptions({...site,knockedOut:true},active,undefined,true)).toBeUndefined();
  expect(fireOptions(site,{...active,paused:true},undefined,true)).toBeUndefined();
  expect(fireOptions(site,undefined,undefined,false)).toBeUndefined();
  expect(fireOptions(site,undefined,0,false)).toMatchObject({kind:'ignite',site:0});
});
