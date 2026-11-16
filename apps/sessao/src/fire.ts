import {canInteract,type InteractionActor} from './interactions';

export const fireRules = {
  duration:36_000,
  tick:6000,
  damage:2,
  firstAfter:90_000,
  cooldown:120_000,
  safetyDelay:60_000,
  radius:22,
} as const;
export const fireSites = [
  {name:'Cafezinho',x:232,y:237,extinguisher:{x:271,y:241}},
  {name:'Biblioteca',x:491,y:357,extinguisher:{x:453,y:358}},
] as const;

export type FireAction = 'ignite'|'extinguish';
export type FireView = {site:number; remaining:number; damage:number; paused:boolean};

export function canActOnFire(player:InteractionActor, site:number) {
  const location = fireSites[site];
  return !!location && canInteract(player,location,{radius:fireRules.radius,handsFree:true});
}

export function fireOptions(player:InteractionActor, current:FireView|undefined, sabotageSite:number|undefined, hasExtinguisher:boolean) {
  if (current && !current.paused && hasExtinguisher && canActOnFire(player,current.site)) {
    return {kind:'extinguish',site:current.site,label:'Apagar incêndio'} as const;
  }
  if (!current && sabotageSite!==undefined && canActOnFire(player,sabotageSite)) {
    return {kind:'ignite',site:sabotageSite,label:'Provocar incêndio'} as const;
  }
}
