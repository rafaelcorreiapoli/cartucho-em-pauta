import {expect,test} from 'bun:test';
import {equipmentSlots} from './equipment';

test('equipment slots retain empty hands, feet and accessories in the HUD',()=>{
  expect(equipmentSlots<{kind:string}>([])).toEqual([undefined,undefined,undefined,undefined]);
  const items = [{kind:'megaphone'},{kind:'runningShoes'},{kind:'baton'},{kind:'xray'}];
  expect(equipmentSlots(items).map(item=>item?.kind)).toEqual(['baton','runningShoes','megaphone','xray']);
  expect(equipmentSlots(items.slice(0,2)).map(item=>item?.kind)).toEqual([undefined,'runningShoes','megaphone',undefined]);
});
