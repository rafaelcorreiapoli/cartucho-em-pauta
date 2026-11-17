export const equipment = {
  xray:{slot:'scanner',price:5,symbol:'▣'},
  binoculars:{slot:'vision',price:2,symbol:'🔭'},
  voiceModulator:{slot:'voice',price:3,symbol:'🎙️'},
  megaphone:{slot:'broadcast',price:4,symbol:'📣'},
  vest:{slot:'armor',price:3,damageReduction:.35,symbol:'🛡️'},
  runningShoes:{slot:'feet',price:2,speedBonus:25,symbol:'👟'},
  baton:{slot:'weapon',weapon:'baton',price:2,symbol:'🏏'},
} as const;

export type Gear = keyof typeof equipment;
export const gearKinds = Object.keys(equipment) as Gear[];
export const isGear = (kind:unknown):kind is Gear => typeof kind==='string' && Object.hasOwn(equipment,kind);
export function equippedWeapon(items:readonly {kind:string}[] = []) {
  for (const {kind} of items) {
    if (!isGear(kind)) continue;
    const gear = equipment[kind];
    if ('weapon' in gear) return gear.weapon;
  }
}

export const concealment = {duration:45_000,price:2} as const;
export const xray = {capacity:3,rechargePrice:1,duration:10_000, sweep:800} as const;

export const binoculars = {duration:10_000,cooldown:30_000,multiplier:1.65} as const;

export const megaphone = {duration:15_000,cooldown:45_000,volume:.85} as const;

export const accessorySlots = 2;
export function equipmentGroup(kind:Gear) {
  const {slot} = equipment[kind];
  if (slot==='weapon') return 'hands';
  if (slot==='armor') return 'torso';
  if (slot==='feet') return 'feet';
  return 'accessory';
}

export function equipmentSlots<T extends {kind:string}>(items:readonly T[]): (T|undefined)[] {
  const groups = {hands:[] as T[],torso:[] as T[],feet:[] as T[],accessory:[] as T[]};
  for (const item of items) {
    if (isGear(item.kind)) groups[equipmentGroup(item.kind)].push(item);
  }
  return [groups.hands[0],groups.torso[0],groups.feet[0],...Array.from({length:accessorySlots},(_,index)=>groups.accessory[index])];
}

export function gearConflict<T extends {kind:string}>(kind:Gear, equipped:readonly T[]) {
  const same = equipped.find(item=>isGear(item.kind) && equipment[item.kind].slot===equipment[kind].slot);
  if (same || equipmentGroup(kind)!=='accessory') return same;
  const accessories = equipped.filter(item=>isGear(item.kind) && equipmentGroup(item.kind)==='accessory');
  return accessories.length>=accessorySlots ? accessories[0] : undefined;
}
