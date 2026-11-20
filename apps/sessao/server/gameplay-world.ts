import type { MissionSwapResult } from './PersonalAgenda';
import type {BillPolicies} from '../src/plenary';
import type { Agenda, EvidenceKind } from '../src/politics';
import type { Office } from '../src/elections';
import type { GameplayEvent } from '../src/gameplay';
import { localPerception, type Player } from '../src/map';

export type GameplayWorld = {
  training?:boolean;
  isInfiltrator?:(id:string)=>boolean;
  incidentNow?:number;
  incidentExpense?:(amount:number)=>void;
  nextEventId?:()=>number;
  policies?:BillPolicies;
  publicBudget?:number;
  earnXp?:(id:string,amount:number)=>void;
  settleBet?:(id:string,stake:number,payout:number,maxPayout:number)=>boolean;
  spendSubsidized?:(id:string,price:number,subsidy:number)=>boolean;
  vision?:(id:string)=>number;
  plenary?:boolean;
  projectFilingError?:(id:string,project:number)=>string|undefined;
  projectSignatures?:number;
  callCassation?:(player:Player)=>string|undefined;
  missionSwapPrice?:(id:string)=>number;
  swapMissions?:(id:string)=>MissionSwapResult;
  hasMandate?:(id:string)=>boolean;
  deposit?:(id:string,amount:number)=>boolean;
  lootWallet?:(id:string,fraction:number)=>number;
  takeWallet?:(id:string)=>number;
  paymentsLeft?:(id:string)=>number;
  payNpc?:(from:string,to:string,amount:number)=>boolean;
  detain?:(id:string,duration:number,realNow?:number,arrivalDelay?:number)=>boolean;
  releaseDetention?:(id:string,realUntil:number)=>void;
  cashFlow?:(kind:'spawned'|'expired',amount:number)=>void;
  feedback?:(id:string,message:string)=>void;
  actionFailed?:(id:string,message:string)=>void;
  players:Player[]; now:number; office:(id:string)=>Office|undefined;
  hasEvidence?:(id:string,kind:EvidenceKind)=>boolean; hasMission?:(id:string,mission:Agenda)=>boolean;
  started?:number; present?:(id:string)=>boolean; wallet?:(id:string)=>number; spend?:(id:string,amount:number)=>boolean; voice:(id:string)=>boolean; earn:(id:string,amount:number)=>void; publish:(event:GameplayEvent)=>void;
};

export function gameplayWitnesses(players:Player[], actor:Player, target?:string, vision?:(id:string)=>number) {
  return players.filter(other => other.id!==actor.id && other.id!==target && !other.knockedOut && !other.carried &&
      localPerception(other,actor,vision?.(other.id)).visible)
    .map(other => other.id);
}

type EventDetails = Partial<Omit<GameplayEvent,'type'|'actor'|'at'|'position'|'witnesses'|'eventId'>> & {witnesses?:Iterable<string>};

export function publishGameplay(world:Pick<GameplayWorld,'players'|'now'|'publish'|'present'|'vision'|'nextEventId'>, actor:Player,
  type:GameplayEvent['type'], {witnesses,...details}:EventDetails = {}) {
  world.publish({eventId:world.nextEventId?.(),type,actor:actor.id,at:world.now,position:{x:actor.x,y:actor.y},...details,
    witnesses:[...(witnesses ?? gameplayWitnesses(world.players.filter(player=>world.present?.(player.id)!==false),actor,details.target,world.vision))]});
}
