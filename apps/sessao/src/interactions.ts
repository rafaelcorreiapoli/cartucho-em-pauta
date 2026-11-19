import { aidRadius } from './medical';
import { PLENARY_DOORS, obstacleBetween, wallBetween, type Motion } from './map';

export type InteractionActor = Motion & {knockedOut?:boolean; carrying?:boolean; carried?:boolean};

type Reach = {radius?:number; clearFloor?:boolean; handsFree?:boolean};

export function canInteract(actor:InteractionActor, target:Motion, {
  radius = 24, clearFloor = false, handsFree = false,
}:Reach = {}) {
  return !actor.knockedOut && !(handsFree && actor.carrying) &&
    Math.hypot(actor.x-target.x,actor.y-target.y)<=radius &&
    !(clearFloor ? obstacleBetween(actor,target) : wallBetween(actor,target));
}

// Characters occupy more screen space than an object's interaction point.
export function canReachPerson(actor:InteractionActor,target:InteractionActor) {
  return !target.knockedOut && !target.carried && canInteract(actor,target,{radius:48});
}

export function doorDestination(actor:InteractionActor, index:number, closed:boolean) {
  const door = PLENARY_DOORS[index];
  if (closed || !door) return;
  const [left,top,width,height] = door;
  const x = left+width/2;
  const threshold = {x,y:top+height/2};
  if (!canInteract(actor,threshold,{radius:24})) return;
  return {x,y:actor.y<=threshold.y ? top+height+10 : top-10};
}

export function canReachDownedPlayer(actor:InteractionActor & {id:string}, target:InteractionActor & {id:string}) {
  return actor.id!==target.id && !!target.knockedOut &&
    canInteract(actor,target,{radius:aidRadius,clearFloor:true,handsFree:true});
}
