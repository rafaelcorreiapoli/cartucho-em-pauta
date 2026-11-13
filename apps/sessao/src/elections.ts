export const offices = {
  president: {name:'Presidente',salary:10,power:'No Painel, pode contestar um projeto por mandato. O Congresso pode derrubar a objeção com um voto a mais.'},
  senator: {name:'Senador',salary:6,power:'Pode encontrar até dois documentos por rodada na Corregedoria.'},
  deputy: {name:'Deputado',salary:4,power:'Pode aplicar a verba pública no Gabinete B e negociar emendas no Protocolo.'},
} as const;
export type Office = keyof typeof offices;
export const officeKeys = Object.keys(offices) as Office[];
export const ELECTION_RULES = {
  interval:300_000, cycles:3, matchDuration:1_200_000, minimumMandates:3, startingBudget:32, salary:3, salaryShare:.4, publicDuty:6, publicDutyPenalty:6, treasuryReputationCap:4, investmentCap:8, advertisementCost:2,
  interviewLength:15_000, interviewGap:15_000,
} as const;
export type ElectionAction =
  | {kind:'invest'; amount:number}
  | {kind:'support'; to:string}
  | {kind:'advertise' | 'speech' | 'interview' | 'object'};

export type Assignment = {id:string; name:string; office:Office};
export type Elected = Assignment & {character:number; race:Office; percentage:number};
export type Poll = {id:string; name:string; character:number; race:Office; estimate:number; trend:number; supports?:string};
export type ElectionView = {
  cycle:number; remaining:number;
  offices:Assignment[]; polls:Poll[];
  personal?:{office:Office; race:Office; invested:number; advertised:boolean; spoke:boolean; interviewed:boolean; salary:number; lost?:boolean};
  result?:{cycle:number; offices:Elected[]; salary:number; eliminated?:string; expectedSalary?:number};
  broadcast?:{id:string; name:string; remaining:number};
  notice?:{seq:number; text:string};
  objection?:string;
  canObject:boolean;
  mandate?:boolean; canCampaign:boolean; canInterview:boolean;
};

export function readElectionAction(raw:unknown):ElectionAction|undefined {
  if (!raw || typeof raw!=='object' || !('kind' in raw)) return;
  switch (raw.kind) {
    case 'invest':
      if ('amount' in raw && Number.isSafeInteger(raw.amount) && Number(raw.amount)>0) return {kind:'invest',amount:Number(raw.amount)};
      break;
    case 'support':
      if ('to' in raw && typeof raw.to==='string') return {kind:'support',to:raw.to};
      break;
    case 'advertise':
    case 'speech':
    case 'interview':
    case 'object': return {kind:raw.kind};
  }
}
