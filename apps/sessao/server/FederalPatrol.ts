import {federalPatrolRules} from '../src/federal-patrol';
import {blockedBy,canStand,roomAt,segmentIntersects,type Player} from '../src/map';
import {findRoute,followRoute} from '../src/navigation';
import {officeDoorPoint,officeRules,privateOffices,type OfficeLayout} from '../src/private-offices';
import type {PrivateOffices} from './PrivateOffices';

/** One persistent inspector, independent of visitor limits and their economy. */
export class FederalPatrol {
  private player?:Player;
  private route:ReturnType<typeof findRoute> = [];
  private target?:OfficeLayout;
  private breach?:{office:string;ends:number;duration:number};

  constructor(private offices:PrivateOffices) {}
  get players() { return this.player ? [this.player] : []; }

  reset(enabled:boolean) {
    this.route = [];
    this.target = undefined;
    this.breach = undefined;
    this.player = enabled ? {id:'npc-federal',nick:federalPatrolRules.name,visitor:federalPatrolRules.skin,
      npc:true,character:0,x:140,y:146,direction:0,moving:false,speed:federalPatrolRules.speed} : undefined;
  }

  private next(random:()=>number) {
    const player = this.player!;
    const available = privateOffices.filter(office=>office.name!==roomAt(player) && office!==this.target);
    this.target = available[Math.floor(random()*available.length)];
    // Plan on the permanent floor plan; closed doors on the route are handled below.
    this.route = this.target ? findRoute({...player,barriers:undefined},this.target.spawn) : [];
  }

  tick(now:number,seconds:number,active:boolean,onEntry:(office:OfficeLayout)=>void,random = Math.random) {
    const player = this.player;
    if (!player) return;
    player.moving = false;
    player.breachingDoor = undefined;
    if (!active) { this.breach = undefined; return; }
    if (!this.route.length) this.next(random);
    if (!this.route.length) return;
    const before = roomAt(player);
    const waypoint = this.route[0];
    const door = [...this.offices.offices.values()].find(office=>
      office.door!=='open' && office.doorUntil<=now &&
      this.offices.near(player,office,'door') && segmentIntersects(player,waypoint,office.layout.door));
    if (door) {
      const point = officeDoorPoint(door.layout);
      const dx = point.x-player.x,dy = point.y-player.y;
      player.direction = Math.abs(dx)>Math.abs(dy) ? dx>0 ? 1 : 3 : dy>0 ? 0 : 2;
      if (door.door==='locked') {
        const duration = this.offices.breachTime(door,'door',officeRules.maxSecurity,now)!;
        if (this.breach?.office!==door.layout.id || this.breach.duration!==duration) {
          this.breach = {office:door.layout.id,ends:now+duration,duration};
        }
        if (now<this.breach.ends) { player.breachingDoor = true; return; }
        this.offices.breachDoor(door.layout.id,now,player.id);
      } else this.offices.doorAction(player,door,'office-open',now);
    }
    this.breach = undefined;
    const barriers = this.offices.doors(now);
    followRoute(player,this.route,seconds,(x,y)=>canStand(x,y) && !barriers.some(rect=>blockedBy(rect,x,y)));
    const entered = privateOffices.find(office=>office.name===roomAt(player) && office.name!==before);
    if (entered) {
      onEntry(entered);
      this.next(random);
    }
  }
}
