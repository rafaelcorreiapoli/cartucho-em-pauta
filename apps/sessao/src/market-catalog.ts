import {investmentRules} from './public-investments';
import { credentialGoods } from './installations';
import { incendiary } from './fire';
import {ghostAdviser} from './ghost-advisers';
import {policyDiscountPercent,type BillPolicies} from './plenary';
import { briefcaseTracker, concealment, equipment, gearConflict, isGear } from './equipment';
import {canStackItem,hasInventorySpace,occupiesInventorySlot,type ObjectKind,type WorldItem} from './gameplay';
import { foods } from './food';
import { documentRules,internalMailRules } from './internal-mail';
import { firstAidKit } from './medical';
import { isOfficeFurniture, officeGoods } from './private-offices';
import { spyProducts } from './surveillance';

const supplies = {
  mensalUnderwear:concealment,
  briefcaseTracker,
  forensicKit:{price:documentRules.kitPrice},
  firstAidKit,
  incendiary,
  ghostAdviser,
} as const;

const {officeTv,officeRug,officeChair,masterDecoder,...securityGoods} = officeGoods;
const furniture = {officeTv,officeRug,officeChair};
const technical = {...equipment,...securityGoods,...spyProducts,...supplies};
const snackMenu = {pizza:foods.pizza,chocolates:foods.chocolates,coffee:foods.coffee};
const catalogs = {equipment:technical,food:snackMenu,furniture,credentials:credentialGoods} as const;
type Catalog = keyof typeof catalogs;
type TechnicalProduct = keyof typeof technical;

export function decorationProductEnabled(kind:unknown,furnitureEnabled=true,portraitsAndVipEnabled=true) {
  return (furnitureEnabled || typeof kind!=='string' || !isOfficeFurniture(kind)) &&
    (portraitsAndVipEnabled || !isCredentialGood(kind));
}

export function isCredentialGood(kind:unknown):kind is keyof typeof credentialGoods {
  return typeof kind==='string' && Object.hasOwn(credentialGoods,kind);
}

export const marketKinds = {
  credentials:Object.keys(credentialGoods) as (keyof typeof credentialGoods)[],
  equipment:Object.keys(technical) as TechnicalProduct[],
  food:Object.keys(snackMenu) as (keyof typeof foods)[],
  furniture:Object.keys(furniture) as (keyof typeof furniture)[],
};

export const equipmentCategories = {
  equipment:{label:'Equipamentos',kinds:['xray','binoculars','voiceModulator','megaphone','vest','runningShoes','baton','briefcaseTracker']},
  burglary:{label:'Arrombamento',kinds:['lockpick','lockKit','proLockKit','decoder']},
  sabotage:{label:'Sabotagem',kinds:['mensalUnderwear','incendiary','ghostAdviser']},
  utilities:{label:'Utilidades',kinds:['firstAidKit','forensicKit','doorLock','cabinetLock','wiretap','spyCamera','bugDetector','safeTrap']},
} as const;
export type EquipmentCategory = keyof typeof equipmentCategories;
export function equipmentCategoryKinds(category:EquipmentCategory) {
  return equipmentCategories[category].kinds.filter(kind=>marketKinds.equipment.includes(kind));
}

export const discountedPrice = (price:number,discount:number=policyDiscountPercent) => Math.max(.1,Math.round(price*(100-discount)/10)/10);

export const mailPublicationFee = (policies?:BillPolicies) => policies?.mail ? discountedPrice(internalMailRules.fee) : internalMailRules.fee;

export function marketProduct(catalog:Catalog|undefined,kind:unknown,policies?:BillPolicies,publicBudget=Infinity) {
  if (!catalog || typeof kind!=='string' || !Object.hasOwn(catalogs[catalog],kind)) return;
  const products:Readonly<Record<string,{price:number}>> = catalogs[catalog];
  const price = products[kind].price;
  const subsidized = catalog==='food' && kind==='coffee' && policies?.coffee ||
    catalog==='furniture' && policies?.furniture ||
    catalog==='equipment' && (policies?.equipment && (Object.hasOwn(equipment,kind) || Object.hasOwn(spyProducts,kind)) ||
      kind==='forensicKit' && policies?.mail);
  const subsidy = Math.round((price-discountedPrice(price))*10)/10;
  const policyPrice = subsidized && Math.round(publicBudget*10)>=Math.round(subsidy*10) ? discountedPrice(price) : price;
  const suppliesPrice = catalog==='food' && policies?.supplies ? discountedPrice(price,investmentRules.suppliesDiscount) : price;
  const useSubsidy = policyPrice<suppliesPrice;
  return {
    kind:kind as TechnicalProduct|keyof typeof foods|keyof typeof officeGoods|keyof typeof credentialGoods,
    price:Math.min(policyPrice,suppliesPrice),
    ...(useSubsidy ? {subsidy} : {}),
  };
}

export function marketPurchaseSlot(kind:ObjectKind,inventory:readonly Pick<WorldItem,'kind'>[],
  equipped:readonly Pick<WorldItem,'kind'>[],direct:boolean) {
  if (kind==='ghostAdviser') return 'service';
  if (isOfficeFurniture(kind)) return 'office';
  if (direct && isGear(kind) && !gearConflict(kind,equipped)) return 'equipped';
  if (hasInventorySpace(inventory.filter(occupiesInventorySlot).length) || canStackItem(kind) && inventory.some(item=>item.kind===kind)) return 'inventory';
}
