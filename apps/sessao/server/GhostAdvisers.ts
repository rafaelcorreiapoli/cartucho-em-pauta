import {canStand, roomAt, isolationRoom, WIDTH, HEIGHT, type Player} from '../src/map';
import {findRoute, followRoute} from '../src/navigation';
import {ghostAdviserRules} from '../src/ghost-advisers';

type Adviser = {player:Player; route:ReturnType<typeof findRoute>; elapsed:number; last:number};
export class GhostAdvisers {
  private members = new Map<string,Adviser>();
  private serial = 0;
  private last = 0;
  private random = Math.random;
  get players() { return [...this.members.values()].map(({player})=>player); }
  has(id:string) { return this.members.has(id); }
  reset(now:number,random=Math.random) { this.members.clear(); this.serial=0; this.last=now; this.random=random; }
  private point() {
    // Sample the walkable floor rather than rooms, including corridors.
    for (let attempt=0;attempt<1000;attempt++) {
      const point = {x:20+this.random()*(WIDTH-40),y:40+this.random()*(HEIGHT-60)};
      if (canStand(point.x,point.y) && roomAt(point)!==isolationRoom.name) return point;
    }
    return {x:140,y:146};
  }
  hire(now=this.last) {
    const player:Player = {...this.point(),id:`npc-ghost-adviser-${++this.serial}`,nick:'Assessor fantasma',
      npc:true,visitor:'joao-santana',character:0,direction:0,moving:false,speed:ghostAdviserRules.speed};
    this.members.set(player.id,{player,route:[],elapsed:0,last:now});
    return player;
  }
  kill(id:string) { this.members.delete(id); }
  tick(now:number,active:boolean,spend:(amount:number)=>void) {
    this.last = now;
    let expense=0;
    for (const member of this.members.values()) {
      const elapsed=Math.max(0,now-member.last);
      member.last=now;
      if (!active) { member.player.moving=false; continue; }
      member.elapsed+=elapsed;
      expense+=Math.floor(member.elapsed/ghostAdviserRules.tick)*ghostAdviserRules.expense;
      member.elapsed%=ghostAdviserRules.tick;
      if (member.player.hit && member.player.hit>now) continue;
      if (!member.route.length) member.route=findRoute(member.player,this.point());
      followRoute(member.player,member.route,Math.min(elapsed,250)/1000,(x,y)=>canStand(x,y));
    }
    if (expense) spend(expense);
  }
}
