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
  {x:960,y:27,inside:-1,shared:['west','east','back']},
] as const satisfies readonly {x:number;y:number;inside:1|-1;shared:readonly SharedWall[]}[];

export const eastAnnex = {left:960,right:1089,top:27,bottom:161,opening:[125,161]} as const;

export const privateOffices = locations.map(({x,y,inside,shared},index)=>{
  const center = x+64.5;
  return {
    id:String(index+1),name:`Gabinete ${String(index+1).padStart(2,'0')}`,
    bounds:[x,y,officeWidth,officeHeight] as Rect,
    door:[center-doorWidth/2,inside===1 ? y-doorHeight : y+officeHeight,doorWidth,doorHeight] as Rect,
    inside,shared:new Set<SharedWall>(shared),spawn:{x:center,y:y+58},
    safe:{x:x+22,y:y+42},cabinet:{x:x+107,y:y+42},
  };
});
export const officeFixtures = {
  safe:{texture:'office-safe',width:19,height:24,footOffset:8},
  cabinet:{texture:'office-cabinet',width:21,height:33,footOffset:8},
} as const;
export type OfficeLayout = typeof privateOffices[number];

export const officeRules = {
  safeLootFraction:1, cashMs:5000, stashSlots:4, maxSecurity:5, breachMs:30_000, breachTimes:[15_000,9000,5000],
} as const;

function lockTool(name:string, portrait:string, price:number, attack:number) {
  return {name,portrait,price,attack,description:`Arrombamento nível ${attack}.`};
}

export const officeGoods = {
  lockpick:lockTool('Gazua improvisada','retrato-gazua.webp',1,1),
  lockKit:lockTool('Kit de arrombamento','retrato-kit-arrombamento.webp',2,2),
  proLockKit:lockTool('Kit profissional','retrato-kit-profissional.webp',3,3),
  decoder:lockTool('Decodificador','retrato-decodificador.webp',4,4),
  masterDecoder:lockTool('Ferramenta especializada','retrato-ferramenta-especializada.webp',5,5),
  doorLock:{name:'Reforço de porta',description:'Aumenta a segurança da porta em um nível.',portrait:'retrato-fechadura.webp',price:2},
  cabinetLock:{name:'Reforço de armário',description:'Aumenta a segurança do armário em um nível.',portrait:'retrato-fechadura-armario.webp',price:2},
  officeTv:{name:'TV de 85 polegadas',description:'Instalação no seu gabinete incluída.',portrait:'retrato-tv.webp',price:3},
  officeRug:{name:'Tapete persa',description:'Instalação no seu gabinete incluída.',portrait:'retrato-tapete.webp',price:2},
  officeChair:{name:'Poltrona de couro',description:'Instalação no seu gabinete incluída.',portrait:'retrato-poltrona.webp',price:2},
} as const;
export type OfficeGood = keyof typeof officeGoods;
export const officeFurniture = {
  officeChair:{sprite:'gabinete-poltrona.webp',width:28,height:26,anchor:.8},
  officeRug:{sprite:'gabinete-tapete.webp',width:48,height:16,anchor:.5},
  officeTv:{sprite:'gabinete-tv.webp',width:32,height:23,anchor:.83},
} as const;
export type OfficeFurniture = keyof typeof officeFurniture;
export const decorSlots = ['officeTv','officeRug','officeChair','portrait'] as const;
export type OfficeDecor = typeof decorSlots[number];
const decorOffsets:Record<OfficeDecor,Motion> = {
  officeTv:{x:23,y:76},
  officeChair:{x:106,y:76},
  officeRug:{x:officeWidth/2,y:59},
  portrait:{x:officeWidth/2,y:19},
};

export function decorPoint({bounds:[x,y]}:OfficeLayout, kind:OfficeDecor):Motion {
  const offset = decorOffsets[kind];
  return {x:x+offset.x,y:y+offset.y};
}
export const isOfficeFurniture = (kind:string):kind is OfficeFurniture => Object.hasOwn(officeFurniture,kind);

export const officeGoodKinds = Object.keys(officeGoods) as OfficeGood[];
export const isOfficeGood = (kind:unknown):kind is OfficeGood => typeof kind==='string' && Object.hasOwn(officeGoods,kind);

export type OfficeDoorState = 'open'|'closed'|'locked'|'breached';
export type OfficeView = {id:string; owner?:string; door:OfficeDoorState; cabinetBreached?:true};
export type OfficeAction = 'office-open'|'office-close'|'office-lock'|'office-unlock'|'office-cash'|'office-breach-safe'|'office-upgrade-safe'|
  'office-stash'|'office-take'|'office-breach-door'|'office-breach-cabinet'|'office-upgrade-door'|'office-upgrade-cabinet'|
  'office-install'|'office-remove'|'office-cancel';
export const officeActions:readonly OfficeAction[] = [
  'office-open','office-close','office-lock','office-unlock','office-cash','office-breach-safe','office-upgrade-safe','office-stash','office-take',
  'office-breach-door','office-breach-cabinet','office-upgrade-door','office-upgrade-cabinet','office-install','office-remove','office-cancel',
];
export type OfficeOption = {label:string; kind:OfficeAction; place?:string; item?:number};
export const officeDoorPoint = ({door:[x,y,w,h]}:OfficeLayout) => ({x:x+w/2,y:y+h/2});
