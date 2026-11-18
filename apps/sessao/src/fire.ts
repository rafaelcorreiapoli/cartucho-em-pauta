import {canInteract,type InteractionActor} from './interactions';
import {furnishings,roomAt,rooms,securityRoom} from './map';
import {infirmary} from './medical';
import {privateOffices} from './private-offices';

export const fireRules = {
  duration:36_000,
  tick:6000,
  damage:2,
  firstAfter:90_000,
  cooldown:120_000,
  safetyDelay:60_000,
  radius:22,
  install:3000,
  fuse:15_000,
  smoke:5000,
  popularityReward:3,
} as const;

export const incendiary = {
  name:'Incendiário',
  price:3,
  portrait:'retrato-incendiario.webp',
  description:`Instale em um móvel ou vaso. O dispositivo acende após ${fireRules.fuse/1000} segundos e só pode ser usado uma vez.`,
} as const;

export const extinguisherSpawns = [{x:271,y:241},{x:453,y:358}] as const;

const pots = furnishings.filter(prop=>'fireTarget' in prop).map(({area:[x,y,w,h]})=>({
  x:x+w/2,y:y+h,object:'Vaso de planta',
}));

const targets = [
  ...pots,
  {x:527,y:335,object:'Estante'},
  {...infirmary.stretcher,object:'Maca'},
  {x:570,y:616,object:'Tribuna'},
  {x:30.5,y:222,object:'Armário'},
  {x:666,y:73,object:'Armário'},
  {x:912,y:68,object:'Armário'},
  {x:673,y:204,object:'Estante'},
  {x:933,y:241,object:'Vaso'},
  {x:45,y:337,object:'Armário'},
  {...securityRoom.terminal,object:'Terminal'},
  {x:879.5,y:348,object:'Balcão'},
  {x:49,y:518,object:'Vaso'},
  {x:402,y:476,object:'Balcão'},
  {x:554,y:519,object:'Vaso'},
  {x:735,y:480,object:'Mesa'},
  ...privateOffices.map(({cabinet})=>({...cabinet,object:'Armário'})),
];

export const fireSites = targets.map(target=>{
  const name = roomAt(target);
  return {...target,name,bounds:rooms.find(room=>room.name===name)!.bounds};
});

export type FireAction = 'plant'|'disarm'|'extinguish';
export type FireCommand = {kind:FireAction;site:number};
export type FireOption = FireCommand & {label:string};
export type ExtinguishEffect = {site:number; from?:{x:number;y:number}};
export type FireExtinguished = {actor:string; room:string; effect?:ExtinguishEffect};
export type FireView = {site:number; remaining:number; damage:number; paused:boolean};
export type FireInteraction = {option?:FireOption; smoke?:number; progress?:number};

export function canActOnFire(player:InteractionActor & {carried?:boolean}, site:number) {
  const location = fireSites[site];
  return !!location && !player.carried && roomAt(player)===location.name &&
    canInteract(player,location,{radius:fireRules.radius,handsFree:true});
}
