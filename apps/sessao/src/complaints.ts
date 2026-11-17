export const complaintRules = {reward:1,popularityGain:8,xp:25,popularityLoss:8,history:24,incidentWindowMs:10_000,photoWindowMs:15_000,photoDistance:32} as const;
export type InfractionKind = 'hit'|'npc-robbed'|'safe-robbed'|'phone-game';
export type ComplaintCase = {id:number;kind:InfractionKind;accused:string;at:number;hasPhoto?:true};
export type ComplaintProof = {photo:number;accused:string} & (
  {kind:'phone-game';target:string} | {kind:Exclude<InfractionKind,'phone-game'>;id:number}
);
export type ComplaintView = {available:(ComplaintCase & {photoIds?:number[]})[];history:ComplaintCase[];proofs?:ComplaintProof[];atDesk?:true};
export const infractionLabels:Record<InfractionKind,string> = {
  hit:'Agressão',
  'phone-game':'Jogo no celular',
  'npc-robbed':'Roubo de carteira',
  'safe-robbed':'Roubo de cofre',
};
