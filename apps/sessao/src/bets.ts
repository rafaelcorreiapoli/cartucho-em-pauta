export const BET_STAKES = [1,2,5] as const;
export const BET_SYMBOLS = ['🐯','🍒','💎','🔔','🍀','7️⃣'];
export const BET_PAYOUT = 9;
export const BET_SPIN_MS = 640;

export type BetsRound = {id:number; reels:number[]; stake:number; payout:number};

export function winningReels(reels:readonly number[]) {
  return reels.length===3 && reels[0]===reels[1] && reels[1]===reels[2];
}
