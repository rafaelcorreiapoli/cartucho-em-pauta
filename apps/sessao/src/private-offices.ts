import type { Motion, Rect } from './map';

import { circulationBounds, mapDoor, mapPoint, roomBounds } from './congress-layout';

const [left,top,width,height] = circulationBounds('Anexo leste');
export const eastAnnex = {left,right:left+width,top,bottom:top+height};

export const privateOffices = Array.from({length:6},(_,index)=>{
  const id = String(index+1);
  const name = `Gabinete ${id.padStart(2,'0')}`;
  const bounds = roomBounds(name);
  const door = mapDoor(name);
  const [x,y,width,height] = door;
  const vertical = height>width;
  const inside = vertical ? {x:Math.sign(bounds[0]-x),y:0} : {x:0,y:Math.sign(bounds[1]-y)};
  return {
    id,name,bounds,door,inside,
    spawn:mapPoint(`${name}: entrada`),safe:mapPoint(`${name}: cofre`),cabinet:mapPoint(`${name}: armário`),
  };
});
export const officeFixtures = {
  safe:{texture:'office-safe',openTexture:'office-safe-open',width:19,height:24,footOffset:8,openWidth:33.25,openOriginX:84/280},
  cabinet:{texture:'office-cabinet',width:21,height:33,footOffset:8},
} as const;
export type OfficeLayout = typeof privateOffices[number];

export function depositingAtSafe(office:OfficeLayout,people:readonly (Motion & {pocketing?:boolean})[]) {
  return people.some(person=>person.pocketing && Math.hypot(person.x-office.safe.x,person.y-office.safe.y)<=17);
}

export const officeRules = {
  safeLootFraction:1, cashMs:5000, reinforceMs:5000, stashSlots:4, maxSecurity:5, breachMs:30_000, breachTimes:[15_000,9000,5000],
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
  safeTrap:{name:'Seguro Antiarrombamento',description:'Instale no seu cofre. Ao concluir um arrombamento, explode, zera a vida do invasor e impede o saque. Uso único; avisa o titular.',portrait:'retrato-seguro-antiarrombamento.webp',price:3},
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
  officeRug:{x:64.5,y:59},
  portrait:{x:64.5,y:19},
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
  'office-trap-safe'|'office-install'|'office-remove'|'office-cancel';
export const officeActions:readonly OfficeAction[] = [
  'office-open','office-close','office-lock','office-unlock','office-cash','office-breach-safe','office-upgrade-safe','office-stash','office-take',
  'office-breach-door','office-breach-cabinet','office-upgrade-door','office-upgrade-cabinet','office-trap-safe','office-install','office-remove','office-cancel',
];
export type OfficeOption = {label:string; kind:OfficeAction; place?:string; item?:number};
export function officeDoorPoint({door:[x,y,w,h],inside}:OfficeLayout, offset=0) {
  return {x:x+w/2+inside.x*offset,y:y+h/2+inside.y*offset};
}
