import { incendiary } from './fire';
import {policyDiscountPercent,type BillPolicies} from './plenary';
import { concealment, equipment } from './equipment';
import { foods } from './food';
import { documentRules,internalMailRules } from './internal-mail';
import { firstAidKit } from './medical';
import { officeGoods } from './private-offices';
import { spyProducts } from './surveillance';

const supplies = {
  mensalUnderwear:concealment,
  forensicKit:{price:documentRules.kitPrice},
  firstAidKit,
  incendiary,
} as const;

const {officeTv,officeRug,officeChair,...securityGoods} = officeGoods;
const furniture = {officeTv,officeRug,officeChair};
const technical = {...equipment,...securityGoods,...spyProducts,...supplies};
const catalogs = {equipment:technical,food:foods,furniture} as const;
type Catalog = keyof typeof catalogs;
type TechnicalProduct = keyof typeof technical;

export const marketKinds = {
  equipment:Object.keys(technical) as TechnicalProduct[],
  food:Object.keys(foods) as (keyof typeof foods)[],
  furniture:Object.keys(furniture) as (keyof typeof furniture)[],
};

export const discountedPrice = (price:number) => Math.max(.1,Math.round(price*(100-policyDiscountPercent)/10)/10);

export const mailPublicationFee = (policies?:BillPolicies) => policies?.mail ? discountedPrice(internalMailRules.fee) : internalMailRules.fee;

export function marketProduct(catalog:Catalog|undefined,kind:unknown,policies?:BillPolicies,publicBudget=Infinity) {
  if (!catalog || typeof kind!=='string' || !Object.hasOwn(catalogs[catalog],kind)) return;
  const products:Readonly<Record<string,{price:number}>> = catalogs[catalog];
  const price = products[kind].price;
  const subsidized = catalog==='food' && kind==='coffee' && policies?.coffee ||
    catalog==='furniture' && policies?.furniture ||
    catalog==='equipment' && (policies?.equipment && (Object.hasOwn(equipment,kind) || Object.hasOwn(spyProducts,kind)) ||
      kind==='forensicKit' && policies?.mail);
  return {kind:kind as TechnicalProduct|keyof typeof foods|keyof typeof officeGoods,price:subsidized && Math.round(publicBudget*10)>=Math.round((price-discountedPrice(price))*10) ? discountedPrice(price) : price};
}
