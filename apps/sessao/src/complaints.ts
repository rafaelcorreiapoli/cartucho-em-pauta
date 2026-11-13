export const complaintRules = {reward:1,popularityLoss:8,history:24,incidentWindowMs:10_000,photoWindowMs:15_000,photoDistance:32} as const;
export type InfractionKind = 'hit'|'npc-robbed'|'safe-robbed';
export type ComplaintCase = {id:number;kind:InfractionKind;accused:string;at:number;hasPhoto?:true};
export type ComplaintView = {available:ComplaintCase[];history:ComplaintCase[]};
export const infractionLabels:Record<InfractionKind,string> = {
  hit:'Agressão',
  'npc-robbed':'Roubo de carteira',
  'safe-robbed':'Roubo de cofre',
};
