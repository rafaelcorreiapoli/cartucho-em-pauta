import {expect,test} from 'bun:test';
import {fireOptions,fireSites} from './fire';

test('contextual controls offer the extinguisher nearby and keep sabotage private',()=>{
  const site = fireSites[0];
  const active = {site:0,remaining:15,damage:2,paused:false};
  expect(fireOptions(site.extinguisher,active,undefined)).toMatchObject({kind:'extinguish',site:0});
  expect(fireOptions({x:0,y:0},active,undefined)).toBeUndefined();
  expect(fireOptions(site.extinguisher,{...active,paused:true},undefined)).toBeUndefined();
  expect(fireOptions(site,undefined,undefined)).toBeUndefined();
  expect(fireOptions(site,undefined,0)).toMatchObject({kind:'ignite',site:0});
});
