export const weapons = {
  baton:{
    sprite:'weapon-baton.webp',
    size:24,
    grip:.16,
    swingMs:320,
    impactMs:140,
    hitRadius:2.5,
    staminaCost:10,
    damage:12,
    strengthScale:.28,
  },
} as const;

export type WeaponKind = keyof typeof weapons;
export type WeaponSwing = {weapon:WeaponKind; startedAt:number; angle:number};

export function weaponPose(swing:WeaponSwing, progress:number) {
  const {impactMs,swingMs} = weapons[swing.weapon];
  const horizontal = Math.cos(swing.angle);
  const vertical = Math.sin(swing.angle);
  const facing = Math.abs(horizontal)>Math.abs(vertical) ? (horizontal>0 ? 1 : 3) : (vertical>0 ? 0 : 2);
  const impact = impactMs/swingMs;
  const windup = impact*.55;
  const extension = progress<windup ? -3*progress/windup :
    progress<impact ? -3+13*(progress-windup)/(impact-windup) : 10*(1-progress)/(1-impact);
  const lunge = Math.max(0,extension)*.3;
  const lungeX = horizontal*lunge;
  const lungeY = vertical*lunge;
  return {
    angle:swing.angle,facing,
    handX:lungeX+horizontal*(7+extension),
    handY:lungeY-16+vertical*(7+extension),
    lean:0,
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

export function canSwingWeapon(stamina:number,weapon:WeaponKind) {
  return stamina>=weapons[weapon].staminaCost;
}
