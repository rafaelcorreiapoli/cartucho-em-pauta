import {expect,test} from 'bun:test';
import {depositingAtSafe,privateOffices} from './private-offices';

test('only the safe near an active deposit is open, and closes when the action ends',()=>{
  const office = privateOffices[0];
  const depositor = {...office.safe,pocketing:true};
  expect(depositingAtSafe(office,[depositor])).toBe(true);
  expect(depositingAtSafe(office,[{...depositor,pocketing:false}])).toBe(false);
  expect(depositingAtSafe(office,[])).toBe(false);
  expect(depositingAtSafe(office,[{...depositor,x:depositor.x+18}])).toBe(false);
  expect(depositingAtSafe(privateOffices[1],[depositor])).toBe(false);
});
