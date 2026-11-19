import { blockedBy, canStand, roomAt, type Player } from '../src/map';
import { findRoute, followRoute } from '../src/navigation';
import { npcRules, visitorRoster } from '../src/visitors';
import { npcs } from '../src/npcs';
import { reprography } from '../src/room-activities';
import { stations } from '../src/plenary';

const destinations = [
  stations.coffee,stations.archive,stations.secretary,stations.library,stations.press,
  stations.cabinet,stations.audit,reprography,npcs.furnitureVendor.interaction,
  npcs.snackVendor.interaction,npcs.credentialsVendor.interaction,{x:620,y:227},{x:140,y:146},
];
const destinationRooms = new Map(destinations.map(point=>[point,roomAt(point)]));
type Member = {player:Player; route:ReturnType<typeof findRoute>; next:number; expires:number; destination?:string};

export class Visitors {
  private members = new Map<string,Member>();
  private limit = 0;
  private serial = 0;
  private nextSpawn = 0;

  get players() { return [...this.members.values()].map(member=>member.player); }

  reset(count:number,now:number,random = Math.random) {
    this.members.clear();
    this.limit = Math.max(0,Math.min(count,npcRules.maxCount));
    this.serial = 0;
    this.nextSpawn = now+npcRules.spawnMs;
    for (let i=0;i<this.limit;i++) this.spawn(now,random);
  }

  private spawn(now:number,random:()=>number) {
    const active = new Set(this.players.map(player=>player.visitor));
    const available = visitorRoster.filter(visitor=>!active.has(visitor.id));
    const visitor = available[Math.floor(random()*available.length)];
    if (!visitor) return;
    const occupied = new Set(this.players.map(roomAt));
    const point = destinations.find(point=>!occupied.has(roomAt(point)));
    if (!point) return;
    const id = `npc-visitor-${++this.serial}`;
    const player:Player = {...point,id,nick:visitor.name,visitor:visitor.id,character:0,npc:true,
      direction:0,moving:false,speed:npcRules.speed};
    this.members.set(id,{player,route:[],next:now,expires:now+npcRules.lifetimeMs,
      destination:roomAt(point)});
    return player;
  }

  departWhenRecovered(id:string) {
    const member = this.members.get(id);
    if (member) member.expires = 0;
  }

  maintain(now:number,onSpawn:(player:Player)=>void,onLeave:(player:Player)=>void,random = Math.random) {
    for (const [id,member] of this.members) {
      // Keep downed bodies available until their recovery.
      if (now<member.expires || member.player.knockedOut || member.player.carried || member.player.hit) continue;
      onLeave(member.player);
      this.members.delete(id);
    }
    if (now<this.nextSpawn) return;
    this.nextSpawn = now+npcRules.spawnMs;
    if (this.members.size>=this.limit) return;
    const player = this.spawn(now,random);
    if (player) onSpawn(player);
  }

  tick(now:number,seconds:number,exploring:boolean) {
    for (const member of this.members.values()) {
      const {player,route} = member;
      if (!exploring || player.knockedOut || player.carried || player.hit) {
        player.moving = false;
        continue;
      }
      if (!route.length && now>=member.next) {
        const occupied = new Set([roomAt(player)]);
        for (const other of this.members.values()) {
          if (other===member) continue;
          occupied.add(roomAt(other.player));
          if (other.destination) occupied.add(other.destination);
        }
        const available = destinations.filter(point=>!occupied.has(destinationRooms.get(point)!));
        const destination = available[Math.floor(Math.random()*available.length)];
        member.next = now+npcRules.pauseMs;
        if (destination) {
          member.route = findRoute(player,destination);
          member.destination = member.route.length ? destinationRooms.get(destination) : undefined;
        }
      }
      if (!member.route.length) {
        player.moving = false;
        continue;
      }
      followRoute(player,member.route,seconds,(x,y)=>canStand(x,y) && !player.barriers?.some(rect=>blockedBy(rect,x,y)));
      if (!member.route.length) member.next = now+npcRules.pauseMs;
    }
  }

  stopRoutes() {
    for (const member of this.members.values()) { member.route = []; member.destination = undefined; member.player.moving = false; }
  }
}
