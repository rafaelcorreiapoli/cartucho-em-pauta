import {canActOnFire,fireRules,fireSites,type FireOption,type FireView} from '../src/fire';
import type {Player} from '../src/map';

type Installation = {
  actor:string; site:number; item:number; started:number; x:number; y:number;
  hit:Player['hit']; swing:Player['swing'];
};

export class Fire {
  private active = new Map<number,{elapsed:number;losses:number}>();
  private installations = new Map<string,Installation>();
  private armed = new Map<number,{actor:string;ignites:number}>();
  private next:number = fireRules.firstAfter;
  private nextSite?:number;
  private random = Math.random;
  private clock = 0;
  private last = 0;
  private delay = 0;
  private fundedDelay = 0;

  reset(now:number,random=Math.random) {
    this.active.clear();
    this.installations.clear();
    this.armed.clear();
    this.next = fireRules.firstAfter;
    this.nextSite = undefined;
    this.random = random;
    this.clock = 0;
    this.last = now;
    this.delay = this.fundedDelay = 0;
  }

  startTraining(site:number) { this.active.set(site,{elapsed:0,losses:0}); }

  get burning() { return this.active.size>0; }
  get installers() { return [...this.installations.keys()]; }
  get smoke() {
    return [...this.armed].filter(([,device])=>device.ignites+this.fundedDelay-this.clock<=fireRules.smoke).map(([site])=>site);
  }

  handlingSite(actor:string) { return this.installations.get(actor)?.site; }

  progress(actor:string,now:number) {
    const job = this.installations.get(actor);
    return job ? Math.min(1,(now-job.started)/fireRules.install) : undefined;
  }

  private occupied(site:number) {
    return this.active.has(site) || this.armed.has(site) || [...this.installations.values()].some(job=>job.site===site);
  }

  option(player:Player,hasDevice:boolean,hasExtinguisher:boolean):FireOption|undefined {
    if (hasExtinguisher) {
      const site = [...this.active.keys()].find(site=>canActOnFire(player,site));
      if (site!==undefined) return {kind:'extinguish',site,label:'Apagar incêndio'};
    }
    const smoke = this.smoke.find(site=>canActOnFire(player,site));
    if (smoke!==undefined) return {kind:'disarm',site:smoke,label:'Desarmar dispositivo'};
    if (!hasDevice || this.installations.has(player.id)) return;
    const site = fireSites.findIndex((_,index)=>!this.occupied(index) && canActOnFire(player,index));
    if (site!==-1) return {kind:'plant',site,label:`Instalar incendiário · ${fireSites[site].object}`};
  }

  plant(player:Player,site:number,item:number,now:number) {
    if (this.occupied(site) || this.installations.has(player.id) || player.moving || !canActOnFire(player,site)) return false;
    const {id:actor,x,y,hit,swing} = player;
    this.installations.set(actor,{actor,site,item,started:now,x,y,hit,swing});
    return true;
  }

  updateInstallation(actor:string,player:Player|undefined, now:number,
    owns:(actor:string,item:number)=>boolean, consume:(actor:string,item:number)=>boolean,
    reject = (message:string)=>message) {
    const job = this.installations.get(actor);
    if (!job) return;
    if (!player || player.id!==job.actor || player.moving || player.x!==job.x || player.y!==job.y ||
        player.hit!==job.hit || player.swing!==job.swing || !canActOnFire(player,job.site) || !owns(job.actor,job.item)) {
      this.installations.delete(actor);
      return reject('Instalação interrompida.');
    }
    if (now<job.started+fireRules.install) return;
    this.installations.delete(actor);
    if (!consume(job.actor,job.item)) return reject('Instalação interrompida.');
    this.armed.set(job.site,{actor:job.actor,ignites:this.clock+fireRules.fuse});
    return 'Incendiário instalado.';
  }

  disarm(site:number) {
    if (!this.smoke.includes(site)) return false;
    this.armed.delete(site);
    this.next = Math.max(this.next,this.clock+fireRules.fuse);
    return true;
  }

  extinguish(site:number) {
    if (!this.active.delete(site)) return false;
    if (!this.burning) {
      this.next = this.clock+fireRules.cooldown+this.delay;
      this.nextSite = (site+1)%fireSites.length;
    }
    return true;
  }

  delayNextFire(duration:number) { this.fundedDelay += duration; }

  increaseSafety() {
    if (this.delay) return;
    this.delay = fireRules.safetyDelay;
    this.next += this.delay;
  }

  advance(now:number, exploring:boolean, onIgnition?:(actor:string,site:number)=>void) {
    const elapsed = Math.max(0,now-this.last);
    this.last = now;
    if (!exploring) return 0;
    this.clock += elapsed;
    let damage = 0;
    for (const [site,active] of this.active) {
      active.elapsed = Math.min(fireRules.duration,active.elapsed+elapsed);
      const losses = Math.floor(active.elapsed/fireRules.tick);
      damage += (losses-active.losses)*fireRules.damage;
      active.losses = losses;
      if (active.elapsed>=fireRules.duration) this.extinguish(site);
    }
    let ignited = false;
    for (const [site,device] of this.armed) {
      if (this.clock<device.ignites+this.fundedDelay) continue;
      this.active.set(site,{elapsed:0,losses:0});
      this.armed.delete(site);
      onIgnition?.(device.actor,site);
      ignited = true;
    }
    if (!this.burning && !this.armed.size && !this.installations.size && this.clock>=this.next+this.fundedDelay) {
      const site = this.nextSite ?? Math.floor(this.random()*fireSites.length);
      this.active.set(site,{elapsed:0,losses:0});
      ignited = true;
    }
    if (ignited && !this.armed.size) this.fundedDelay = 0;
    return damage;
  }

  view(exploring:boolean):FireView[]|undefined {
    if (!this.active.size) return;
    return [...this.active].map(([site,active])=>({site,remaining:Math.ceil((fireRules.duration-active.elapsed)/1000),
      damage:fireRules.damage,paused:!exploring}));
  }
}
