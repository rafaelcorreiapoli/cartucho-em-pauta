import { infirmary } from './medical';
import type { PhotoScene } from './photography';
import { privateOffices } from './private-offices';
import { obstacleBetween, securityRoom, type Motion } from './map';

export const spyProducts = {
  wiretap:{name:'Grampo',price:2,portrait:'retrato-grampo.webp',description:'Escuta remota ao redor de um esconderijo.'},
  spyCamera:{name:'Câmera escondida',price:3,portrait:'retrato-camera-escondida.webp',description:'Vigilância remota em um esconderijo.'},
  bugDetector:{name:'Detector de Escutas',price:2,portrait:'retrato-detector-escutas.webp',description:'Inspeciona esconderijos sem ser consumido.'},
} as const;
export type SpyProduct = keyof typeof spyProducts;
export type SpyDevice = Exclude<SpyProduct,'bugDetector'>;
export const isSpyProduct = (kind:unknown):kind is SpyProduct => typeof kind==='string' && Object.hasOwn(spyProducts,kind);
export const spyRules = {install:5000,inspect:3000,remove:3000,recover:3000,range:70,reach:19,limit:2,sample:250,hold:1400} as const;
const both = ['wiretap','spyCamera'] as const;
export const hideouts = [
  {id:'coffee',name:'Cafeteira',room:'Cafezinho',x:247,y:243,accepts:both},
  {id:'press',name:'Vaso',room:'Sala de Imprensa',x:933,y:244,accepts:both},
  {id:'security-terminal',name:'Terminal',room:securityRoom.name,...securityRoom.terminal,y:securityRoom.terminal.y+2,accepts:both},
  {id:'meeting',name:'Maca',room:infirmary.name,...infirmary.stretcher,accepts:['wiretap'] as readonly SpyDevice[]},
  {id:'library',name:'Estante',room:'Biblioteca',x:433,y:465,accepts:both},
  ...privateOffices.map(office=>({id:'office-'+office.id,name:'Armário',room:office.name,...office.cabinet,accepts:both})),
];
export type Hideout = typeof hideouts[number];

export function cameraSees(origin:Motion,subject:Motion) {
  return Math.hypot(subject.x-origin.x,subject.y-origin.y)<=spyRules.range && !obstacleBetween(origin,subject);
}
export type SpyChannel = {id:number; name:string; room:string; kind:SpyDevice; active:boolean; removed:boolean; alerts:boolean};
export type SpyOption = {label:string; kind:'install'|'inspect'|'remove'|'recover'|'keep'|'cancel'; site?:string; item?:number; blocked?:string};
export type SpyCommand = SpyOption
  | {kind:'close'}
  | {kind:'open'|'close-channel'|'mute'|'alerts'|'capture';channel:number}
  | {kind:'rename';channel:number;name:string};
export type SpyView = {channels:SpyChannel[]; options:SpyOption[]; selected?:number; audio?:number; muted:boolean; progress?:number};

export type SpyCameraFrame = PhotoScene & {channel:number};

export function acceptsSpyCameraFrame(view:SpyView|undefined,frame:SpyCameraFrame) {
  const channel = monitoredChannel(view);
  return channel?.kind==='spyCamera' && channel.id===frame.channel;
}

export function monitoredChannel(view?:SpyView) {
  return view?.channels.find(channel=>!channel.removed &&
    channel.id===(channel.kind==='wiretap' ? view.audio : view.selected));
}
