import {expect,test} from 'bun:test';
import {equipmentSlots,gearConflict} from './equipment';

test('equipment slots retain empty hands, torso, feet and accessories in the HUD',()=>{
  expect(equipmentSlots<{kind:string}>([])).toEqual([undefined,undefined,undefined,undefined,undefined]);
  const items = [{kind:'megaphone'},{kind:'runningShoes'},{kind:'baton'},{kind:'xray'},{kind:'vest'}];
  expect(equipmentSlots(items).map(item=>item?.kind)).toEqual(['baton','vest','runningShoes','megaphone','xray']);
  expect(equipmentSlots(items.slice(0,2)).map(item=>item?.kind)).toEqual([undefined,undefined,'runningShoes','megaphone',undefined]);
});

test('vest and accessories can be equipped independently',()=>{
  const vest = {kind:'vest'};
  const megaphone = {kind:'megaphone'};
  const xray = {kind:'xray'};
  expect(gearConflict('vest',[megaphone,xray])).toBeUndefined();
  expect(gearConflict('xray',[vest,megaphone])).toBeUndefined();
  expect(gearConflict('vest',[vest,megaphone,xray])).toBe(vest);
  expect(gearConflict('binoculars',[vest,megaphone,xray])).toBe(megaphone);
});
