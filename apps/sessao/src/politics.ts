export const CABINET_GRANT = 4;
export const CAMPAIGN_COST = 2;
export const HEARING_POPULARITY = 55;
export const HEARING_MS = 35_000;
export const TRADE_RADIUS = 44;
export const PAYMENTS_PER_ROUND = 6;
export const splits = [0,1,2,3] as const;
export type Split = typeof splits[number];

export const AGENDA_REWARD = 2;

export const agendas = {
  protocolo:'Protocole um documento com os carimbos e assinaturas pedidos.',
  entrega:'Entregue cafezinho a três jogadores diferentes.',
  sigilo:'Largue um objeto sem testemunhas.',
  joguinho:'Conclua uma rodada do joguinho sem testemunhas.',
  fotografia:'Tire uma foto com outro jogador visível.',
  flagra:'Peguei no flagra! Fotografe alguém com uma maleta exposta.',
  selfie:'Tire selfies com três parlamentares diferentes.',
  presidenteFoto:'Tire uma selfie com o presidente.',
  celularFoto:'Fotografe alguém jogando no celular na Antecâmara ou nas Comissões.',
  reuniaoFoto:'Fotografe dois colegas no mesmo gabinete ou na Antecâmara.',
  dossieFoto:'Fotografe o mesmo parlamentar em três ambientes diferentes.',
  apresentarFoto:'Mostre a alguém uma fotografia com um objeto exposto.',
  entregaFoto:'Fotografe dois colegas durante a entrega de um objeto exposto.',
  publicouSelfie:'Publique uma selfie sua com pelo menos dois colegas.',
  retrato:'Instale seu retrato no Congresso.',
  autorretrato:'Tire uma selfie ao lado do seu retrato.',
  reforma:'Substitua o retrato de outro parlamentar pelo seu.',
  reserva:'Reserve uma cadeira no Cafezinho com uma placa VIP.',
  fiscalVip:'Fotografe alguém na área VIP de outro parlamentar.',
  mandaVip:'Substitua a placa VIP de outro parlamentar pela sua.',
  fatias:'Sirva fatias de pizza a dois parlamentares diferentes.',
  pizzada:'Após um escândalo público, sirva uma pizza a três colegas.',

  gabinete: 'Instale um móvel de luxo no seu gabinete.',
  fortuna: 'Aumente sua carteira',
  campanha: 'Aumente sua popularidade',
  articulacao: 'Receba dinheiro de dois jogadores diferentes',
  projetos: 'Vote a favor de dois projetos aprovados',
  oposicao: 'Vote contra dois projetos rejeitados',
  cafe: 'Tome um cafezinho',
  leitura: 'Estude o projeto na Biblioteca',
  credencial: 'Confira sua credencial',
  auditoria: 'Faça uma auditoria na Controladoria',
  emenda: 'Apresente uma emenda no Protocolo',
  votacao: 'Vote em um projeto',
  escandalo: 'Divulgue uma prova de desvio ou pagamento clandestino',
} as const;
export type Agenda = keyof typeof agendas;
const caprichos = new Set<Agenda>(['selfie','presidenteFoto','retrato','autorretrato','reforma','reserva','mandaVip']);
export const missionReward = (kind:Agenda) => caprichos.has(kind) ? 0 : AGENDA_REWARD;
export type Mission = {id:number; kind:Agenda; current:number; target:number};
export const missionTitle = ({kind,target}:Mission) => kind==='fortuna' ? `Chegue a ${money(target)} na carteira` :
  kind==='campanha' ? `Chegue a ${target} de popularidade` : agendas[kind];
export type EvidenceKind = 'public-transfer' | 'clandestine-transfer' | 'diversion';
export type Evidence = {id:number; kind:EvidenceKind; from:string; to?:string; amount:number; round:number};
export type Offer = {id:number; evidence:number; from:string; to:string; price:number};
export type Contact = {id:string; name:string};
export type DirectoryContact = Contact & {character?:number};
export type PoliticsView = {
  wallet:number; walletIncome:number; popularity:number; missions:{active:Mission[]; completed:Mission[]; paid:boolean}; grantUsed:boolean;
  campaigned:boolean; suspended:boolean; canCallHearing:boolean;
  evidence:Evidence[]; ledger:Evidence[]; incoming:Offer[]; outgoing?:Offer;
  contacts:Contact[]; directory:(DirectoryContact & {popularity:number; eligible:boolean})[]; paymentsLeft:number;
};
export type PoliticsAction =
  | {kind:'grant'; diverted:Split}
  | {kind:'campaign'}
  | {kind:'transfer'; to:string; amount:number; clandestine:boolean}
  | {kind:'share'; to:string; evidence:number; price:number}
  | {kind:'publish'; evidence:number}
  | {kind:'accept' | 'cancel'; offer:number}
  | {kind:'hearing'; target:string};

export const money = (units:number) => `R$ ${units*10} mil`;

export function readPoliticsAction(data:unknown): PoliticsAction | undefined {
  if (!data || typeof data!=='object' || !('kind' in data)) return;
  const integer = (n:unknown, min=1) => typeof n==='number' && Number.isSafeInteger(n) && n>=min;
  switch (data.kind) {
    case 'grant':
      if ('diverted' in data && splits.includes(data.diverted as Split)) return {kind:'grant',diverted:data.diverted as Split};
      break;
    case 'campaign': return {kind:'campaign'};
    case 'transfer':
      if ('to' in data && typeof data.to==='string' && 'amount' in data && integer(data.amount) &&
          'clandestine' in data && typeof data.clandestine==='boolean') {
        return {kind:'transfer',to:data.to,amount:data.amount as number,clandestine:data.clandestine};
      }
      break;
    case 'share':
      if ('to' in data && typeof data.to==='string' && 'evidence' in data && integer(data.evidence) &&
          'price' in data && integer(data.price,0)) return {kind:'share',to:data.to,evidence:data.evidence as number,price:data.price as number};
      break;
    case 'publish':
      if ('evidence' in data && integer(data.evidence)) return {kind:'publish',evidence:data.evidence as number};
      break;
    case 'accept':
    case 'cancel':
      if ('offer' in data && integer(data.offer)) return {kind:data.kind,offer:data.offer as number};
      break;
    case 'hearing':
      if ('target' in data && typeof data.target==='string') return {kind:'hearing',target:data.target};
  }
}
