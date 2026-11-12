import { HEIGHT, WIDTH, move, type Motion, type Player } from './map';
import { findRoute, followRoute } from './navigation';

export const STEP_MS = 50;
export const STEP_SECONDS = STEP_MS / 1000;
export const MAX_QUEUED_INPUTS = 8;
export type MovementInput = { seq: number; motion?: Motion; destination?: Motion };
export type ControlState = { player: Player; route: Motion[]; ack: number };

export function applyInput(state: ControlState, input: MovementInput) {
  if (input.destination) state.route = findRoute(state.player,input.destination);
  if (input.motion) {
    state.route = [];
    move(state.player,input.motion,STEP_SECONDS);
  } else {
    followRoute(state.player,state.route,STEP_SECONDS);
  }
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
  if ('destination' in data) {
    const destination = point(data.destination);
    if (destination && destination.x>=0 && destination.y>=0 && destination.x<WIDTH && destination.y<HEIGHT) {
      return {seq,destination};
    }
    return;
  }
  if ('motion' in data) {
    const motion = point(data.motion);
    const clamp = (value: number) => Math.max(-1,Math.min(1,value));
    if (motion) return {seq,motion:{x:clamp(motion.x),y:clamp(motion.y)}};
    return;
  }
  return {seq};
}
