import type {BillPolicies} from '../src/plenary';
import type { Agenda, EvidenceKind } from '../src/politics';
import type { Office } from '../src/elections';
import type { GameplayEvent } from '../src/gameplay';
import { localPerception, type Player } from '../src/map';

export type GameplayWorld = {
  policies?:BillPolicies;
  publicBudget?:number;
  spendSubsidized?:(id:string,price:number,subsidy:number)=>boolean;
  vision?:(id:string)=>number;
  plenary?:boolean;
  hasMandate?:(id:string)=>boolean;
  deposit?:(id:string,amount:number)=>boolean;
  lootWallet?:(id:string,fraction:number)=>number;
  takeWallet?:(id:string)=>number;
  payNpc?:(from:string,to:string,amount:number)=>boolean;
  cashFlow?:(kind:'spawned'|'expired',amount:number)=>void;
  feedback?:(id:string,message:string)=>void;
  players:Player[]; now:number; office:(id:string)=>Office|undefined;
  hasEvidence?:(id:string,kind:EvidenceKind)=>boolean; hasMission?:(id:string,mission:Agenda)=>boolean;
  started?:number; present?:(id:string)=>boolean; wallet?:(id:string)=>number; spend?:(id:string,amount:number)=>boolean; voice:(id:string)=>boolean; earn:(id:string,amount:number)=>void; publish:(event:GameplayEvent)=>void;
};

export function gameplayWitnesses(players:Player[], actor:Player, target?:string, vision?:(id:string)=>number) {
  return players.filter(other => other.id!==actor.id && other.id!==target && !other.knockedOut && !other.carried &&
      localPerception(other,actor,vision?.(other.id)).visible)
    .map(other => other.id);
}

type EventDetails = Partial<Omit<GameplayEvent,'type'|'actor'|'at'|'position'|'witnesses'>> & {witnesses?:Iterable<string>};

export function publishGameplay(world:Pick<GameplayWorld,'players'|'now'|'publish'|'present'|'vision'>, actor:Player,
  type:GameplayEvent['type'], {witnesses,...details}:EventDetails = {}) {
  world.publish({type,actor:actor.id,at:world.now,position:{x:actor.x,y:actor.y},...details,
    witnesses:[...(witnesses ?? gameplayWitnesses(world.players.filter(player=>world.present?.(player.id)!==false),actor,details.target,world.vision))]});
}
