import { blockedBy, canStand, NAMES, type Player } from '../src/map';
import { findRoute, followRoute } from '../src/navigation';
import { npcRules } from '../src/parliamentarians';
import type { GameplayEvent } from '../src/gameplay';
import { bills, stations, type Vote } from '../src/plenary';

const destinations = [stations.coffee,stations.archive,stations.secretary,stations.library,stations.press,{x:140,y:146}];
const profiles = [
  {signature:0,price:2,conviction:1, preferences:['yes','no',undefined]},
  {signature:2,price:2,conviction:2, preferences:['no',undefined,'yes']},
  {signature:3,price:3,conviction:2, preferences:[undefined,'yes','no']},
] as const;
type Member = {player:Player; profile:typeof profiles[number]; route:ReturnType<typeof findRoute>; next:number;
  promises:Map<number,{round:number;vote:Vote;amount:number;buyer?:string}>; trusted:Set<string>; aggressors:Set<string>};

export class Parliamentarians {
  private members = new Map<string,Member>();

  get players() { return [...this.members.values()].map(member=>member.player); }

  reset(count:number,now:number,occupied:ReadonlySet<number> = new Set(),random = Math.random) {
    this.members.clear();
    const roster = NAMES.map((_,index)=>index);
    const available = roster.filter(character=>!occupied.has(character));
    const reserved = roster.filter(character=>occupied.has(character));
    profiles.slice(0,count).forEach((profile,index)=>{
      const pool = available.length ? available : reserved;
      const [character] = pool.splice(Math.floor(random()*pool.length),1);
      const id = `npc-parliamentarian-${index+1}`;
      this.members.set(id,{profile,promises:new Map(),trusted:new Set(),aggressors:new Set(),route:[],next:now+index*500,player:{
        ...destinations[index],id,nick:NAMES[character],character,npc:true,direction:0,moving:false,speed:npcRules.speed,
      }});
    });
  }

  private adjustment(member:Member,buyer?:string) {
    if (!buyer) return 0;
    return Number(member.aggressors.has(buyer))*npcRules.aggressionSurcharge -
      Number(member.trusted.has(buyer))*npcRules.trustDiscount;
  }

  signature(id:string,buyer:string) {
    const member = this.members.get(id);
    return member ? Math.max(0,member.profile.signature+this.adjustment(member,buyer)) : 0;
  }

  rememberAgreement(id:string,buyer:string) { this.members.get(id)?.trusted.add(buyer); }

  witnessAggression(event:GameplayEvent) {
    if (event.type!=='hit') return;
    for (const id of event.witnesses) this.members.get(id)?.aggressors.add(event.actor);
  }

  castVote(id:string,round:number,project:number) {
    const vote = this.intention(id,round,project);
    const promise = this.members.get(id)?.promises.get(project);
    if (promise?.round===round && promise.buyer) this.rememberAgreement(id,promise.buyer);
    return vote;
  }

  intention(id:string,round:number,project=round%bills.length):Vote|undefined {
    const member = this.members.get(id);
    if (!member) return;
    const promise = member.promises.get(project);
    if (promise?.round===round) return promise.vote;
    return member.profile.preferences[project];
  }

  minimum(id:string,round:number,vote:Vote,project=round%bills.length,buyer?:string) {
    const member = this.members.get(id)!;
    const promise = member.promises.get(project);
    const prior = promise?.round===round ? promise : undefined;
    if (prior?.vote===vote) return 0;
    const intention = this.intention(id,round,project);
    const price = intention===vote ? 0 : member.profile.price+(intention ? member.profile.conviction-1 : 0);
    return Math.max(price+this.adjustment(member,buyer),prior ? Math.floor(prior.amount)+1 : 0);
  }

  cheapestPaidVote(buyer:string,round:number,project:number) {
    let cheapest: number | undefined;
    for (const {id} of this.players) {
      for (const vote of ['yes','no'] as const) {
        const price = this.minimum(id,round,vote,project,buyer);
        if (price>0 && (cheapest===undefined || price<cheapest)) cheapest = price;
      }
    }
    return cheapest;
  }

  commit(id:string,round:number,vote:Vote,amount:number,project=round%bills.length,buyer?:string) {
    const member = this.members.get(id)!;
    const promise = member.promises.get(project);
    if (promise?.round===round && promise.vote===vote && !amount) return;
    member.promises.set(project,{round,vote,amount,buyer});
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
