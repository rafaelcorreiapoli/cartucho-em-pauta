import {isGear} from './equipment';
import {occupiesInventorySlot, type WorldItem} from './gameplay';

export const HOTBAR_SLOTS = 6;

export const canPinToHotbar = (item:Pick<WorldItem,'kind'>) => occupiesInventorySlot(item) && !isGear(item.kind);

export function assignHotbarSlot(slots:readonly (number|undefined)[], index:number, item:number) {
  return slots.map((id,slot)=>slot===index ? item : id===item ? undefined : id);
}

export function reconcileHotbar(slots:readonly (number|undefined)[], inventory:readonly WorldItem[]) {
  return slots.map(id=>inventory.find(item=>item.id===id && canPinToHotbar(item))?.id);
}

export function emptyHotbar() {
  return Array<number|undefined>(HOTBAR_SLOTS).fill(undefined);
}

export function pinPurchasedConsumable(slots:readonly (number|undefined)[], item:number) {
  const free = slots.indexOf(undefined);
  return free<0 || slots.includes(item) ? slots : assignHotbarSlot(slots,free,item);
}
