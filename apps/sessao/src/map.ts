import {investmentRules} from './public-investments';
import { equipment } from './equipment';
import { eastAnnex, officeFixtures, privateOffices } from './private-offices';
import type { WeaponSwing } from './weapons';
import { carrySpeedFactor } from './medical';
import { mapNpcs, npcs } from './npcs';

import { desks, furnishings, HEIGHT, mapDoor, mapPoint, roomBounds, rooms, seats, walls, WIDTH } from './congress-layout';

export { desks, furnishings, HEIGHT, rooms, walls, WIDTH };

export const SPEED = 88;
export const NAMES = ['Lula', 'Bolsonaro', 'Clodovil', 'Tiririca', 'Sikêra Jr.', 'Alexandre Frota', 'Sergio Moro', 'Inês Brasil'] as const;
export type Rect = readonly [x: number, y: number, width: number, height: number];

export const isolationRoom = {
  name:'Sala de Isolamento',bounds:roomBounds('Sala de Isolamento'),
  spawn:mapPoint('Isolamento: entrada'),exit:mapPoint('Isolamento: saída'),
};
export const securityRoom = {
  name:'Sala de Segurança',bounds:roomBounds('Sala de Segurança'),terminal:mapPoint('Terminal de segurança'),
};
export const PLENARY_BOUNDS = roomBounds('Plenário');
export const PLENARY_DOORS = [1,2,3].map(index=>mapDoor(`Plenário ${index}`));
export const PLENARY_SEATS = seats;

function npcFootprint(npc:(typeof mapNpcs)[keyof typeof mapNpcs]):Rect {
  const {x,y} = npc;
  return npc===npcs.snackVendor ? [x-7,y-9,14,10] : [x-5,y-5,10,5];
}
const obstacles = [
  ...walls,
  ...privateOffices.flatMap(office=>(['safe','cabinet'] as const).map((kind):Rect=>{
    const {x,y} = office[kind];
    const {width,footOffset} = officeFixtures[kind];
    return [x-width/2,y-footOffset-5,width,5];
  })),
  ...Object.values(mapNpcs).map(npc=>npcFootprint(npc)),
  ...desks.map(({x,y}):Rect => [x,y+2,45,18]),
  ...furnishings.map(({area:[x,y,width,height],footprint}):Rect =>
    [x,y+height-footprint,width,footprint]),
];

export type MovementModifier = {factor:number; remainingMs:number};
export type Player = Motion & { id: string; nick: string; npc?:true; visitor?:import('./visitors').VisitorId; bot?:true; former?:boolean; character: number; direction: number; moving: boolean; handlingObject?:number; breachingSafe?:true; pocketing?:boolean; cashInHand?:true; speed?:number; publicTransport?:true; speedModifier?:MovementModifier; staminaRegenModifier?:MovementModifier; stamina?:number; staminaMax?:number; runningShoes?:true; interactionSpeedBonus?:number; sprinting?:true; knockedOut?:boolean; carrying?:true; carried?:true; swing?:WeaponSwing; hit?:number; recoveryProtected?:true; health?:number; phone?:import('./gameplay').PhoneActivity; exposed?:import('./gameplay').ExposedItem[] };
export type Motion = { x: number; y: number; barriers?:readonly Rect[] };
export const idle = { x: 0, y: 0 };

export function blockedBy(rect:Rect,x:number,y:number) {
  const [left,top,width,height] = rect;
  const epsilon = 1e-6;
  return x+6>left+epsilon && x-6<left+width-epsilon && y>top+epsilon && y-7<top+height-epsilon;
}

const [plenaryLeft,plenaryTop,plenaryWidth] = PLENARY_BOUNDS;
const southRooms = [...privateOffices,isolationRoom].filter(({bounds})=>bounds[1]>=plenaryTop);

export function canStand(x: number, y: number) {
  if (x<6 || x>WIDTH-6 || y<7 || y>HEIGHT) return false;
  if (x>=eastAnnex.left && (x>eastAnnex.right || y<eastAnnex.top || y>eastAnnex.bottom)) return false;
  if (y>plenaryTop && (x<plenaryLeft+6 || x>plenaryLeft+plenaryWidth-6) && !southRooms.some(({bounds:[left,top,width,height]})=> x>=left && x<=left+width && y>=top && y<=top+height)) return false;
  return obstacles.every(rect=>!blockedBy(rect,x,y));
}

export function canStandInIsolation(x:number,y:number) {
  const [left,top,width,height] = isolationRoom.bounds;
  return x>=left+6 && x<=left+width-6 && y>=top+7 && y<=top+height && canStand(x,y);
}

export function inPlenary({x,y}:Motion) {
  const [left,top,width,height] = PLENARY_BOUNDS;
  return x>=left+6 && x<=left+width-6 && y>=top+7 && y<=top+height;
}
export function canStandInPlenary(x:number,y:number) {
  return inPlenary({x,y}) && canStand(x,y);
}

export const sprintMultiplier = 1.5;

export function movementSpeed(player:Player) {
  const transport = player.publicTransport && !player.sprinting ? 1+investmentRules.transportSpeedBonus/100 : 1;
  return transport*(player.speed ?? SPEED)*(player.runningShoes ? 1+equipment.runningShoes.speedBonus/100 : 1)*(player.speedModifier?.factor ?? 1)*(player.carrying ? carrySpeedFactor : player.sprinting ? sprintMultiplier : 1);
}

export function move(player: Player, input: Motion, seconds: number, stand = canStand) {
  const length = Math.hypot(input.x,input.y);
  if (!length) {
    player.moving = false;
    return;
  }
  const dx = input.x / Math.max(1,length) * movementSpeed(player) * seconds;
  const dy = input.y / Math.max(1,length) * movementSpeed(player) * seconds;
  const {x,y} = player;
  if (stand(x+dx,y)) player.x += dx;
  if (stand(player.x,y+dy)) player.y += dy;
  player.direction = Math.abs(dx)>Math.abs(dy) ? (dx>0 ? 1 : 3) : (dy>0 ? 0 : 2);
  player.moving = x !== player.x || y !== player.y;
}

export const VISION_RADIUS = 86;
const HEARING_RADIUS = 114;

export function segmentIntersects(a:Motion, b:Motion, [x,y,w,h]:Rect) {
  const interval = (start:number, end:number, min:number, max:number) => {
    if (start===end) return start>=min && start<=max ? [-Infinity,Infinity] : [Infinity,-Infinity];
    const first = (min-start)/(end-start), last = (max-start)/(end-start);
    return [Math.min(first,last),Math.max(first,last)];
  };
  const [x0,x1] = interval(a.x,b.x,x,x+w);
  const [y0,y1] = interval(a.y,b.y,y,y+h);
  return Math.max(0,x0,y0)<=Math.min(1,x1,y1);
}

export function obstacleBetween(a:Motion, b:Motion) {
  return obstacles.some(rect=>segmentIntersects(a,b,rect)) || !!a.barriers?.some(rect=>segmentIntersects(a,b,rect));
}

export function wallBetween(a:Motion,b:Motion) {
  return walls.some(rect=>segmentIntersects(a,b,rect)) || !!a.barriers?.some(rect=>segmentIntersects(a,b,rect));
}

export function worldVisible(a:Motion,b:Motion,radius=VISION_RADIUS) {
  return Math.hypot(a.x-b.x,a.y-b.y)<radius && !obstacleBetween(a,b);
}

export function characterVisible(a:Motion,b:Motion,radius=VISION_RADIUS) {
  return Math.hypot(a.x-b.x,a.y-b.y)<radius && !wallBetween(a,b);
}

export function localPerception(a: Motion, b: Motion, vision=VISION_RADIUS) {
  const distance = Math.hypot(a.x-b.x,a.y-b.y);
  if (distance>=Math.max(vision,HEARING_RADIUS)) return {visible:false,volume:0};
  const wall = wallBetween(a,b);
  return {
    visible:distance<vision && !wall,
    volume:Math.round(20 * Math.max(0,Math.min(1,(HEARING_RADIUS-distance)/85)) * (wall ? .2 : 1))/20,
  };
}

export function roomAt({x,y}:Motion) {
  return rooms.find(({bounds:[left,top,width,height]})=>
    x>=left && x<left+width && y>=top && y<top+height)?.name ?? 'Corredor';
}
