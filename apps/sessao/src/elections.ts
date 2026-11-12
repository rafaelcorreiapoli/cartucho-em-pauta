export const offices = {
  president: {name:'Presidente',salary:10,power:'No Painel, pode contestar um projeto por mandato. O Congresso pode derrubar a objeção com um voto a mais.'},
  senator: {name:'Senador',salary:6,power:'Pode encontrar até dois documentos por rodada na Controladoria.'},
  deputy: {name:'Deputado',salary:4,power:'Pode aplicar a verba pública no Gabinete B e negociar emendas no Protocolo.'},
} as const;
export type Office = keyof typeof offices;
export const officeKeys = Object.keys(offices) as Office[];
export const ELECTION_RULES = {
  interval:300_000, registrationLock:20_000, investmentCap:8, advertisementCost:2,
  interviewLength:15_000, interviewGap:15_000,
} as const;
export type ElectionAction =
  | {kind:'run'; office:Office}
  | {kind:'invest'; amount:number}
  | {kind:'support'; to:string}
  | {kind:'advertise' | 'speech' | 'interview' | 'object'};

export type Assignment = {id:string; name:string; office:Office};
export type Poll = {id:string; name:string; race:Office; estimate:number; trend:number; supports?:string};
export type ElectionView = {
  cycle:number; remaining:number; registrationOpen:boolean;
  offices:Assignment[]; polls:Poll[];
  personal?:{office:Office; race:Office; invested:number; advertised:boolean; spoke:boolean; interviewed:boolean; salary:number};
  result?:{cycle:number; offices:Assignment[]; previous?:Office; salary:number};
  broadcast?:{id:string; name:string; remaining:number};
  notice?:{seq:number; text:string};
  objection?:string;
  canObject:boolean;
  canCampaign:boolean; canInterview:boolean;
};

export function readElectionAction(raw:unknown):ElectionAction|undefined {
  if (!raw || typeof raw!=='object' || !('kind' in raw)) return;
  switch (raw.kind) {
    case 'run':
      if ('office' in raw && officeKeys.includes(raw.office as Office)) return {kind:'run',office:raw.office as Office};
      break;
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
