import type { Motion, Rect } from './map';

const officeWidth = 129;
const officeHeight = 87;
const doorWidth = 36;
const doorHeight = 11;
// Offices that touch an existing divider use its inner edge as their boundary.
type SharedWall = 'west'|'east'|'back';
const locations = [
  {x:10,y:10,inside:-1,shared:['west','east','back']},
  {x:341,y:10,inside:-1,shared:['west','east','back']},
  {x:341,y:172,inside:1,shared:['east','back']},
  {x:65,y:541,inside:1,shared:[]},
  {x:766,y:541,inside:1,shared:[]},
  {x:997,y:20,inside:-1,shared:['east','back']},
] as const satisfies readonly {x:number;y:number;inside:1|-1;shared:readonly SharedWall[]}[];

export const eastAnnex = {left:960,top:20,bottom:164,opening:[125,164]} as const;

export const privateOffices = locations.map(({x,y,inside,shared},index)=>{
  const center = x+64.5;
  return {
    id:String(index+1),name:`Gabinete ${String(index+1).padStart(2,'0')}`,
    bounds:[x,y,officeWidth,officeHeight] as Rect,
    door:[center-doorWidth/2,inside===1 ? y-doorHeight : y+officeHeight,doorWidth,doorHeight] as Rect,
    inside,shared:new Set<SharedWall>(shared),spawn:{x:center,y:y+58},
    safe:{x:x+22,y:y+42},cabinet:{x:x+107,y:y+42},decor:{x:center,y:y+57},
  };
});
export const officeFixtures = {
  safe:{texture:'office-safe',width:19,height:24,footOffset:8},
  cabinet:{texture:'office-cabinet',width:21,height:33,footOffset:8},
} as const;
export type OfficeLayout = typeof privateOffices[number];

export const officeRules = {
  cashMs:5000, stashSlots:4, maxSecurity:5, breachMs:30_000, breachTimes:[15_000,9000,5000],
} as const;

export const officeGoods = {
  lockpick:{name:'Gazua improvisada',description:'Arrombamento nível 1.',portrait:'retrato-gazua.webp',price:1,attack:1},
  lockKit:{name:'Kit de arrombamento',description:'Arrombamento nível 2.',portrait:'retrato-gazua.webp',price:2,attack:2},
  proLockKit:{name:'Kit profissional',description:'Arrombamento nível 3.',portrait:'retrato-gazua.webp',price:3,attack:3},
  decoder:{name:'Decodificador',description:'Arrombamento nível 4.',portrait:'retrato-gazua.webp',price:4,attack:4},
  masterDecoder:{name:'Ferramenta especializada',description:'Arrombamento nível 5.',portrait:'retrato-gazua.webp',price:5,attack:5},
  doorLock:{name:'Reforço de porta',description:'Aumenta a segurança da porta em um nível.',portrait:'retrato-fechadura.webp',price:2},
  cabinetLock:{name:'Reforço de armário',description:'Aumenta a segurança do armário em um nível.',portrait:'retrato-fechadura.webp',price:2},
  officeTv:{name:'TV de 85 polegadas',description:'Instale no seu gabinete.',portrait:'retrato-tv.webp',price:3},
  officeRug:{name:'Tapete persa',description:'Instale no seu gabinete.',portrait:'retrato-tapete.webp',price:2},
  officeChair:{name:'Poltrona de couro',description:'Instale no seu gabinete.',portrait:'retrato-poltrona.webp',price:2},
} as const;
export type OfficeGood = keyof typeof officeGoods;
export const officeFurniture = {
  officeChair:{sprite:'gabinete-poltrona.webp',width:32,height:30,anchor:.8},
  officeRug:{sprite:'gabinete-tapete.webp',width:43,height:25,anchor:.5},
  officeTv:{sprite:'gabinete-tv.webp',width:37,height:26,anchor:.83},
} as const;
export type OfficeFurniture = keyof typeof officeFurniture;
export const decorSlots = ['officeTv','officeRug','officeChair','portrait'] as const;
export type OfficeDecor = typeof decorSlots[number];
export function decorPoint(layout:OfficeLayout, kind:OfficeDecor):Motion {
  const {x,y} = layout.decor;
  if (kind==='officeRug') return {x,y};
  if (kind==='officeTv') return {x:x-23,y:y-26};
  if (kind==='officeChair') return {x:x+23,y:y-26};
  return {x,y:Math.max(layout.bounds[1]+9,y-22)};
}
export const isOfficeFurniture = (kind:string):kind is OfficeFurniture => Object.hasOwn(officeFurniture,kind);

export const officeGoodKinds = Object.keys(officeGoods) as OfficeGood[];
export const isOfficeGood = (kind:unknown):kind is OfficeGood => typeof kind==='string' && Object.hasOwn(officeGoods,kind);

export type OfficeDoorState = 'open'|'closed'|'locked'|'breached';
export type OfficeView = {id:string; owner?:string; door:OfficeDoorState; cabinetBreached?:true};
export type OfficeAction = 'office-open'|'office-close'|'office-lock'|'office-unlock'|'office-cash'|
  'office-stash'|'office-take'|'office-breach-door'|'office-breach-cabinet'|'office-upgrade-door'|'office-upgrade-cabinet'|
  'office-install'|'office-remove'|'office-cancel';
export const officeActions:readonly OfficeAction[] = [
  'office-open','office-close','office-lock','office-unlock','office-cash','office-stash','office-take',
  'office-breach-door','office-breach-cabinet','office-upgrade-door','office-upgrade-cabinet','office-install','office-remove','office-cancel',
];
export type OfficeOption = {label:string; kind:OfficeAction; place?:string; item?:number};
export const officeDoorPoint = ({door:[x,y,w,h]}:OfficeLayout) => ({x:x+w/2,y:y+h/2});
