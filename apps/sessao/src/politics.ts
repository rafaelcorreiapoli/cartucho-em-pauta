import type { Progression } from './progression';
import { SNAKE_GOAL } from './snake';

export const CABINET_GRANT = 4;
export const HEARING_POPULARITY = 55;
export const CASSATION_POPULARITY = 40;
export const HEARING_MS = 35_000;
export const SUSPENSION_MS = 60_000;
export const HEARING_IMMUNITY_MS = 120_000;
export const TRADE_RADIUS = 44;
export const PAYMENTS_PER_ROUND = 6;
export const splits = [0,1,2,3] as const;
export type Split = typeof splits[number];

export const AGENDA_REWARD = 2;
export const AGENDA_TRANSFER_MIN = 3;
export const TARGET_TRANSFER_AMOUNT = 1;
export const CAMPAIGN_SPENDING_TARGET = 5;
export const CRISIS_MISSION_STABILITY_LIMIT = 30;
export const NEW_PORTRAIT_MS = 60_000;
export const CASH_HANDOVER_MISSION_AMOUNT = 2;
export const PIX_MISSION_AMOUNT = 2;
export const COFFEE_DELIVERY_RECIPIENTS = 3;
export const PUBLIC_MEETING_PEERS = 3;
export const LATE_CAMPAIGN_WINDOW_MS = 60_000;
export const SAVINGS_MISSION_AMOUNT = 10;
export const agendaCashTargets = {
  ostentacao:5, contribuinte:5, reservaCofre:5,
} as const;
export const money = (units:number) => `R$ ${Math.round(units*10)} mil`;

export const targetedAgendas = {
  documentoAlvo:'Entregue um documento a',
  assinaturaAlvo:'Consiga uma assinatura de',
  pizzaAlvo:'Entregue uma pizza a',
  dinheiroAlvo:`Transfira ${money(TARGET_TRANSFER_AMOUNT)} para`,
  visitaAlvo:'Visite o gabinete de',
  visitaCortesia:'Interaja dentro do gabinete de',
  selfieAlvo:'Tire uma selfie com',
} as const;
export const archiveDutyRoom = 'Arquivo';
export const urgentCallMission = {minCallMs:10_000,contacts:2} as const;
export const agendaDurationMs = {jogar:30_000,jogarOculto:30_000,pausaCafe:30_000,plantaoArquivo:30_000,trabalhoRemoto:30_000,produtividade:30_000,debateTelefonico:20_000,discursoMegafone:10_000,reuniaoGabinete:15_000,reuniaoPublica:10_000,escutaAtiva:15_000,nadaADeclarar:15_000,segurancaParlamentar:10_000,reuniaoVip:15_000} as const;

export const agendaCounts = {
  assinaturas:2, comissaoImprovisada:3, passeio:3, articulacao:2, projetos:2, oposicao:2,
  fiscalCafe:3, turismo:3, tresSelfies:3, vigilanciaInstitucional:2, duasCameras:2,
  visitaDoisGabinetes:2, doisPix:2, doisMoveis:2, bandejaGourmet:2,
} as const;

export const photoMissionCounts = {
  selfie:3, reuniaoFoto:2, dossieFoto:3, publicouSelfie:2, fatias:2, pizzada:3,
} as const;

const countWord = (count:number,feminine=false) => count===2 ? feminine ? 'duas' : 'dois' : count===3 ? 'três' : String(count);

export const agendas = {
  ...targetedAgendas,
  protocolo:'Protocole um documento válido',
  rouboNpc:'Roube a carteira de um parlamentar NPC',
  votoNpc:'Compre um voto de um parlamentar NPC',
  embolso:'Embolse uma maleta no seu cofre',
  recebido:'Receba dinheiro de outro parlamentar',
  pagamento:'Faça uma transferência',
  assinaturas:`Consiga ${countWord(agendaCounts.assinaturas,true)} assinaturas no mesmo documento`,
  assinar:'Assine o documento de um colega',
  apoio:'Registre um voto a favor',
  propaganda:'Coloque propaganda no ar',
  discurso:'Discurse no Painel do Plenário',
  transporte:'Leve uma maleta ao seu gabinete',
  equipamento:'Compre um binóculo no Apoio Técnico',
  visitaArquivo:'Visite o Arquivo',
  pizza:'Coma uma pizza ou pegue uma fatia no Cafezinho',
  lagosta:'Coma uma lagosta',
  comprarLagosta:'Compre uma lagosta',
  bombom:'Coma uma caixa de bombom',
  jogar:`Jogue no celular por ${agendaDurationMs.jogar/1000} segundos`,
  jogarOculto:`Jogue ${agendaDurationMs.jogarOculto/1000} segundos no celular sem ser visto`,
  selfieSolo:'Tire uma selfie',
  retratoGabinete:'Instale seu retrato no gabinete',
  poltrona:'Compre uma poltrona',
  ostentacao:`Gaste ${money(agendaCashTargets.ostentacao)} em móveis`,
  visitaGabinete:'Visite o gabinete de um colega',
  passeio:`Visite ${countWord(agendaCounts.passeio,true)} salas públicas diferentes`,
  pausaCafe:`Passe ${agendaDurationMs.pausaCafe/1000} segundos no Cafezinho durante a articulação`,
  entrega:`Entregue cafezinho a ${COFFEE_DELIVERY_RECIPIENTS} jogadores diferentes.`,
  sigilo:'Largue um objeto sem testemunhas.',
  joguinho:`Vença uma partida de Snake coletando ${SNAKE_GOAL} frutas sem ser visto durante a partida.`,
  fotografia:'Tire uma foto com outro jogador visível.',
  flagra:'Peguei no flagra! Fotografe alguém com uma maleta exposta.',
  selfie:`Tire selfies com ${countWord(photoMissionCounts.selfie)} parlamentares diferentes.`,
  presidenteFoto:'Tire uma selfie com o presidente.',
  celularFoto:'Fotografe alguém jogando no celular na Antecâmara ou na Sala de Segurança.',
  reuniaoFoto:`Fotografe ${countWord(photoMissionCounts.reuniaoFoto)} colegas no mesmo gabinete ou na Antecâmara.`,
  dossieFoto:`Fotografe o mesmo parlamentar em ${countWord(photoMissionCounts.dossieFoto)} ambientes diferentes.`,
  apresentarFoto:'Mostre a alguém uma fotografia com um objeto exposto.',
  entregaFoto:'Fotografe dois colegas durante a entrega de um objeto exposto.',
  publicouSelfie:`Publique uma selfie sua com pelo menos ${countWord(photoMissionCounts.publicouSelfie)} colegas.`,
  retrato:'Instale seu retrato no Congresso.',
  autorretrato:'Tire uma selfie ao lado do seu retrato.',
  cerimonialOficial:'Tire uma selfie perto de um Retrato Oficial instalado',
  reforma:'Substitua o retrato de outro parlamentar pelo seu.',
  reserva:'Reserve uma cadeira no Congresso com uma Placa VIP.',
  fiscalVip:'Fotografe um visitante na área VIP de outro parlamentar.',
  mandaVip:'Substitua a placa VIP de outro parlamentar pela sua.',
  fatias:`Sirva fatias de pizza a ${countWord(photoMissionCounts.fatias)} parlamentares diferentes.`,
  pizzada:`Após um escândalo público, sirva uma pizza a ${countWord(photoMissionCounts.pizzada)} colegas.`,

  gabinete: 'Instale um móvel de luxo no seu gabinete.',
  televisao:'Instale uma TV no seu gabinete',
  fortuna: 'Aumente sua carteira',
  poupancaInstitucional:`Aumente sua carteira em ${money(SAVINGS_MISSION_AMOUNT)}`,
  campanha: 'Aumente sua popularidade',
  articulacao: `Receba dinheiro de ${countWord(agendaCounts.articulacao)} jogadores diferentes`,
  projetos: `Vote a favor de ${countWord(agendaCounts.projetos)} projetos aprovados`,
  oposicao: `Vote contra ${countWord(agendaCounts.oposicao)} projetos rejeitados`,
  cafe: 'Tome um cafezinho',
  leitura: 'Estude o projeto na Biblioteca',
  auditoria: 'Faça uma auditoria na Corregedoria',
  emenda: 'Apresente uma emenda no Protocolo',
  votacao: 'Vote em um projeto',
  escandalo: 'Divulgue uma prova de desvio ou pagamento clandestino',
  plantaoArquivo:`Fique ${agendaDurationMs.plantaoArquivo/1000} segundos seguidos no ${archiveDutyRoom}`,
  solenidadeInauguracao:`Rabisque um Retrato Oficial de outro jogador instalado há até ${NEW_PORTRAIT_MS/1000} segundos`,
  amizadeInstitucional:'Entregue um item a outro jogador e receba dele um item diferente',
  privilegioAdquirido:'Instale uma Placa VIP',
  trabalhoRemoto:`Passe ${agendaDurationMs.trabalhoRemoto/1000} segundos no seu gabinete`,
  produtividade:`Jogue no celular por ${agendaDurationMs.produtividade/1000} segundos no seu gabinete`,
  cafeEstrategico:'Beba um café no Cafezinho',
  contasTesouraria:'Entregue uma maleta à Tesouraria',
  contribuinte:`Contribua com ${money(agendaCashTargets.contribuinte)} à Tesouraria`,
  registroHistorico:'Tire uma selfie no Plenário',
  jornalismo:'Publique uma foto pelo Correio Interno',
  manutencaoEmergencia:'Conclua o reparo de uma pane elétrica junto a outro jogador',
  apagarIncendio:'Apague um incêndio com o extintor',
  primeirosSocorros:'Recupere PV com um Kit Médico',
  socorro:'Socorra um jogador nocauteado',
  fiscalCafe:`Beba ${countWord(agendaCounts.fiscalCafe)} cafés`,
  almocoPlenario:'Coma uma pizza no Plenário',
  nadaADeclarar:`Transporte dinheiro oculto por ${agendaDurationMs.nadaADeclarar/1000} segundos`,
  cuecaDinheiro:'Use a Cueca do Mensalão carregando dinheiro',
  reservaCofre:`Embolse ${money(agendaCashTargets.reservaCofre)} no seu cofre`,
  turismo:`Tire fotos em ${countWord(agendaCounts.turismo,true)} salas diferentes`,
  comissaoImprovisada:`Consiga ${countWord(agendaCounts.comissaoImprovisada,true)} assinaturas no mesmo documento`,
  flagraGabinete:'Fotografe um visitante dentro de um gabinete',
  presencaPlenario:'Entre e saia do Plenário durante a articulação',
  reuniaoGabinete:`Passe ${agendaDurationMs.reuniaoGabinete/1000} segundos no mesmo gabinete que outro jogador`,
  reuniaoPublica:`Passe ${agendaDurationMs.reuniaoPublica/1000} segundos em uma sala pública com outros ${PUBLIC_MEETING_PEERS} jogadores`,
  tresSelfies:`Tire selfies em ${countWord(agendaCounts.tresSelfies,true)} salas públicas diferentes`,
  plantaoEmergencia:'Apague um incêndio ou ajude no reparo elétrico dentro da sala afetada',
  heroiInesperado:`Ajude a resolver uma crise com Estabilidade abaixo de ${CRISIS_MISSION_STABILITY_LIMIT}`,
  varredura:'Encontre um dispositivo clandestino com o Detector de Escutas',
  limpeza:'Remova um dispositivo clandestino descoberto',
  fiscalizacaoParalela:'Revele o saldo do cofre de outro parlamentar com o Raio X',
  patrimonioSuspeito:'Revele o saldo de um parlamentar NPC com o Raio X',
  reuniaoVip:`Fique ${agendaDurationMs.reuniaoVip/1000} segundos com outro parlamentar perto de uma Placa VIP instalada`,
  segurancaParlamentar:`Fique ${agendaDurationMs.segurancaParlamentar/1000} segundos perto do mesmo parlamentar com um Porrete equipado, sem atacar`,
  escutaAtiva:`Monitore um grampo por ${agendaDurationMs.escutaAtiva/1000} segundos`,
  instalarGrampo:'Instale um grampo em um esconderijo',
  vigilanciaInstitucional:`Consulte ${countWord(agendaCounts.vigilanciaInstitucional,true)} câmeras diferentes na Sala de Segurança`,
  duasCameras:`Consulte ${countWord(agendaCounts.duasCameras,true)} câmeras escondidas próprias`,
  instalarCamera:'Instale uma câmera escondida',
  mensagemComAnexo:'Publique um comunicado com anexo',
  retratacaoOficial:'Publique um Laudo de Perícia',
  fotoOstentacao:'Fotografe um móvel de luxo instalado',
  fotoDinheiro:'Fotografe alguém com dinheiro exposto',
  doisMoveis:`Instale ${countWord(agendaCounts.doisMoveis)} móveis diferentes no seu gabinete`,
  visitaDoisGabinetes:`Visite gabinetes de ${countWord(agendaCounts.visitaDoisGabinetes)} colegas diferentes`,
  recolhimentoExtraordinario:'Roube uma maleta de um NPC e entregue parte dela à Tesouraria',
  dinheiroPresencialVinte:`Entregue ${money(CASH_HANDOVER_MISSION_AMOUNT)} em espécie a outro jogador`,
  caixaDois:'Receba dinheiro em espécie de outro jogador',
  pixVinte:`Envie um Pix de ${money(PIX_MISSION_AMOUNT)}`,
  doisPix:`Receba Pix de ${countWord(agendaCounts.doisPix)} jogadores distintos`,
  debateTelefonico:`Fique ${agendaDurationMs.debateTelefonico/1000} segundos na mesma chamada durante a articulação`,
  chamadasUrgentes:`Faça chamadas de ${urgentCallMission.minCallMs/1000} segundos com ${urgentCallMission.contacts} colegas diferentes`,
  discursoMegafone:`Use o Megafone por ${agendaDurationMs.discursoMegafone/1000} segundos`,
  investimentoPolitico:`Gaste pelo menos ${money(CAMPAIGN_SPENDING_TARGET)} em propaganda eleitoral`,
  campanhaUltimaHora:`Veicule propaganda nos últimos ${LATE_CAMPAIGN_WINDOW_MS/1000} segundos antes da eleição`,
  bandejaGourmet:`Consuma ${countWord(agendaCounts.bandejaGourmet)} alimentos diferentes no seu gabinete`,
  provaDocumental:'Fotografe um documento físico visível',
} as const;
export type Agenda = keyof typeof agendas;
export type MissionReward = {xp:number; cash?:number; popularity?:number};

const xpOnly:Partial<Record<Agenda,number>> = {
  plantaoArquivo:25,privilegioAdquirido:25,amizadeInstitucional:35,solenidadeInauguracao:30,
  trabalhoRemoto:25,produtividade:35,cafeEstrategico:25,contasTesouraria:40,contribuinte:45,registroHistorico:30,
  comissaoImprovisada:65,flagraGabinete:45,presencaPlenario:25,reuniaoGabinete:35,reuniaoPublica:45,tresSelfies:35,plantaoEmergencia:45,heroiInesperado:55,
  reuniaoVip:40,segurancaParlamentar:40,fiscalizacaoParalela:35,patrimonioSuspeito:30,varredura:35,limpeza:40,escutaAtiva:35,instalarGrampo:35,instalarCamera:35,duasCameras:30,vigilanciaInstitucional:25,mensagemComAnexo:35,retratacaoOficial:45,fotoOstentacao:30,fotoDinheiro:35,doisMoveis:45,
  poupancaInstitucional:50,recolhimentoExtraordinario:60,dinheiroPresencialVinte:35,caixaDois:25,visitaDoisGabinetes:35,pixVinte:25,doisPix:30,debateTelefonico:35,chamadasUrgentes:45,discursoMegafone:35,campanhaUltimaHora:30,investimentoPolitico:50,bandejaGourmet:35,
  nadaADeclarar:45,cuecaDinheiro:35,reservaCofre:40,turismo:35,provaDocumental:25,
  jornalismo:30,manutencaoEmergencia:45,apagarIncendio:45,primeirosSocorros:25,socorro:40,fiscalCafe:30,almocoPlenario:30,
  cafe:20,pizza:20,lagosta:30,comprarLagosta:25,bombom:20,jogar:35,jogarOculto:45,
  selfieSolo:20,retratoGabinete:30,poltrona:25,ostentacao:35,gabinete:30,televisao:30,
  visitaGabinete:25,passeio:35,pausaCafe:20,joguinho:35,selfie:35,presidenteFoto:30,
  retrato:25,autorretrato:25,cerimonialOficial:25,reforma:35,reserva:25,mandaVip:30,
};
const rewardOverrides:Partial<Record<Agenda,MissionReward>> = {
  embolso:{xp:40,cash:AGENDA_REWARD},
  assinaturas:{xp:60,cash:AGENDA_REWARD},
  protocolo:{xp:50,popularity:5},
  pagamento:{xp:30,cash:AGENDA_REWARD},
};
export const missionReward = (kind:Agenda):MissionReward =>
  rewardOverrides[kind] ?? (xpOnly[kind] ? {xp:xpOnly[kind]} : {xp:30,cash:AGENDA_REWARD});
export const timedAgendas = new Set<Agenda>(Object.keys(agendaDurationMs) as (keyof typeof agendaDurationMs)[]);
export type Mission = {id:number; kind:Agenda; current:number; target:number; person?:Contact};
export const missionTitle = ({kind,target,person}:Mission) => person ? `${agendas[kind]} ${person.name}${kind==='visitaCortesia' ? ' (por exemplo, tire uma foto)' : ''}` : kind==='fortuna' ? `Chegue a ${money(target)} na carteira` :
  kind==='campanha' ? `Chegue a ${target} de popularidade` : kind==='pagamento' ? `Transfira pelo menos ${money(AGENDA_TRANSFER_MIN)}` : agendas[kind];
export type EvidenceKind = 'public-transfer' | 'clandestine-transfer' | 'diversion';
export type Evidence = {id:number; kind:EvidenceKind; from:string; to?:string; amount:number; round:number};
export type Offer = {id:number; evidence:number; from:string; to:string; price:number};
export type Contact = {id:string; name:string};
export type DirectoryContact = Contact & {character?:number};
export type PoliticsView = {
  progression:Progression;
  wallet:number; walletIncome:number; popularity:number; missions:{active:Mission[]; completed:Mission[]}; grantUsed:boolean;
  suspended:boolean; canCallHearing:boolean;
  evidence:Evidence[]; ledger:Evidence[]; incoming:Offer[]; outgoing?:Offer;
  contacts:Contact[]; directory:(DirectoryContact & {popularity:number; eligible:boolean; pixAvailable?:boolean})[]; paymentsLeft:number;
};
export type PoliticsAction =
  | {kind:'grant'; diverted:Split}
  | {kind:'transfer'; to:string; amount:number}
  | {kind:'share'; to:string; evidence:number; price:number}
  | {kind:'publish'; evidence:number}
  | {kind:'accept' | 'cancel'; offer:number}
  | {kind:'hearing'; target:string}
  | {kind:'call-cassation'};


export function readPoliticsAction(data:unknown): PoliticsAction | undefined {
  if (!data || typeof data!=='object' || !('kind' in data)) return;
  const integer = (n:unknown, min=1) => typeof n==='number' && Number.isSafeInteger(n) && n>=min;
  switch (data.kind) {
    case 'grant':
      if ('diverted' in data && splits.includes(data.diverted as Split)) return {kind:'grant',diverted:data.diverted as Split};
      break;
    case 'transfer':
      if ('to' in data && typeof data.to==='string' && 'amount' in data && canTransferAmount(data.amount)) {
        return {kind:'transfer',to:data.to,amount:data.amount};
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
    case 'call-cassation': return {kind:'call-cassation'};
    case 'hearing':
      if ('target' in data && typeof data.target==='string') return {kind:'hearing',target:data.target};
  }
}

export function canTransferAmount(amount:unknown,wallet=Infinity):amount is number {
  return typeof amount==='number' && Number.isSafeInteger(amount) && amount>0 && amount<=wallet;
}

export function manualTransfer(to:string,amount:number,wallet=Infinity,paymentsLeft=1):Extract<PoliticsAction,{kind:'transfer'}>|undefined {
  if (to && canTransferAmount(amount,wallet) && paymentsLeft>0) return {kind:'transfer',to,amount};
}


export function describeEvidence(record:Evidence, name:(id:string)=>string) {
  if (record.kind==='diversion') return `${name(record.from)} desviou ${money(record.amount)} da verba do gabinete.`;
  return `${name(record.from)} → ${name(record.to!)} · ${money(record.amount)} · pagamento ${record.kind==='public-transfer' ? 'público' : 'clandestino'}.`;
}
