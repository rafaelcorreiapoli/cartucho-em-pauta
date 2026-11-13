export const equipment = {
  xray:{slot:'scanner',price:5,symbol:'▣'},
  binoculars:{slot:'vision',price:2,symbol:'🔭'},
  voiceModulator:{slot:'voice',price:3,symbol:'🎙️'},
  vest:{slot:'armor',price:3,symbol:'🛡️'},
  runningShoes:{slot:'feet',price:2,symbol:'👟'},
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
export const xray = {capacity:3,rechargePrice:1,range:20} as const;

export const binocularBonus = 2;
export const voiceBattery = 25_000;
export const voiceRecharge = 45_000;
