import { canInteract, type InteractionActor } from './interactions';
import type {ComplaintView} from './complaints';
import type {FireView} from './fire';
import type { GameplayView } from './gameplay';
import type { ElectionView } from './elections';
import type { PoliticsView } from './politics';
import { privateOffices } from './private-offices';
import { roomActivities } from './room-activities';

export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = privateOffices.length;
export const NEGOTIATION_MS = 205_000;
export const BALLOT_MS = 35_000;

export const stabilityRules = {initial:48,target:45,maximum:100,deficitRate:2} as const;

export function deficitStabilityLoss(deficit:number) {
  return -Math.round(-Math.max(0,deficit)*stabilityRules.deficitRate) || 0;
}

export const stations = {
  ...roomActivities,
  amendment: {x:129,y:365},
  audit: {x:808,y:93},
  panel: {x:548,y:620},
  press: {x:863,y:245},
  tv: {x:915,y:200},
} as const;
export type Station = keyof typeof stations;
export const STATION_RADIUS = 23;
export function canReachStation(player:InteractionActor, station:Station, radius=STATION_RADIUS) {
  return canInteract(player,stations[station],{radius,handsFree:true});
}
export const bills = [
  {name:'Auxílio Churrasco', description:'Cria um auxílio para financiar churrascos.', yes:{stability:22,budget:-28}, no:{stability:-14,budget:8},fireSafety:false},
  {name:'Wi-Fi na Praça', description:'Instala internet pública gratuita em praças.', yes:{stability:16,budget:-22}, no:{stability:-18,budget:6},fireSafety:false},
  {name:'Teto do Cafezinho', description:'Limita os gastos com cafezinho e aumenta o intervalo entre incêndios.', yes:{stability:-12,budget:23}, no:{stability:12,budget:-19},fireSafety:true},
] as const;

export const agendaProject = ({round,project}: {round:number;project?:number}) => bills[project ?? round%bills.length];

export type Impact = {stability:number; budget:number};
export type Role = 'Parlamentar' | 'Infiltrado';
export type VoteIntent = {id:string; name:string; vote:Vote};
export type Vote = 'yes' | 'no';
export type Phase = 'lobby' | 'negotiation' | 'ballot' | 'hearing' | 'finished';
export type Action = 'amendment' | 'audit' | 'panel' | 'fraud';
export type Outcome = {round:number; project?:number; passed:boolean; yes:number; no:number; needed:number; deficit:number; fraud:boolean; applied:Impact};
export type PlenaryView = {
  phase:Phase; round:number; project?:number; queuedProjects?:number[]; remaining:number; stability:number; budget:number; host?:string;
  role?:Role; mandate?:boolean; solo:boolean; players:number; minimumPlayers?:number; lobbyNpcCount?:number; electorate:number; voteIntents?:VoteIntent[]; vote?:Vote; voted:number; amended:boolean;
  canFraud:boolean; audit?:'clean' | 'fraud'; reportedFraud:boolean;
  election?:ElectionView; billQuorum:number;
  complaints?:ComplaintView; fire?:FireView; sabotageFireSite?:number; isolationSeconds?:number; gameplay?:GameplayView; politics?:PoliticsView; auditNote?:string; hearing?:{target:string; voted:number; vote?:Vote}; hearingResult?:string;
  yes:Impact; no:Impact; outcome?:Outcome; outcomes:Outcome[]; winner?:Role; reason?:string; infiltratorName?:string;
};

export function voteIntentSummary(intents:readonly VoteIntent[] = []) {
  return intents.map(({name,vote})=>`${name} ${vote==='yes' ? 'a favor' : 'contra'}`).join(' · ');
}
