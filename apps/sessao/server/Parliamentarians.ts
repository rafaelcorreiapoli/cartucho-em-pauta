import { blockedBy, canStand, NAMES, type Player } from '../src/map';
import { findRoute, followRoute } from '../src/navigation';
import { npcRules } from '../src/parliamentarians';
import { bills, stations, type Vote } from '../src/plenary';

const destinations = [stations.coffee,stations.archive,stations.secretary,stations.committees,stations.press,{x:140,y:146}];
const profiles = [
  {character:3,signature:0,price:2,conviction:1, preferences:['yes','no',undefined]},
  {character:4,signature:2,price:2,conviction:2, preferences:['no',undefined,'yes']},
  {character:7,signature:3,price:3,conviction:2, preferences:[undefined,'yes','no']},
] as const;
type Member = {player:Player; profile:typeof profiles[number]; route:ReturnType<typeof findRoute>; next:number;
  promises:Map<number,{round:number;vote:Vote;amount:number}>};

export class Parliamentarians {
  private members = new Map<string,Member>();

  get players() { return [...this.members.values()].map(member=>member.player); }

  reset(count:number,now:number) {
    this.members.clear();
    profiles.slice(0,count).forEach((profile,index)=>{
      const id = `npc-parliamentarian-${index+1}`;
      this.members.set(id,{profile,promises:new Map(),route:[],next:now+index*500,player:{
        ...destinations[index],id,nick:NAMES[profile.character],character:profile.character,npc:true,direction:0,moving:false,speed:npcRules.speed,
      }});
    });
  }

  signature(id:string) { return this.members.get(id)?.profile.signature; }

  intention(id:string,round:number,project=round%bills.length):Vote|undefined {
    const member = this.members.get(id);
    if (!member) return;
    const promise = member.promises.get(project);
    if (promise?.round===round) return promise.vote;
    return member.profile.preferences[project];
  }

  minimum(id:string,round:number,vote:Vote,project=round%bills.length) {
    const member = this.members.get(id)!;
    const promise = member.promises.get(project);
    const prior = promise?.round===round ? promise : undefined;
    if (prior?.vote===vote) return 0;
    const intention = this.intention(id,round,project);
    const price = intention===vote ? 0 : member.profile.price+(intention ? member.profile.conviction-1 : 0);
    return Math.max(price,prior ? Math.floor(prior.amount)+1 : 0);
  }

  commit(id:string,round:number,vote:Vote,amount:number,project=round%bills.length) {
    const member = this.members.get(id)!;
    const promise = member.promises.get(project);
    if (promise?.round===round && promise.vote===vote && !amount) return;
    member.promises.set(project,{round,vote,amount});
  }

  tick(now:number,seconds:number,paused:ReadonlySet<string>,exploring:boolean) {
    for (const member of this.members.values()) {
      const {player,route} = member;
      if (!exploring || player.knockedOut || player.carried || player.hit || paused.has(player.id)) {
        player.moving = false;
        continue;
      }
      if (!route.length && now>=member.next) {
        const destination = destinations[Math.floor(Math.random()*destinations.length)];
        member.route = findRoute(player,destination);
        member.next = now+npcRules.pauseMs;
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
    for (const member of this.members.values()) { member.route = []; member.player.moving = false; }
  }
}
