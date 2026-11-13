import { blockedBy, canStand, type Player } from '../src/map';
import { findRoute, followRoute } from '../src/navigation';
import { npcRules } from '../src/parliamentarians';
import { stations, type Vote } from '../src/plenary';

const destinations = [stations.coffee,stations.archive,stations.secretary,stations.committees,stations.press,{x:140,y:146}];
const profiles = [
  {name:'Dona Cida',character:3,signature:0,price:2,conviction:1},
  {name:'Dr. Valdemar',character:4,signature:2,price:2,conviction:2},
  {name:'Dra. Nair',character:7,signature:3,price:3,conviction:2},
] as const;
type Member = {player:Player; profile:typeof profiles[number]; route:ReturnType<typeof findRoute>; next:number;
  promise?:{round:number;vote:Vote;amount:number}};

export class Parliamentarians {
  private members = new Map<string,Member>();

  get players() { return [...this.members.values()].map(member=>member.player); }

  reset(count:number,now:number) {
    this.members.clear();
    profiles.slice(0,count).forEach((profile,index)=>{
      const id = `npc-parliamentarian-${index+1}`;
      this.members.set(id,{profile,route:[],next:now+index*500,player:{
        ...destinations[index],id,nick:profile.name,character:profile.character,npc:true,direction:0,moving:false,speed:npcRules.speed,
      }});
    });
  }

  signature(id:string) { return this.members.get(id)?.profile.signature; }

  intention(id:string,round:number):Vote|undefined {
    const member = this.members.get(id);
    if (!member) return;
    if (member.promise?.round===round) return member.promise.vote;
    const index = profiles.indexOf(member.profile);
    return (round+index)%3===0 ? 'yes' : (round+index)%3===1 ? 'no' : undefined;
  }

  minimum(id:string,round:number,vote:Vote) {
    const member = this.members.get(id)!;
    const prior = member.promise?.round===round ? member.promise : undefined;
    if (prior?.vote===vote) return 0;
    const intention = this.intention(id,round);
    const price = intention===vote ? 0 : member.profile.price+(intention ? member.profile.conviction-1 : 0);
    return Math.max(price,prior ? Math.floor(prior.amount)+1 : 0);
  }

  commit(id:string,round:number,vote:Vote,amount:number) {
    const member = this.members.get(id)!;
    if (member.promise?.round===round && member.promise.vote===vote && !amount) return;
    member.promise = {round,vote,amount};
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
      if (!member.route.length) continue;
      followRoute(player,member.route,seconds,(x,y)=>canStand(x,y) && !player.barriers?.some(rect=>blockedBy(rect,x,y)));
      if (!member.route.length) member.next = now+npcRules.pauseMs;
    }
  }

  stopRoutes() {
    for (const member of this.members.values()) { member.route = []; member.player.moving = false; }
  }
}
