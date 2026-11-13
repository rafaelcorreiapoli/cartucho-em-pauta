import { privateOffices } from './private-offices';
import { obstacleBetween, type Motion } from './map';

export const spyProducts = {
  wiretap:{name:'Grampo',price:2,portrait:'retrato-modulador.webp',description:'Escuta remota ao redor de um esconderijo.'},
  spyCamera:{name:'Câmera escondida',price:3,portrait:'retrato-fotografia.webp',description:'Vigilância remota em um esconderijo.'},
  bugDetector:{name:'Detector de Escutas',price:2,portrait:'retrato-binoculo.webp',description:'Inspeciona esconderijos sem ser consumido.'},
} as const;
export type SpyProduct = keyof typeof spyProducts;
export type SpyDevice = Exclude<SpyProduct,'bugDetector'>;
export const isSpyProduct = (kind:unknown):kind is SpyProduct => typeof kind==='string' && Object.hasOwn(spyProducts,kind);
export const spyRules = {install:5000,inspect:3000,remove:3000,recover:3000,range:70,reach:19,limit:2,sample:250,hold:1400} as const;
const both = ['wiretap','spyCamera'] as const;
export const hideouts = [
  {id:'coffee',name:'Cafeteira',room:'Cafezinho',x:247,y:243,accepts:both},
  {id:'press',name:'Vaso',room:'Sala de Imprensa',x:933,y:244,accepts:both},
  {id:'committee',name:'Mesa',room:'Comissões',x:788,y:352,accepts:both},
  {id:'meeting',name:'Mesa',room:'Antecâmara',x:307,y:66,accepts:['wiretap'] as readonly SpyDevice[]},
  {id:'library',name:'Estante',room:'Biblioteca',x:527,y:337,accepts:both},
  ...privateOffices.map(office=>({id:'office-'+office.id,name:'Armário',room:office.name,...office.cabinet,accepts:both})),
];
export type Hideout = typeof hideouts[number];

export function cameraSees(origin:Motion,subject:Motion) {
  return Math.hypot(subject.x-origin.x,subject.y-origin.y)<=spyRules.range && !obstacleBetween(origin,subject);
}
export type SpyChannel = {id:number; name:string; room:string; kind:SpyDevice; active:boolean; removed:boolean; alerts:boolean};
export type SpyOption = {label:string; kind:'install'|'inspect'|'remove'|'recover'|'keep'|'cancel'; site?:string; item?:number};
export type SpyView = {channels:SpyChannel[]; options:SpyOption[]; selected?:number; audio?:number; muted:boolean; progress?:number};
