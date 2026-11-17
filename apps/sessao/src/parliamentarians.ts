import type { Vote } from './plenary';

export const npcRules = {
  count: 2, startingWallet: [7,13], pauseMs: 2500, dialogueMs: 15_000,
  trustDiscount:1, aggressionSurcharge:2,
  speed: 68, robberyMs: 3000, robberyRange: 21,
} as const;

export type ParliamentarianDeal = {
  id:string; name:string; project?:string; projectIndex?:number; wallet:number; expiresIn:number;
  documents:{id:number;title:string;price:number}[];
  minimum:Record<Vote,number>;
};
