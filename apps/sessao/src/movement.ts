import { baseStamina } from './progression';
import { doorDestination } from './interactions';
import { blockedBy, canStand, canStandInIsolation, canStandInPlenary, HEIGHT, PLENARY_DOORS, WIDTH, move, type Motion, type MovementModifier, type Player } from './map';
import { findRoute, followRoute } from './navigation';

export const STEP_MS = 50;
export const STEP_SECONDS = STEP_MS / 1000;
export const MAX_QUEUED_INPUTS = 8;
export const MAX_STAMINA = baseStamina;
const staminaDrain = 25*STEP_SECONDS;
const staminaRecovery = 20*STEP_SECONDS;
export type MovementInput = { seq: number; plenary?:boolean; sprint?:true; motion?: Motion; destination?: Motion; door?:number };
export type ControlState = { player: Player; route: Motion[]; ack: number; plenary?:boolean; isolated?:boolean };

function recoverStamina(player:Player) {
  const max = player.staminaMax ?? MAX_STAMINA;
  if (player.stamina!==undefined && player.stamina<max) {
    player.stamina = Math.min(max,player.stamina+staminaRecovery*(player.staminaRegenModifier?.factor ?? 1));
  }
}

function advanceModifier(modifier:MovementModifier|undefined) {
  if (modifier && modifier.remainingMs>STEP_MS) {
    return {...modifier,remainingMs:modifier.remainingMs-STEP_MS};
  }
}

function advanceModifiers(player:Player) {
  if (player.speedModifier) player.speedModifier = advanceModifier(player.speedModifier);
  if (player.staminaRegenModifier) player.staminaRegenModifier = advanceModifier(player.staminaRegenModifier);
}

export function restMovement(player:Player) {
  player.moving = false;
  player.sprinting = undefined;
  recoverStamina(player);
  advanceModifiers(player);
}

export function applyInput(state: ControlState, input: MovementInput) {
  if (state.player.knockedOut) {
    state.route = [];
    restMovement(state.player);
    state.ack = input.seq;
    return;
  }
  const {player} = state;
  const stamina = player.stamina ?? player.staminaMax ?? MAX_STAMINA;
  const wantsSprint = input.sprint && player.canSprint && !player.carrying;
  player.sprinting = wantsSprint && stamina>=staminaDrain ? true : undefined;
  const destination = input.door===undefined ? input.destination : doorDestination(state.player,input.door,!!state.plenary);
  if (destination) state.route = findRoute(state.player,destination,state.plenary);
  const base = state.isolated ? canStandInIsolation : state.plenary ? canStandInPlenary : canStand;
  const stand:typeof canStand = (x,y)=>base(x,y) && !player.barriers?.some(rect=>blockedBy(rect,x,y));
  if (input.motion) {
    state.route = [];
    move(state.player,input.motion,STEP_SECONDS,stand);
  } else {
    followRoute(state.player,state.route,STEP_SECONDS,stand);
  }
  if (!player.moving) player.sprinting = undefined;
  if (player.sprinting) player.stamina = stamina-staminaDrain;
  else if (!wantsSprint || !player.moving) recoverStamina(player);
  advanceModifiers(player);
  state.ack = input.seq;
}

function point(data: unknown): Motion | undefined {
  if (!data || typeof data !== 'object' || !('x' in data) || !('y' in data)) return;
  const {x,y} = data;
  if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) return {x,y};
}

export function readInput(data: unknown): MovementInput | undefined {
  if (!data || typeof data !== 'object' || !('seq' in data) ||
      typeof data.seq !== 'number' || !Number.isSafeInteger(data.seq) || data.seq < 1) return;
  const seq = data.seq;
  const plenary = 'plenary' in data && data.plenary===true;
  const sprint = 'sprint' in data && data.sprint===true ? true : undefined;
  if ('door' in data) {
    if (typeof data.door==='number' && Number.isInteger(data.door) && data.door>=0 && data.door<PLENARY_DOORS.length) {
      return {seq,door:data.door,plenary,sprint};
    }
    return;
  }
  if ('destination' in data) {
    const destination = point(data.destination);
    if (destination && destination.x>=0 && destination.y>=0 && destination.x<WIDTH && destination.y<HEIGHT) {
      return {seq,destination,plenary,sprint};
    }
    return;
  }
  if ('motion' in data) {
    const motion = point(data.motion);
    const clamp = (value: number) => Math.max(-1,Math.min(1,value));
    if (motion) return {seq,plenary,sprint,motion:{x:clamp(motion.x),y:clamp(motion.y)}};
    return;
  }
  return {seq,plenary,sprint};
}
