export const weapons = {
  baton:{
    sprite:'weapon-baton.webp',
    size:24,
    grip:.16,
    arc:1.9,
    swingMs:320,
    impactMs:140,
    hitRadius:2.5,
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
  const swingStrength = Math.sin(progress*Math.PI);
  const extension = 7+6*swingStrength;
  const lungeX = horizontal*swingStrength*3;
  const lungeY = vertical*swingStrength*3;
  return {
    angle,facing,
    handX:lungeX+Math.cos(angle)*extension,
    handY:lungeY-16+Math.sin(angle)*extension*.55,
    lean:horizontal*strike*.16,
    lungeX,lungeY,
  };
}

export function weaponImpactSegment(swing:WeaponSwing) {
  const {size,grip,impactMs,swingMs} = weapons[swing.weapon];
  const {handX,handY,angle} = weaponPose(swing,impactMs/swingMs);
  const offsetX = Math.cos(angle)*size;
  const offsetY = Math.sin(angle)*size;
  return {
    handle:{x:handX-offsetX*grip,y:handY-offsetY*grip},
    tip:{x:handX+offsetX*(1-grip),y:handY+offsetY*(1-grip)},
  };
}
