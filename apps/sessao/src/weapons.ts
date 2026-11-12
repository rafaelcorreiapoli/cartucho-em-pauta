export const weapons = {
  baton:{
    sprite:'weapon-baton.webp',
    size:24,
    grip:.16,
    arc:1.9,
    swingMs:320,
    reach:24,
    cooldown:1_250,
    damage:12,
    strengthScale:.28,
  },
} as const;

export type WeaponKind = keyof typeof weapons;
export type WeaponSwing = {weapon:WeaponKind; startedAt:number; angle:number};

export function weaponPose(swing:WeaponSwing, progress:number) {
  const {arc} = weapons[swing.weapon];
  const horizontal = Math.cos(swing.angle);
  const vertical = Math.sin(swing.angle);
  const side = horizontal<0 ? -1 : 1;
  const facing = Math.abs(horizontal)>Math.abs(vertical) ? (horizontal>0 ? 1 : 3) : (vertical>0 ? 0 : 2);
  const strike = progress<.26 ? -.2-.8*progress/.26 :
    progress<.6 ? -1+2*(progress-.26)/.34 : 1-(progress-.6)/.4;
  const angle = swing.angle+side*strike*arc*.5;
  const extension = 7+6*Math.sin(progress*Math.PI);
  return {
    angle,facing,
    handX:Math.cos(angle)*extension,
    handY:-16+Math.sin(angle)*extension*.55,
    lean:horizontal*strike*.16,
    lungeX:horizontal*Math.sin(progress*Math.PI)*3,
    lungeY:vertical*Math.sin(progress*Math.PI)*3,
  };
}
