import { concealment, equipment } from './equipment';
import { foods } from './food';
import { documentRules } from './internal-mail';
import { firstAidKit } from './medical';
import { officeGoods } from './private-offices';
import { spyProducts } from './surveillance';

const supplies = {
  mensalUnderwear:concealment,
  forensicKit:{price:documentRules.kitPrice},
  firstAidKit,
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

export function marketProduct(catalog:Catalog|undefined,kind:unknown) {
  if (!catalog || typeof kind!=='string' || !Object.hasOwn(catalogs[catalog],kind)) return;
  const products:Readonly<Record<string,{price:number}>> = catalogs[catalog];
  return {kind:kind as TechnicalProduct|keyof typeof foods|keyof typeof officeGoods,price:products[kind].price};
}
