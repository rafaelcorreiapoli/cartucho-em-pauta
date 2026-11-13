export const equipment = {
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

export const binocularBonus = 2;
export const voiceBattery = 25_000;
export const voiceRecharge = 45_000;
