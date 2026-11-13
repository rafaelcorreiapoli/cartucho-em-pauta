import {fireRules,fireSites,type FireView} from '../src/fire';

export class Fire {
  private active?: {site:number; elapsed:number; losses:number};
  private next:number = fireRules.firstAfter;
  private nextSite = 0;
  private clock = 0;
  private last = 0;
  private delay = 0;

  reset(now:number) {
    this.active = undefined;
    this.next = fireRules.firstAfter;
    this.nextSite = 0;
    this.clock = 0;
    this.last = now;
    this.delay = 0;
  }

  get potentialSite() { return this.active || this.clock<this.next-fireRules.firstAfter/2 ? undefined : this.nextSite; }

  ignite(site:number) {
    if (this.active || !fireSites[site]) return false;
    this.active = {site,elapsed:0,losses:0};
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
      if (this.clock>=this.next) this.ignite(this.nextSite);
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
