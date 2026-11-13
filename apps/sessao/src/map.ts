import { eastAnnex, officeFixtures, privateOffices } from './private-offices';
import type { WeaponSwing } from './weapons';
import { carrySpeedFactor, infirmary } from './medical';
import { mapNpcs, snackBar } from './npcs';

export const WIDTH = 1136;
export const HEIGHT = 759;
export const SPEED = 88;
export const NAMES = ['Lula', 'Bolsonaro', 'Trump', 'Tiririca', 'José Sarney', 'Jean Wyllys', 'Sergio Moro', 'Nestor Cerveró'] as const;
export type Rect = readonly [x: number, y: number, width: number, height: number];

export const PLENARY_BOUNDS = [268,541,424,208] as const;
export const PLENARY_DOORS:Rect[] = [[284,530,26,11],[450,530,60,11],[638,530,28,11]];
export const PLENARY_SEATS = [655,710].flatMap(y => [324,386,448,512,574,636].map(x => ({x,y})));

export const walls: Rect[] = [
  [0,0,960,10], [0,10,10,520], [950,10,10,eastAnnex.opening[0]-10], [950,eastAnnex.opening[1],10,530-eastAnnex.opening[1]],
  [0,530,65,11], [194,530,90,11], [310,530,140,11], [510,530,128,11], [666,530,100,11], [895,530,65,11],
  [258,541,10,218], [692,541,10,218], [268,749,424,10],
  [470,10,10,115], [470,161,10,98],
  [10,259,211,11], [261,259,397,11], [702,259,snackBar.door[0]-702,11], [897,259,53,11],
  [480,114,65,11], [586,114,235,11], [864,114,86,11],
  [703,10,10,104], [703,161,10,98],
  [480,161,70,11], [591,161,194,11], [827,161,123,11],
  [10,392,105,11], [156,392,244,11], [446,392,334,11], [825,392,125,11],
  [814,270,10,133],
  [316,270,10,65], [316,374,10,18], [592,270,10,65], [592,374,10,18],
  [316,403,10,65], [316,507,10,23], [592,403,10,65], [592,507,10,23],
  [eastAnnex.left,eastAnnex.top-10,eastAnnex.right-eastAnnex.left+10,10],
  [eastAnnex.right,eastAnnex.top,10,eastAnnex.bottom-eastAnnex.top],
  [eastAnnex.left,eastAnnex.bottom,eastAnnex.right-eastAnnex.left+10,11],
  [139,10,9,115], [332,10,9,115],
  [139,114,38,11], [203,114,14,11], [263,114,14,11], [303,114,38,11],
  [187,161,9,98], [282,161,9,98],
  [10,161,59,11], [105,161,113,11], [262,161,79,11],
  ...privateOffices.flatMap(({bounds:[x,y,w,h],door:[dx,dy,dw,dh],inside,shared}):Rect[]=>[
    ...(shared.has('west') ? [] : [[x-6,y,6,h] as Rect]),
    ...(shared.has('east') ? [] : [[x+w,y,6,h] as Rect]),
    [x,dy,dx-x,dh],[dx+dw,dy,x+w-dx-dw,dh],
    ...(shared.has('back') ? [] : [[x-6,inside===1 ? y+h : y-10,w+12,10] as Rect]),
  ]),
];
export const desks = [
  [151,43],[284,43],[151,84],[284,84],[63,217],
  [526,60],[786,59],[851,210],[105,334],[404,331],[766,330],
  [128,460],[354,430],[433,460],[713,460],[822,463],
  [274,614],[274,677],[643,614],[643,677],
  ...Object.values(mapNpcs).map(({counter:{x,y}})=>[x,y] as const),
] as const;
export const furnishings = [
  {frame:0, area:[197,33,86,29], footprint:10},
  {frame:0, area:[414,570,132,38], footprint:12},
  {frame:1, area:[559,598,22,18], footprint:7},
  {frame:3, area:[279,554,30,40], footprint:9},
  {frame:3, area:[651,554,30,40], footprint:9},
  {frame:3, area:[301,28,22,28], footprint:7},
  {frame:4, area:[18,192,25,30], footprint:10},
  {frame:5, area:[239,208,16,33], footprint:10},
  {frame:4, area:[651,36,30,37], footprint:10},
  {frame:4, area:[896,29,32,39], footprint:10},
  {frame:3, area:[922,210,22,31], footprint:9},
  {frame:4, area:[31,300,28,37], footprint:10},
  {frame:4, area:[513,298,28,37], footprint:10},
  {frame:0, area:[706,437,183,29], footprint:10},
  {frame:3, area:[34,480,30,38], footprint:9},
  {frame:3, area:[541,485,26,34], footprint:9},
] satisfies {frame:number; area:Rect; footprint:number}[];
const obstacles = [
  ...walls,
  ...privateOffices.flatMap(office=>(['safe','cabinet'] as const).map((kind):Rect=>{
    const {x,y} = office[kind];
    const {width,footOffset} = officeFixtures[kind];
    return [x-width/2,y-footOffset-5,width,5];
  })),
  ...Object.values(mapNpcs).map(({x,y}):Rect => [x-5,y-5,10,5]),
  ...desks.map(([x,y]):Rect => [x,y+2,45,18]),
  ...furnishings.map(({area:[x,y,width,height],footprint}):Rect =>
    [x,y+height-footprint,width,footprint]),
];

export type MovementModifier = {factor:number; remainingMs:number};
export type Player = Motion & { id: string; nick: string; npc?:true; former?:boolean; character: number; direction: number; moving: boolean; pocketing?:boolean; speed?:number; speedModifier?:MovementModifier; staminaRegenModifier?:MovementModifier; stamina?:number; staminaMax?:number; canSprint?:true; hpBonus?:number; attackBonus?:number; defenseBonus?:number; sprinting?:true; knockedOut?:boolean; carrying?:true; carried?:true; swing?:WeaponSwing; hit?:number; health?:number; phone?:'call'|'game'; exposed?:import('./gameplay').ExposedItem[] };
export type Motion = { x: number; y: number; barriers?:readonly Rect[] };
export const idle = { x: 0, y: 0 };

export function blockedBy(rect:Rect,x:number,y:number) {
  const [left,top,width,height] = rect;
  const epsilon = 1e-6;
  return x+6>left+epsilon && x-6<left+width-epsilon && y>top+epsilon && y-7<top+height-epsilon;
}

export function canStand(x: number, y: number) {
  if (x<6 || x>WIDTH-6 || y<7 || y>HEIGHT || (x>=eastAnnex.left && (x>eastAnnex.right || y<eastAnnex.top || y>eastAnnex.bottom))) return false;
  if (y>541 && (x<274 || x>686) && !privateOffices.some(({bounds:[left,top,width,height]})=>top>=541 && x>=left && x<=left+width && y<=top+height)) return false;
  return obstacles.every(rect=>!blockedBy(rect,x,y));
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
  return (player.speed ?? SPEED)*(player.speedModifier?.factor ?? 1)*(player.carrying ? carrySpeedFactor : player.sprinting ? sprintMultiplier : 1);
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

export function localPerception(a: Motion, b: Motion, vision=VISION_RADIUS) {
  const distance = Math.hypot(a.x-b.x,a.y-b.y);
  if (distance>=Math.max(vision,HEARING_RADIUS)) return {visible:false,volume:0};
  const wall = wallBetween(a,b);
  return {
    visible:distance<vision && !wall,
    volume:Math.round(20 * Math.max(0,Math.min(1,(HEARING_RADIUS-distance)/85)) * (wall ? .2 : 1))/20,
  };
}

export const rooms = [
  ...privateOffices.map(({name,bounds})=>({name,bounds,color:0xa88d68})),
  {name:'Antecâmara', bounds:[148,10,184,104], color:0x3e6154},
  {name:'Plenário', bounds:PLENARY_BOUNDS, color:0x3e6154},
  {name:'Secretaria', bounds:[10,172,177,87], color:0x858c80},
  {name:'Cafezinho', bounds:[196,172,86,87], color:0xb09d80},
  {name:'Arquivo', bounds:[480,10,223,104], color:0x81897a},
  {name:'Controladoria', bounds:[713,10,237,104], color:0x527473},
  {name:'Apoio Técnico', bounds:[480,172,223,87], color:0x777d75},
  {name:'Sala de Imprensa', bounds:[713,172,237,87], color:0xa58b66},
  {name:'Protocolo', bounds:[10,270,306,122], color:0x858c80},
  {name:'Biblioteca', bounds:[326,270,266,122], color:0x9b8161},
  {name:'Comissões', bounds:[602,270,212,122], color:0x637b69},
  {name:snackBar.name,bounds:snackBar.bounds,color:0xb6a781},
  {name:'Credenciamento', bounds:[10,403,306,127], color:0x8c846d},
  {name:'Hall das Bancadas', bounds:[326,403,266,127], color:0x7c8a7e},
  {name:'Galeria', bounds:[602,403,280,127], color:0x56736e},
  {name:infirmary.name,bounds:infirmary.bounds,color:0x8baea7},
] satisfies {name:string; bounds:Rect; color:number}[];

export function roomAt({x,y}:Motion) {
  return rooms.find(({bounds:[left,top,width,height]})=>
    x>=left && x<left+width && y>=top && y<top+height)?.name ?? 'Corredor';
}
