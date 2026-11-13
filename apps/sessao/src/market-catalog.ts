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

const technical = {...equipment,...officeGoods,...spyProducts,...supplies};
const catalogs = {equipment:technical,food:foods} as const;
type Catalog = keyof typeof catalogs;
type TechnicalProduct = keyof typeof technical;

export const marketKinds = {
  equipment:Object.keys(technical) as TechnicalProduct[],
  food:Object.keys(foods) as (keyof typeof foods)[],
};

export function marketProduct(catalog:Catalog|undefined,kind:unknown) {
  if (!catalog || typeof kind!=='string' || !Object.hasOwn(catalogs[catalog],kind)) return;
  const product = catalog==='food' ? foods[kind as keyof typeof foods] : technical[kind as TechnicalProduct];
  return {kind:kind as TechnicalProduct|keyof typeof foods,price:product.price};
}
