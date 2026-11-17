import {canActOnFire,fireRules,fireSites,type FireOption,type FireView} from '../src/fire';
import type {Player} from '../src/map';

type Installation = {
  actor:string; site:number; item:number; started:number; x:number; y:number;
  hit:Player['hit']; swing:Player['swing'];
};

export class Fire {
  private active?: {site:number; elapsed:number; losses:number};
  private installation?: Installation;
  private armed?: {site:number; ignites:number};
  private next:number = fireRules.firstAfter;
  private nextSite?:number;
  private random = Math.random;
  private clock = 0;
  private last = 0;
  private delay = 0;

  reset(now:number,random=Math.random) {
    this.active = this.installation = this.armed = undefined;
    this.next = fireRules.firstAfter;
    this.nextSite = undefined;
    this.random = random;
    this.clock = 0;
    this.last = now;
    this.delay = 0;
  }

  get burning() { return this.active!==undefined; }

  get installer() { return this.installation?.actor; }
  get smoke() {
    return this.armed && this.armed.ignites-this.clock<=fireRules.smoke ? this.armed.site : undefined;
  }

  handlingSite(actor:string) {
    return this.installation?.actor===actor ? this.installation.site : undefined;
  }

  progress(actor:string,now:number) {
    return this.installation?.actor===actor ? Math.min(1,(now-this.installation.started)/fireRules.install) : undefined;
  }

  option(player:Player,hasDevice:boolean,hasExtinguisher:boolean):FireOption|undefined {
    if (this.active) {
      const {site} = this.active;
      if (hasExtinguisher && canActOnFire(player,site)) return {kind:'extinguish',site,label:'Apagar incêndio'};
      return;
    }
    const smoke = this.smoke;
    if (smoke!==undefined && canActOnFire(player,smoke)) {
      return {kind:'disarm',site:smoke,label:'Desarmar dispositivo'};
    }
    if (!hasDevice || this.installation || this.armed) return;
    const site = fireSites.findIndex((_,index)=>canActOnFire(player,index));
    if (site!==-1) return {kind:'plant',site,label:`Instalar incendiário · ${fireSites[site].object}`};
  }

  plant(player:Player,site:number,item:number,now:number) {
    if (this.active || this.armed || this.installation || player.moving || !canActOnFire(player,site)) return false;
    const {id:actor,x,y,hit,swing} = player;
    this.installation = {actor,site,item,started:now,x,y,hit,swing};
    return true;
  }

  updateInstallation(player:Player|undefined, now:number,
    owns:(actor:string,item:number)=>boolean, consume:(actor:string,item:number)=>boolean) {
    const job = this.installation;
    if (!job) return;
    if (!player || player.id!==job.actor || player.moving || player.x!==job.x || player.y!==job.y ||
        player.hit!==job.hit || player.swing!==job.swing || !canActOnFire(player,job.site) || !owns(job.actor,job.item)) {
      this.installation = undefined;
      return 'Instalação interrompida.';
    }
    if (now<job.started+fireRules.install) return;
    this.installation = undefined;
    if (!consume(job.actor,job.item)) return 'Instalação interrompida.';
    this.armed = {site:job.site,ignites:this.clock+fireRules.fuse};
    return 'Incendiário instalado.';
  }

  disarm(site:number) {
    if (this.smoke!==site) return false;
    this.armed = undefined;
    this.next = Math.max(this.next,this.clock+fireRules.fuse);
    return true;
  }

  extinguish(site:number) {
    if (site!==this.active?.site) return false;
    this.active = undefined;
    this.next = this.clock+fireRules.cooldown+this.delay;
    this.nextSite = (site+1)%fireSites.length;
    return true;
  }

  increaseSafety() {
    if (this.delay) return;
    this.delay = fireRules.safetyDelay;
    this.next += this.delay;
  }

  advance(now:number, exploring:boolean) {
    const elapsed = Math.max(0,now-this.last);
    this.last = now;
    if (!exploring) return 0;
    this.clock += elapsed;
    const active = this.active;
    if (!active) {
      if (this.armed && this.clock>=this.armed.ignites) {
        this.active = {site:this.armed.site,elapsed:0,losses:0};
        this.armed = undefined;
      } else if (!this.armed && !this.installation && this.clock>=this.next) {
        const site = this.nextSite ?? Math.floor(this.random()*fireSites.length);
        this.active = {site,elapsed:0,losses:0};
      }
      return 0;
    }
    active.elapsed = Math.min(fireRules.duration,active.elapsed+elapsed);
    const losses = Math.floor(active.elapsed/fireRules.tick);
    const damage = (losses-active.losses)*fireRules.damage;
    active.losses = losses;
    if (active.elapsed>=fireRules.duration) this.extinguish(active.site);
    return damage;
  }

  view(exploring:boolean):FireView|undefined {
    if (this.active) return {site:this.active.site,remaining:Math.ceil((fireRules.duration-this.active.elapsed)/1000),
      damage:fireRules.damage,paused:!exploring};
  }
}
