import { localPerception, type Motion } from './map';

export const cashItems = {
  briefcase: {frame:0,amount:3},
  underwear: {frame:1,amount:2},
  bundle: {frame:2,amount:1},
} as const;

export type CashDrop = Motion & {id:number; kind:keyof typeof cashItems};

export function canPocket(player:Motion, drop:CashDrop) {
  return Math.hypot(player.x-drop.x,player.y-drop.y)<=18 && localPerception(player,drop).visible;
}
