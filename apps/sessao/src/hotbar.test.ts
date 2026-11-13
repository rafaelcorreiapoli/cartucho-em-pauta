import {expect,test} from 'bun:test';
import {assignHotbarSlot,emptyHotbar,reconcileHotbar} from './hotbar';

test('a hotbar reference stays in its chosen slot regardless of bag order',()=>{
  const snack = {id:4,kind:'coxinha'} as const;
  const coffee = {id:7,kind:'coffee'} as const;
  const slots = assignHotbarSlot(emptyHotbar(),4,snack.id);
  expect(reconcileHotbar(slots,[coffee,snack])[4]).toBe(4);
  expect(reconcileHotbar(slots,[snack,coffee])[4]).toBe(4);
  expect(reconcileHotbar(slots,[coffee])).toEqual(emptyHotbar());
  expect(assignHotbarSlot(slots,1,snack.id)).toEqual([undefined,4,undefined,undefined,undefined,undefined]);
});
