import {VISION_RADIUS, type Player} from '../src/map';

/** Tracks physical knockouts independently of visibility and animation snapshots. */
export class KnockoutAnnouncements {
  private down = new Set<string>();
  private first = false;
  reset() { this.down.clear(); this.first = false; }
  update(players:Player[],listeners:Player[],firstBlood:()=>void,sound:(id:string,level:number,pan:number)=>void) {
    const down = new Set(players.filter(player=>player.knockedOut).map(player=>player.id));
    for (const player of players) {
      if (!down.has(player.id) || this.down.has(player.id)) continue;
      if (!this.first) { this.first = true; firstBlood(); }
      for (const listener of listeners) {
        const level = Math.max(0,1-Math.hypot(player.x-listener.x,player.y-listener.y)/VISION_RADIUS);
        if (level) sound(listener.id,level,Math.max(-1,Math.min(1,(player.x-listener.x)/85)));
      }
    }
    this.down = down;
  }
}
