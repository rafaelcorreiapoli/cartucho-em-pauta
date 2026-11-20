import {expect,test} from 'bun:test';
import {canStackItem,readGameplayAction,selectedItemQuantity,type WorldItem} from './gameplay';

test('the inventory quantity control sends only the selected number of units',()=>{
  const item:WorldItem = {kind:'coxinha',id:4,quantity:3};
  expect(selectedItemQuantity(item,0)).toBe(1);
  const quantity = selectedItemQuantity(item,5);
  expect(readGameplayAction({kind:'offer',item:item.id,quantity})?.quantity).toBe(3);
  expect(readGameplayAction({kind:'drop',item:item.id,quantity:2})?.quantity).toBe(2);
  for (const invalid of [0,-1,1.5,'2',Infinity]) {
    expect(readGameplayAction({kind:'drop',item:item.id,quantity:invalid})).toBeUndefined();
  }
  expect(canStackItem('coxinha')).toBe(true);
  expect(canStackItem('coffee')).toBe(true);
  expect(canStackItem('energyDrink')).toBe(true);
  expect(canStackItem('pizza')).toBe(false);
  expect(canStackItem('xray')).toBe(false);
});
