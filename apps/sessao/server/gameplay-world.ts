import type { Office } from '../src/elections';
import type { GameplayEvent } from '../src/gameplay';
import { localPerception, type Player } from '../src/map';

export type GameplayWorld = {
  players:Player[]; now:number; office:(id:string)=>Office|undefined;
  started?:number; wallet?:(id:string)=>number; spend?:(id:string,amount:number)=>boolean; voice:(id:string)=>boolean; earn:(id:string,amount:number)=>void; publish:(event:GameplayEvent)=>void;
};

export function gameplayWitnesses(players:Player[], actor:Player, target?:string) {
  return players.filter(other => other.id!==actor.id && other.id!==target && localPerception(other,actor).visible)
    .map(other => other.id);
}

type EventDetails = Partial<Omit<GameplayEvent,'type'|'actor'|'at'|'position'|'witnesses'>> & {witnesses?:Iterable<string>};

export function publishGameplay(world:Pick<GameplayWorld,'players'|'now'|'publish'>, actor:Player,
  type:GameplayEvent['type'], {witnesses,...details}:EventDetails = {}) {
  world.publish({type,actor:actor.id,at:world.now,position:{x:actor.x,y:actor.y},...details,
    witnesses:[...(witnesses ?? gameplayWitnesses(world.players,actor,details.target))]});
}
