import { canInteract, type InteractionActor } from './interactions';
import type {ComplaintView} from './complaints';
import {powerRules,type PowerView} from './power';
import {ELECTION_RULES} from './elections';
import {money} from './politics';
import type {FireInteraction,FireView} from './fire';
import type { GameplayView } from './gameplay';
import type { ElectionView } from './elections';
import type { PoliticsView } from './politics';
import { privateOffices } from './private-offices';
import {npcs,treasurer} from './npcs';
import { roomActivities } from './room-activities';

export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = privateOffices.length;
export const projectRules = {debateMs:120_000, cooldownMs:60_000, warningSeconds:30, requiredVotes:3} as const;
export const NEGOTIATION_MS = projectRules.debateMs;
export const majorityQuorum = (electorate:number) => Math.floor(electorate/2)+1;
export const BALLOT_MS = 35_000;
export const CASSATION_NOTICE_MS = 30_000;

export const stabilityRules = {initial:48,target:45,maximum:100,deficitRate:2} as const;

export function deficitStabilityLoss(deficit:number) {
  return -Math.round(-Math.max(0,deficit)*stabilityRules.deficitRate) || 0;
}

export const stations = {
  ...roomActivities,
  cabinet:treasurer.interaction,
  secretary:npcs.secretary.interaction,
  archive:{x:549,y:90},
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
export type BillPolicy = 'recovery'|'coffee'|'furniture'|'equipment'|'mail'|'hearing'|'campaign'|'energySavings'|'bankAudit';
export const hearingPolicyFee = 2;
export const bankAuditFee = 1;
export const campaignPolicyMultiplier = 2;
export const policyDiscountPercent = 40;
export const recoveryPolicy = {hpPerTick:2,tickMs:1_000} as const;
export const treasuryPolicy = {duration:90_000,bonus:2} as const;
export const pingaProgram = {
  doseCost:.5,
  detail:'Uma dose por mandato ativo e conectado, se houver orçamento para toda a distribuição',
} as const;
export const energySavings = {
  duration:ELECTION_RULES.interval, publicDutyDiscount:2, sabotageCooldown:powerRules.cooldownMs/3,
} as const;
export const policyDuration = 120_000;
const policySeconds = policyDuration/1_000;
export type BillPolicies = Partial<Record<BillPolicy,number>>;
export const bankAuditCost = (policies?:BillPolicies) => policies?.bankAudit!==undefined ? bankAuditFee : 0;

type Bill = {
  id:string; name:string; banner?:string; description:string; yes:Impact; no:Impact;
  effect?:{kind:'policy';policy:BillPolicy;detail:string;duration?:number}|{kind:'pinga-distribution'}|{kind:'fire-safety'}|{kind:'allowance';perMandate:number}|{kind:'treasury-reputation';duration:number;bonus:number};
};

export const bills:readonly Bill[] = [
  {id:'auxilio-churrasco',banner:'banner-auxilio-churrasco.webp',name:'Auxílio Churrasco', description:'Cria um auxílio para financiar churrascos.', yes:{stability:22,budget:-28}, no:{stability:-14,budget:8}},
  {id:'wifi-na-praca',name:'Wi-Fi na Praça', description:'Instala internet pública gratuita em praças.', yes:{stability:16,budget:-22}, no:{stability:-18,budget:6}},
  {id:'teto-do-cafezinho',banner:'retrato-cafezinho.webp',name:'Teto do Cafezinho', description:'Limita os gastos com cafezinho e aumenta o intervalo entre incêndios.', yes:{stability:-12,budget:23}, no:{stability:12,budget:-19},effect:{kind:'fire-safety'}},
  {id:'PROJ-N04',name:'Auxílio Home Office Presencial',banner:'gabinete-armario.webp',
    description:'Quem veio ao Congresso recebe ajuda de custo por trabalhar de casa.',
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'allowance',perMandate:1}},
  {id:'PROJ-N10',name:'Programa Nacional de Extintores',banner:'extintor.webp',
    description:'Compra tempo entre incêndios até o fim da partida.',
    yes:{stability:0,budget:-3},no:{stability:0,budget:0},effect:{kind:'fire-safety'}},
  {id:'PROJ-N13',name:'PEC da Autopremiação',banner:'retrato-maleta.webp',
    description:'O Congresso agradece ao Congresso pelos serviços prestados ao Congresso.',
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'allowance',perMandate:2}},
  {id:'PROJ-N17',name:'Mutirão de Regularização Patrimonial',banner:'gabinete-cofre.webp',
    description:`Por ${treasuryPolicy.duration/1_000} segundos, cada entrega à Tesouraria rende até ${treasuryPolicy.bonus} pontos extras de popularidade.`,
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'treasury-reputation',...treasuryPolicy}},
  {id:'PROJ-N03',name:'Bolsa Churrasco',banner:'retrato-picanha.webp',
    description:'Uma rodada de churrasco para recompor as forças parlamentares.',
    yes:{stability:0,budget:-4},no:{stability:0,budget:0},effect:{kind:'policy',policy:'recovery',detail:`Parlamentares ativos recuperam ${recoveryPolicy.hpPerTick} PV a cada ${recoveryPolicy.tickMs/1_000} s durante ${policySeconds} s, se houver verba`}},
  {id:'PROJ-N05',name:'Lei do Cafezinho Ininterrupto',banner:'retrato-cafezinho.webp',
    description:'O cafezinho ganhou desconto na Lanchonete.',
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'policy',policy:'coffee',detail:`Café com ${policyDiscountPercent}% de desconto na Lanchonete por ${policySeconds} s, enquanto houver orçamento`}},
  {id:'PROJ-N06',name:'PEC do Foro Ultra-Privilegiado',banner:'gabinete-cofre.webp',
    description:`Convocar afastamento ou cassação custa ${money(hearingPolicyFee)} por ${policySeconds} s.`,
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'policy',policy:'hearing',detail:`Taxa de convocação de ${money(hearingPolicyFee)} por ${policySeconds} s`}},
  {id:'PROJ-N07',name:'Minha Mansão, Minha Vida',banner:'gabinete-armario.webp',
    description:'Verba para dar um trato nos gabinetes.',
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'policy',policy:'furniture',detail:`Móveis com ${policyDiscountPercent}% de desconto por ${policySeconds} s, enquanto houver orçamento`}},
  {id:'PROJ-N12',name:'Dia Nacional do Nada',banner:'gabinete-armario.webp',
    description:'Um pequeno prêmio por um dia de produção legislativa rigorosamente nula.',
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'allowance',perMandate:.5}},
  {id:'PROJ-N15',name:'Programa de Inclusão Digital Parlamentar',banner:'retrato-binoculo.webp',
    description:'Apoio Técnico com desconto nos equipamentos.',
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'policy',policy:'equipment',detail:`Equipamentos e grampos com ${policyDiscountPercent}% de desconto por ${policySeconds} s, enquanto houver orçamento`}},
  {id:'PROJ-N16',name:'Semana da Transparência',banner:'retrato-kit-pericia.webp',
    description:'Os custos do Correio Interno e dos kits de perícia entram em promoção.',
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'policy',policy:'mail',detail:`Comunicados e kits de perícia com ${policyDiscountPercent}% de desconto por ${policySeconds} s`}},
  {id:'PROJ-N09',name:'PEC da Reeleição Infinita',banner:'retrato-documento.webp',
    description:`A propaganda paga passa a ter peso ${campaignPolicyMultiplier}× na disputa durante a vigência da PEC.`,
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'policy',policy:'campaign',detail:`Propagandas eleitorais têm peso ${campaignPolicyMultiplier}× na pesquisa e na apuração por ${policySeconds} s`}},
  {id:'PROJ-N08',name:'Lei da Transparência Seletiva',banner:'gabinete-cofre.webp',
    description:'A Corregedoria ganha uma taxa para consultar transferências sigilosas.',
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'policy',policy:'bankAudit',
      detail:`Investigar uma transferência sigilosa custa ${money(bankAuditFee)} por ${policySeconds} s`}},
  {id:'PROJ-N11',name:'Lei da Economia de Energia',banner:'banner-economia-energia.webp',
    description:'Corta a verba de manutenção da rede elétrica.',
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'policy',policy:'energySavings',duration:energySavings.duration,
      detail:`Por ${energySavings.duration/1000} s, o custeio cai R$ ${energySavings.publicDutyDiscount*10} mil e o corte de energia recarrega em ${energySavings.sabotageCooldown/1000} s`}},
  {id:'PROJ-N02',name:'Minha Pinga, Minha Vida',banner:'retrato-pinga.webp',
    description:'Financia uma dose de cachaça para cada mandato ativo.',
    yes:{stability:0,budget:0},no:{stability:0,budget:0},effect:{kind:'pinga-distribution'}},
];

export const agendaProject = ({round,project}: {round:number;project?:number}) => bills[project ?? round%bills.length];

export type Impact = {stability:number; budget:number};
export type Role = 'Parlamentar' | 'Infiltrado';
export type VoteIntent = {id:string; name:string; vote:Vote};
export type Vote = 'yes' | 'no';
export type BillVote = Vote | 'abstain';
export type BillVoter = Omit<SessionParticipant,'role'> & {vote?:BillVote};
export type CassationView = {candidates:Omit<SessionParticipant,'role'>[]; eligible:boolean; voted:number; electorate:number; quorum:number; choice?:string|null};
export type Phase = 'lobby' | 'negotiation' | 'ballot' | 'hearing' | 'finished';
export type Action = 'amendment' | 'audit' | 'panel' | 'fraud';
export type Outcome = {round:number; project?:number; proposer?:string; passed:boolean; yes:number; no:number; abstentions?:number; absences?:number; needed:number; deficit:number; fraud:boolean; applied:Impact};
export type SessionParticipant = {id:string; name:string; character:number; role:Role};

export type PlenaryView = {
  ballotCountdown?: number;
  megaphoneActive?:true;
  phase:Phase; round:number; project?:number; proposer?:string; protocolCooldown?:number; remaining:number; stability:number; budget:number; host?:string;
  role?:Role; mandate?:boolean; solo:boolean; players:number; minimumPlayers?:number; lobbyNpcCount?:number; electorate:number; voteIntents?:VoteIntent[]; vote?:BillVote; billVoters?:BillVoter[]; voted:number; amended:boolean;
  canFraud:boolean; audit?:'clean' | 'fraud'; reportedFraud:boolean;
  election?:ElectionView; billQuorum:number;
  outage?:PowerView; canSabotagePower?:boolean;
  complaints?:ComplaintView; fire?:FireView; fireInteraction?:FireInteraction; isolationSeconds?:number; gameplay?:GameplayView; politics?:PoliticsView; auditNote?:string; hearing?:{target:string; voted:number; quorum?:number; vote?:Vote}; hearingResult?:string; canCallCassation?:boolean; cassationIn?:number; cassation?:CassationView; cassationResult?:{text:string};
  policies?:BillPolicies; yes:Impact; no:Impact; outcome?:Outcome; outcomes:Outcome[]; winner?:Role; reason?:string; infiltratorName?:string; finalRoster?:readonly SessionParticipant[];
};

export function voteIntentSummary(intents:readonly VoteIntent[] = []) {
  return intents.map(({name,vote})=>`${name} ${vote==='yes' ? 'a favor' : 'contra'}`).join(' · ');
}
