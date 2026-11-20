import {expect,test} from 'bun:test';
import {equipmentCategories,equipmentCategoryKinds,marketKinds,marketProduct} from './market-catalog';
import {describeFood,foods} from './food';

test('every technical product has one category and the specialized tool cannot be purchased',()=>{
  const kinds = Object.keys(equipmentCategories).flatMap(key=>equipmentCategoryKinds(key as keyof typeof equipmentCategories));
  expect(new Set(kinds).size).toBe(kinds.length);
  expect([...kinds].sort()).toEqual([...marketKinds.equipment].sort());
  expect(equipmentCategoryKinds('utilities')).toContain('firstAidKit');
  expect(equipmentCategoryKinds('equipment')).toContain('briefcaseTracker');
  expect(marketProduct('equipment','masterDecoder')).toBeUndefined();
});
test('snack counter sells only pizza, chocolates and coffee',()=>{
  expect(marketKinds.food).toEqual(['pizza','chocolates','coffee']);
  expect(marketProduct('food','energyDrink')).toBeUndefined();
  expect(describeFood(foods.chocolates.effect)).toBe('+40 PV · −20 stamina');
});
