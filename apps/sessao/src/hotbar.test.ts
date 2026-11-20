import {expect,test} from 'bun:test';
import {assignHotbarSlot,emptyHotbar,pinPurchasedConsumable,reconcileHotbar} from './hotbar';

test('a hotbar reference stays in its chosen slot regardless of bag order',()=>{
  const snack = {id:4,kind:'coxinha'} as const;
  const coffee = {id:7,kind:'coffee'} as const;
  const slots = assignHotbarSlot(emptyHotbar(),4,snack.id);
  expect(reconcileHotbar(slots,[coffee,snack])[4]).toBe(4);
  expect(reconcileHotbar(slots,[snack,coffee])[4]).toBe(4);
  expect(reconcileHotbar(slots,[coffee])).toEqual(emptyHotbar());
  expect(assignHotbarSlot(slots,1,snack.id)).toEqual([undefined,4,undefined,undefined,undefined,undefined]);
});

test('equipment is excluded from hotbar assignments',()=>{
  const slots = assignHotbarSlot(emptyHotbar(),0,5);
  expect(reconcileHotbar(slots,[{id:5,kind:'megaphone'}])).toEqual(emptyHotbar());
});

test('a purchased consumable uses the first free slot without moving a stack or replacing a shortcut',()=>{
  const slots = [4,undefined,7,undefined,undefined,9];
  expect(pinPurchasedConsumable(slots,7)).toBe(slots);
  expect(pinPurchasedConsumable(slots,12)).toEqual([4,12,7,undefined,undefined,9]);
  const full = [1,2,3,4,5,6];
  expect(pinPurchasedConsumable(full,12)).toBe(full);
});

test('only consumables can remain pinned, including after inventory reconciliation',()=>{
  for (const kind of ['bugDetector','wiretap','spyCamera','document','briefcase','forensicKit'] as const) {
    expect(reconcileHotbar([5],[{id:5,kind}])).toEqual([undefined]);
  }
  expect(reconcileHotbar([5],[{id:5,kind:'coffee'}])).toEqual([5]);
});
