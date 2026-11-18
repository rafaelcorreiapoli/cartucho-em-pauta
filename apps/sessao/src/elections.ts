export const offices = {
  president: {name:'Presidente',salary:10,power:'No Painel, pode contestar um projeto por mandato. O Congresso pode derrubar a objeção com um voto a mais.'},
  senator: {name:'Senador',salary:6,power:'Pode encontrar até dois documentos por rodada na Corregedoria.'},
  deputy: {name:'Deputado',salary:4,power:'Pode aplicar a verba pública na Tesouraria.'},
} as const;
export type Office = keyof typeof offices;
export const officeKeys = Object.keys(offices) as Office[];
export const ELECTION_RULES = {
  interval:180_000, cycles:3, matchDuration:600_000, minimumMandates:3, startingBudget:32, publicDuty:6, treasuryReputationCap:4, advertisementCost:2,
  interviewLength:15_000, interviewGap:15_000,
} as const;
export const advertisements = {
  spot:{name:'Spot eleitoral',cost:ELECTION_RULES.advertisementCost,popularity:5},
  feature:{name:'Inserção em horário nobre',cost:4,popularity:8},
  special:{name:'Especial de campanha',cost:6,popularity:12},
} as const;
export type Advertisement = keyof typeof advertisements;

export type ElectionAction =
  | {kind:'advertise'; advertisement?:Advertisement}
  | {kind:'speech' | 'interview' | 'object'};

export type CampaignAdvertisement = {name:string; character:number; number:number};
export type CampaignBroadcast = CampaignAdvertisement & {advertiserId:string};

export type Assignment = {id:string; name:string; office:Office};
export type Elected = Assignment & {character:number; race:Office; percentage:number};
export type Poll = {id:string; name:string; character:number; race:Office; estimate:number; trend:number};
export type ElectionView = {
  cycle:number; remaining:number;
  offices:Assignment[]; polls:Poll[];
  personal?:{office:Office; race:Office; advertised:boolean; spoke:boolean; interviewed:boolean; lost?:boolean};
  result?:{cycle:number; offices:Elected[]; eliminated?:string};
  broadcast?:{id:string; name:string; remaining:number};
  notice?:{seq:number; text:string};
  objection?:string;
  canObject:boolean;
  mandate?:boolean; canCampaign:boolean; canInterview:boolean;
};

export function readElectionAction(raw:unknown):ElectionAction|undefined {
  if (!raw || typeof raw!=='object' || !('kind' in raw)) return;
  switch (raw.kind) {
    case 'advertise':
      if (!('advertisement' in raw)) return {kind:'advertise'};
      if (typeof raw.advertisement==='string' && Object.hasOwn(advertisements,raw.advertisement)) {
        return {kind:'advertise',advertisement:raw.advertisement as Advertisement};
      }
      break;
    case 'speech':
    case 'interview':
    case 'object': return {kind:raw.kind};
  }
}
