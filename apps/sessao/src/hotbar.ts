import {INVENTORY_SLOTS, type WorldItem} from './gameplay';

export function assignHotbarSlot(slots:readonly (number|undefined)[], index:number, item:number) {
  return slots.map((id,slot)=>slot===index ? item : id===item ? undefined : id);
}

export function reconcileHotbar(slots:readonly (number|undefined)[], inventory:readonly WorldItem[]) {
  return slots.map(id=>inventory.find(item=>item.id===id)?.id);
}

export function emptyHotbar() {
  return Array<number|undefined>(INVENTORY_SLOTS).fill(undefined);
}
