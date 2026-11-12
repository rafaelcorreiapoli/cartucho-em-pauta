export const equipment = {
  binoculars:{slot:'vision',price:2,symbol:'🔭'},
  voiceModulator:{slot:'voice',price:3,symbol:'🎙️'},
  vest:{slot:'armor',price:3,symbol:'🛡️'},
  baton:{slot:'weapon',price:2,symbol:'🏏'},
} as const;

export type Gear = keyof typeof equipment;
export const gearKinds = Object.keys(equipment) as Gear[];
export const isGear = (kind:unknown):kind is Gear => typeof kind==='string' && Object.hasOwn(equipment,kind);
export const binocularBonus = 2;
export const voiceBattery = 25_000;
export const voiceRecharge = 45_000;
