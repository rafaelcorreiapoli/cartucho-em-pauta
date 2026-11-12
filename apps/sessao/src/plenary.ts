import type { ElectionView } from './elections';
import type { PoliticsView } from './politics';

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 6;
export const NEGOTIATION_MS = 205_000;
export const BALLOT_MS = 35_000;

export const stations = {
  amendment: {x:129,y:365},
  audit: {x:808,y:93},
  panel: {x:240,y:76},
  cabinet: {x:389,y:93},
  press: {x:863,y:245},
  tv: {x:915,y:200},
} as const;
export type Station = keyof typeof stations;
export const STATION_RADIUS = 23;
export const bills = [
  {name:'Auxílio Churrasco', yes:{stability:22,budget:-28}, no:{stability:-14,budget:8}},
  {name:'Wi-Fi na Praça', yes:{stability:16,budget:-22}, no:{stability:-18,budget:6}},
  {name:'Teto do Cafezinho', yes:{stability:-12,budget:23}, no:{stability:12,budget:-19}},
] as const;

export type Impact = {stability:number; budget:number};
export type Role = 'Parlamentar' | 'Infiltrado';
export type Vote = 'yes' | 'no';
export type Phase = 'lobby' | 'negotiation' | 'ballot' | 'hearing' | 'finished';
export type Action = 'amendment' | 'audit' | 'panel' | 'fraud';
export type Outcome = {round:number; passed:boolean; yes:number; no:number; needed:number; deficit:number; fraud:boolean};
export type PlenaryView = {
  phase:Phase; round:number; remaining:number; stability:number; budget:number; host?:string;
  role?:Role; solo:boolean; players:number; electorate:number; vote?:Vote; voted:number; amended:boolean;
  canFraud:boolean; audit?:'clean' | 'fraud'; reportedFraud:boolean;
  election?:ElectionView; billQuorum:number;
  politics?:PoliticsView; auditNote?:string; hearing?:{target:string; voted:number; vote?:Vote}; hearingResult?:string;
  yes:Impact; no:Impact; outcome?:Outcome; winner?:Role; reason?:string; infiltratorName?:string;
};
