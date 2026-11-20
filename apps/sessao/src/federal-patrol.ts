export const federalPatrolRules = {
  skin:'japones-federal', name:'Japonês da Federal', speed:68, detentionMs:10_000, flagrantPauseMs:2200,
} as const;

export const federalPatrolSheets = ['walk','door-breach'].map(action=>({
  key:`${federalPatrolRules.skin}-${action}`,path:`assets/${federalPatrolRules.skin}-${action}.png`,
}));

export function federalBreachArt(direction:number,time:number,reducedMotion:boolean) {
  const row = direction;
  return {key:`${federalPatrolRules.skin}-door-breach`,frame:row*4+(reducedMotion ? 0 : Math.floor(time/200)%4)};
}

export type FederalAudioStage = 'caught'|'isolated'|'cancelled';
export function federalAudioStage(previous:{detaining?:boolean;isolated?:boolean}|undefined,next:{detaining?:boolean;isolated?:boolean}):FederalAudioStage|undefined {
  if (next.detaining && !previous?.detaining) return 'caught';
  if (previous?.detaining && !next.detaining) return next.isolated ? 'isolated' : 'cancelled';
}
