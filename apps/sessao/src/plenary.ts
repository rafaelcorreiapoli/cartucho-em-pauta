export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const NEGOTIATION_MS = 80_000;
export const BALLOT_MS = 30_000;

export const stations = {
  amendment: {x:129,y:365,label:'Emenda'},
  audit: {x:808,y:93,label:'Auditoria'},
  panel: {x:240,y:76,label:'Painel'},
} as const;
export const STATION_RADIUS = 23;
export const bills = [
  {name:'Auxílio Churrasco', yes:{stability:22,budget:-28}, no:{stability:-14,budget:8}},
  {name:'Wi-Fi na Praça', yes:{stability:16,budget:-22}, no:{stability:-18,budget:6}},
  {name:'Teto do Cafezinho', yes:{stability:-12,budget:23}, no:{stability:12,budget:-19}},
] as const;

export type Impact = {stability:number; budget:number};
export type Role = 'Parlamentar' | 'Infiltrado';
export type Vote = 'yes' | 'no';
export type Phase = 'lobby' | 'negotiation' | 'ballot' | 'finished';
export type Action = keyof typeof stations | 'fraud';
export type Outcome = {round:number; passed:boolean; yes:number; no:number; needed:number; deficit:number; fraud:boolean};
export type PlenaryView = {
  phase:Phase; round:number; remaining:number; stability:number; budget:number; host?:string;
  role?:Role; players:number; electorate:number; vote?:Vote; voted:number; amended:boolean;
  canFraud:boolean; audit?:'clean' | 'fraud'; reportedFraud:boolean;
  yes:Impact; no:Impact; outcome?:Outcome; winner?:Role; reason?:string; infiltratorName?:string;
};
