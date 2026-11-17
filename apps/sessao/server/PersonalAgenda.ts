import {mailPublicationFee,marketProduct} from '../src/market-catalog';
import type {BillPolicies} from '../src/plenary';
import { firstAidKit } from '../src/medical';
import { inPlenary } from '../src/map';
import { credentialGoods } from '../src/installations';
import { foods } from '../src/food';
import { ELECTION_RULES } from '../src/elections';
import { isOfficeFurniture, officeFurniture, officeGoods, privateOffices, type OfficeFurniture } from '../src/private-offices';
import {cashAmount,type GameplayEvent, type ObjectKind} from '../src/gameplay';
import { agendaDurationMs, archiveDutyRoom, agendas, targetedAgendas, SAVINGS_MISSION_AMOUNT, CASH_HANDOVER_MISSION_AMOUNT, AGENDA_TRANSFER_MIN, TARGET_TRANSFER_AMOUNT, CAMPAIGN_SPENDING_TARGET, NEW_PORTRAIT_MS, missionReward, type Agenda, type Contact, type Mission, type MissionReward, type PoliticsView } from '../src/politics';
import { applyFacts, photoMissions } from './photo-missions';

export type AgendaMetrics = Readonly<{wallet:number; popularity:number; commerce?:()=>{policies:BillPolicies;publicBudget:number}; canFightCrisis?:()=>boolean; canPublishMail?:()=>boolean; hasForensicReport?:()=>boolean; hasKnownForeignSpy?:()=>boolean; hasLuxuryDecoration?:()=>boolean; ownsSpyCameras?:()=>number; ownsWiretap?:()=>boolean; canInstallSpy?:(kind:'wiretap'|'spyCamera')=>boolean; owns?: (kind:ObjectKind)=>boolean;
  remainingAdvertisements?:()=>number; canAgendaAction?:(kind:'propaganda'|'discurso'|'emenda')=>boolean; canPay?:()=>boolean; canAffordNpcSignatures?:(needed:number)=>boolean; canReceivePayments?:(requiredPayers:number)=>boolean; npcVotePrice?:()=>number|undefined; npcHasCash?:()=>boolean; hasScandal?:()=>boolean; canExposeScandal?:()=>boolean; installedPizza?:()=>{id:number;owned:boolean;canTakeSlice:boolean;slices:number;served:ReadonlySet<string>}|undefined; isScandalPizza?:(id:number)=>boolean; officeStock?:()=>readonly OfficeFurniture[]; hasOffice?:(id?:string)=>boolean; hasCashLot?:(amount:number)=>boolean; hasAgendaDecoration?:(kind:'portrait'|'vip'|'anyPortrait'|'anyVip',replacement?:boolean)=>boolean}>;
const furnitureSpendingTarget = 5;
const signatureTarget = 2;
const furnitureKinds = Object.keys(officeFurniture) as OfficeFurniture[];

const activityMissions = {
  solenidadeInauguracao:(event:GameplayEvent) => event.type==='marked' && event.kind==='portrait' && (event.duration ?? Infinity)<=NEW_PORTRAIT_MS,
  privilegioAdquirido:(event:GameplayEvent) => event.type==='installed' && event.kind==='vip',
  plantaoEmergencia:(event:GameplayEvent) => (event.type==='fire-extinguished' || event.type==='power-repaired') && event.place==='inside-crisis-room',
  fiscalizacaoParalela:(event:GameplayEvent) => event.type==='xray-target-revealed' && event.place==='safe',
  patrimonioSuspeito:(event:GameplayEvent) => event.type==='xray-target-revealed' && event.place==='npc',
  dinheiroPresencialVinte:(event:GameplayEvent) => event.type==='cash-handed-over' && event.amount===CASH_HANDOVER_MISSION_AMOUNT,
  caixaDois:(event:GameplayEvent) => event.type==='cash-received',
  varredura:(event:GameplayEvent) => event.type==='spy-discovered' && event.item!==undefined,
  limpeza:(event:GameplayEvent) => event.type==='spy-removed' && event.item!==undefined,
  flagraGabinete:(event:GameplayEvent) => event.type==='photo' && event.place==='foreign-office-subject',
  heroiInesperado:(event:GameplayEvent) => (event.type==='fire-extinguished' || event.type==='power-repaired') && (event.amount ?? 100)<30,
  instalarGrampo:(event:GameplayEvent) => event.type==='spy-installed' && event.kind==='wiretap',
  instalarCamera:(event:GameplayEvent) => event.type==='spy-installed' && event.kind==='spyCamera',
  mensagemComAnexo:(event:GameplayEvent) => event.type==='mail-published',
  retratacaoOficial:(event:GameplayEvent) => event.type==='mail-published' && event.place==='report',
  fotoOstentacao:(event:GameplayEvent) => event.type==='photo' && !!event.photo?.decorations.some(item=>isOfficeFurniture(item.kind)),
  fotoDinheiro:(event:GameplayEvent) => event.type==='photo' && !!event.photo?.people.some(person=>
    person.id!==event.actor && !person.id.startsWith('npc-parliamentarian-') && person.exposed?.some(item=>cashAmount(item.kind))),
  pixVinte:(event:GameplayEvent) => event.type==='pix-sent' && event.amount===2,
  campanhaUltimaHora:(event:GameplayEvent) => event.type==='advertisement-aired' && (event.duration ?? Infinity)<=60_000,
  cuecaDinheiro:(event:GameplayEvent) => event.type==='concealment-started' && (event.amount ?? 0)>0,
  provaDocumental:(event:GameplayEvent) => event.type==='photo' && !!event.photo &&
    (event.photo.ground.some(item=>item.kind==='document') || event.photo.people.some(person=>person.exposed?.some(item=>item.kind==='document'))),
  cafeEstrategico:(event:GameplayEvent) => event.type==='used' && event.kind==='coffee' && event.place==='Cafezinho',
  contasTesouraria:(event:GameplayEvent) => event.type==='delivered' && event.kind==='briefcase' && event.place==='treasury',
  registroHistorico:(event:GameplayEvent) => event.type==='photo' && !!event.photo?.selfie && inPlenary(event.position),
  jornalismo:(event:GameplayEvent) => event.type==='photo-published' && !!event.photo && event.place==='internal-mail',
  manutencaoEmergencia:(event:GameplayEvent) => event.type==='power-repaired',
  apagarIncendio:(event:GameplayEvent) => event.type==='fire-extinguished',
  primeirosSocorros:(event:GameplayEvent) => event.type==='used' && event.kind==='firstAidKit',
  socorro:(event:GameplayEvent) => event.type==='aided' && !!event.target && !event.target.startsWith('npc-parliamentarian-'),
  fiscalCafe:(event:GameplayEvent) => event.type==='used' && event.kind==='coffee',
  almocoPlenario:(event:GameplayEvent) => event.type==='used' && event.kind==='pizza' && inPlenary(event.position),
  emenda:(event:GameplayEvent) => event.type==='amendment-filed',
  cafe:(event:GameplayEvent) => event.type==='coffee-drunk',
  leitura:(event:GameplayEvent) => event.type==='bill-studied',
  propaganda:(event:GameplayEvent) => event.type==='advertisement-aired',
  discurso:(event:GameplayEvent) => event.type==='speech-given',
  auditoria:(event:GameplayEvent) => event.type==='audit-performed',

  protocolo:(event:GameplayEvent) => event.type==='filed',
  rouboNpc:(event:GameplayEvent) => event.type==='npc-robbed',
  votoNpc:(event:GameplayEvent) => event.type==='npc-vote-bought',
  embolso:(event:GameplayEvent) => event.type==='money-pocketed' && event.kind==='briefcase',
  assinar:(event:GameplayEvent) => event.type==='signed' && !!event.target && event.target!==event.actor,
  transporte:(event:GameplayEvent) => event.type==='room-entered' && event.kind==='briefcase' && event.target===event.actor,
  equipamento:(event:GameplayEvent) => event.type==='purchased' && event.kind==='binoculars',
  visitaArquivo:(event:GameplayEvent) => event.type==='room-entered' && event.place==='Arquivo',
  pizza:(event:GameplayEvent) => event.type==='used' && event.kind==='pizza',
  lagosta:(event:GameplayEvent) => event.type==='used' && event.kind==='lobster',
  comprarLagosta:(event:GameplayEvent) => event.type==='purchased' && event.kind==='lobster',
  televisao:(event:GameplayEvent) => event.type==='installed' && event.kind==='officeTv',
  bombom:(event:GameplayEvent) => event.type==='used' && event.kind==='chocolates',
  selfieSolo:(event:GameplayEvent) => event.type==='photo' && !!event.photo?.selfie,
  retratoGabinete:(event:GameplayEvent) => event.type==='installed' && event.kind==='portrait' && privateOffices.some(office=>office.id===event.place),
  poltrona:(event:GameplayEvent) => event.type==='purchased' && event.kind==='officeChair',
  visitaGabinete:(event:GameplayEvent) => event.type==='room-entered' && !!event.target && event.target!==event.actor,
  gabinete:(event:GameplayEvent) => event.type==='installed' && !!event.kind && isOfficeFurniture(event.kind),
  sigilo:(event:GameplayEvent) => event.type==='dropped' && !event.witnesses.length,
  joguinho:(event:GameplayEvent) => event.type==='game-won' && !event.witnesses.length,
} satisfies Partial<Record<Agenda,(event:GameplayEvent)=>boolean>>;

const minimumPlayers:Partial<Record<Agenda,number>> = {
  varredura:2,manutencaoEmergencia:2,solenidadeInauguracao:2,amizadeInstitucional:2,dinheiroPresencialVinte:2,caixaDois:2,flagraGabinete:2,reuniaoGabinete:2,reuniaoPublica:4,fotoDinheiro:2,chamadasUrgentes:3,debateTelefonico:2,pixVinte:2,socorro:2, articulacao:3, escandalo:3, entrega:4, assinar:2,
  recebido:2, pagamento:2, visitaGabinete:2, jogarOculto:2,
};
const missionTargets:Partial<Record<Agenda,number>> = {
  investimentoPolitico:CAMPAIGN_SPENDING_TARGET,poupancaInstitucional:SAVINGS_MISSION_AMOUNT,recolhimentoExtraordinario:2,comissaoImprovisada:3,tresSelfies:3,duasCameras:2,vigilanciaInstitucional:2,doisMoveis:2,visitaDoisGabinetes:2,chamadasUrgentes:2,doisPix:2,bandejaGourmet:2,fiscalCafe:3, contribuinte:5, reservaCofre:5, turismo:3, entrega:3, fortuna:12, campanha:65, articulacao:2, projetos:2, oposicao:2,
  assinaturas:signatureTarget, passeio:3, ostentacao:furnitureSpendingTarget, ...agendaDurationMs,
};
const startingActivities = ['pizza','jogar','selfieSolo','passeio'] as const;
const foodMissions = new Set<Agenda>(['cafe','pizza','lagosta','comprarLagosta','bombom','pausaCafe','cafeEstrategico','fiscalCafe','almocoPlenario']);
const purchaseRequirements:Partial<Record<Agenda,number>> = {
  campanhaUltimaHora:ELECTION_RULES.advertisementCost,pixVinte:2,
  comprarLagosta:foods.lobster.price,
  propaganda:ELECTION_RULES.advertisementCost,
  pagamento:AGENDA_TRANSFER_MIN,
  dinheiroAlvo:TARGET_TRANSFER_AMOUNT,
};

const consumableRequirements = {
  primeirosSocorros:'firstAidKit',almocoPlenario:'pizza',pizza:'pizza',pizzaAlvo:'pizza',fatias:'pizza',pizzada:'pizza',lagosta:'lobster',bombom:'chocolates',
} as const satisfies Partial<Record<Agenda,ObjectKind>>;

const decorationRequirements = {
  retrato:'portrait',retratoGabinete:'portrait',reforma:'portrait',
  privilegioAdquirido:'vip',reserva:'vip',mandaVip:'vip',
} as const satisfies Partial<Record<Agenda,keyof typeof credentialGoods>>;

const ownOfficeMissions = new Set<Agenda>(['doisMoveis','bandejaGourmet','trabalhoRemoto','produtividade','reservaCofre','embolso','transporte','retratoGabinete','televisao','gabinete','ostentacao']);
const activeMissionCount = 3;
const mailMissions = new Set<Agenda>(['jornalismo','mensagemComAnexo','retratacaoOficial']);

function canCompleteTimedMission(kind:Agenda,metrics:AgendaMetrics) {
  if (mailMissions.has(kind)) return metrics.canPublishMail?.()!==false;
  if (kind==='propaganda' || kind==='campanhaUltimaHora') return (metrics.remainingAdvertisements?.() ?? 1)>0;
  return true;
}

export class PersonalAgenda {
  private missions:Mission[] = [];
  private completed:Mission[] = [];
  private missionDeck:Agenda[];
  private nextMissionId = 0;
  private savingsStartingWallet = 0;
  private callSamples = new Map<number,Map<string,number>>();
  private factsByMission = new Map<number,Map<string,Set<string>>>();
  private missionCoffee = new Set<string>();
  private seenEvents = new Set<string>();
  private acquired = new Set<NonNullable<GameplayEvent['kind']>>();
  private npcCount = 0;
  private cannotVote = false;
  private ballotsLeft = 3;
  private votedThisBallot = false;
  private supportedThisBallot = false;

  resetBallot() {
    this.votedThisBallot = this.supportedThisBallot = false;
  }

  recordVote(metrics:AgendaMetrics, first:boolean, firstSupport:boolean) {
    this.votedThisBallot ||= first;
    this.supportedThisBallot ||= firstSupport;
    this.progress(metrics,{votacao:Number(first),apoio:Number(firstSupport)});
  }
  private targets:readonly Contact[] = [];
  private spyAvailability:AgendaMetrics['canInstallSpy'];
  private hasOffice:AgendaMetrics['hasOffice'];
  private availableTargets:ReadonlySet<string>|undefined;
  private visitedTargets = new Set<string>();
  private readonly rewardedItemIds = new Set<number>();
  private pickTarget(kind:Agenda) {
    const targets = this.targets.filter(person=>this.targetAvailable(kind,person.id));
    return targets.find(person=>!this.visitedTargets.has(kind+':'+person.id) && !this.missions.some(mission=>mission.person?.id===person.id)) ??
      targets.find(person=>!this.visitedTargets.has(kind+':'+person.id));
  }

  private targetAvailable(kind:Agenda,id:string) {
    if (kind==='visitaCortesia') return this.hasOffice?.(id)===true;
    if (kind==='visitaAlvo') return this.hasOffice?.(id)!==false;
    return !this.availableTargets || this.availableTargets.has(id);
  }

  constructor(metrics:AgendaMetrics, private playerCount:number, random:()=>number,
    private reward:(reward:MissionReward, completed:Mission[])=>void) {
    const deck = Object.keys(agendas) as Agenda[];
    const missions = deck.filter(kind=>kind!=='cafe' && !(startingActivities as readonly Agenda[]).includes(kind) && this.eligible(kind,metrics));
    const mission = missions[Math.floor(random()*missions.length)];
    const activity = startingActivities[Math.floor(random()*startingActivities.length)];
    const offset = Math.floor(random()*deck.length);
    const ordered = [...deck.slice(offset),...deck.slice(0,offset)];
    this.missionDeck = ['cafe',mission,activity,...ordered.filter(kind=>kind!=='cafe' && kind!==mission && kind!==activity)];
    this.fillMissions(metrics,true);
  }

  recordPayment(metrics:AgendaMetrics, from:string, transferId:number) {
    const key = `payment:${transferId}`;
    if (this.seenEvents.has(key)) return;
    this.seenEvents.add(key);
    const mission = this.missions.find(entry=>entry.kind==='articulacao');
    const articulacao = mission ? this.countFacts(mission,[{value:from}]) : 0;
    this.progress(metrics,{recebido:1,articulacao});
  }

  recordTransfer(metrics:AgendaMetrics, amount:number,to:string,transferId:number) {
    const key = `transfer:${transferId}`;
    if (this.seenEvents.has(key)) return;
    this.seenEvents.add(key);
    this.progress(metrics,{pagamento:Number(amount>=AGENDA_TRANSFER_MIN),dinheiroAlvo:Number(amount===TARGET_TRANSFER_AMOUNT &&
      this.missions.some(m=>m.kind==='dinheiroAlvo' && m.person?.id===to))});
  }

  recordSignature(metrics:AgendaMetrics, document:number, signer:string) {
    const documentMissions = this.missions.filter(mission=>mission.kind==='assinaturas' || mission.kind==='comissaoImprovisada');
    const targeted = this.missions.some(m=>m.kind==='assinaturaAlvo' && m.person?.id===signer);
    if (!documentMissions.length && !targeted) return;
    const gains:Partial<Record<Agenda,number>> = {assinaturaAlvo:Number(targeted)};
    for (const mission of documentMissions) gains[mission.kind] = this.countFacts(mission,[{value:signer,group:String(document)}]);
    this.progress(metrics,gains);
  }

  updateEligibility(metrics:AgendaMetrics, playerCount:number, canVote:boolean, ballotsLeft:number,npcCount=0,targets:readonly Contact[] = [],availableTargets?:ReadonlySet<string>,npcSigners?:ReadonlySet<string>) {
    this.targets = targets;
    this.hasOffice = metrics.hasOffice;
    this.spyAvailability = metrics.canInstallSpy;
    this.availableTargets = availableTargets;
    this.npcCount = npcCount;
    this.playerCount = playerCount;
    this.cannotVote = !canVote;
    this.ballotsLeft = ballotsLeft;
    this.missions = this.missions.filter(mission=>{
      if (mission.kind==='articulacao' || mission.kind==='doisPix' || mission.kind==='visitaDoisGabinetes') {
        const credited = this.factsByMission.get(mission.id)?.get('');
        const remaining = mission.target-mission.current;
        const canContribute = ({id}:Contact) => !credited?.has(id) &&
          (mission.kind!=='visitaDoisGabinetes' || this.hasOffice?.(id)!==false);
        if (targets.filter(canContribute).length>=remaining) return true;
      } else if ((mission.kind==='assinaturas' || mission.kind==='comissaoImprovisada') && (npcSigners || !npcCount)) {
        const possible = new Set([...targets.map(({id})=>id),...(npcSigners ?? [])]);
        if (possible.size>=mission.target) return true;
        const documents = this.factsByMission.get(mission.id);
        if (documents && [...documents.values()].some(signed=>new Set([...possible,...signed]).size>=mission.target)) return true;
      } else if (this.availableInMatch(mission.kind,mission.target-mission.current) &&
          (mission.kind!=='limpeza' || metrics.hasKnownForeignSpy?.()) &&
          canCompleteTimedMission(mission.kind,metrics) &&
          (mission.kind!=='investimentoPolitico' || this.canMeetCampaignTarget(metrics,mission.target-mission.current)) && (!mission.person || targets.some(person=>person.id===mission.person?.id && this.targetAvailable(mission.kind,person.id)))) return true;
      this.factsByMission.delete(mission.id);
      this.callSamples.delete(mission.id);
      return false;
    });
    this.fillMissions(metrics);
  }

  private availableInMatch(kind:Agenda, remaining:number, metrics?:AgendaMetrics) {
    const drawing = metrics!==undefined;
    if (ownOfficeMissions.has(kind) && this.hasOffice?.()===false) return false;
    if (kind==='visitaDoisGabinetes' && this.targets.filter(person=>this.hasOffice?.(person.id)!==false).length<remaining) return false;
    if (kind==='visitaGabinete' && this.hasOffice && !this.targets.some(person=>this.hasOffice?.(person.id))) return false;
    if (kind==='instalarGrampo' || kind==='instalarCamera') {
      const device = kind==='instalarGrampo' ? 'wiretap' : 'spyCamera';
      if (this.spyAvailability?.(device)===false) return false;
    }
    if (kind==='presidenteFoto') return false;
    if ((kind==='rouboNpc' || kind==='recolhimentoExtraordinario' || kind==='votoNpc') && !this.npcCount) return false;
    if (kind==='amizadeInstitucional' && !this.targets.some(person=>!this.visitedTargets.has(kind+':'+person.id) &&
        (!drawing || this.targetAvailable(kind,person.id)))) return false;
    const players = minimumPlayers[kind] ?? photoMissions[kind as keyof typeof photoMissions]?.players ?? 1;
    // Isolation is temporary. Keep collective missions already in progress.
    const usesAvailablePlayers = drawing && kind!=='visitaGabinete' && kind!=='visitaAlvo' && kind!=='visitaCortesia' && kind!=='jogarOculto';
    const humans = usesAvailablePlayers
      ? this.availableTargets ? 1+this.targets.filter(person=>this.availableTargets?.has(person.id)).length : this.playerCount
      : this.playerCount;
    if ((kind==='segurancaParlamentar' || kind==='reuniaoVip') && humans<2 && !this.npcCount) return false;
    if (kind==='assinaturas' || kind==='comissaoImprovisada') {
      const available = this.availableTargets;
      const colleagues = drawing && available
        ? this.targets.filter(person=>available.has(person.id)).length
        : Math.max(0,this.playerCount-1);
      const needed = (missionTargets[kind] ?? signatureTarget)-colleagues;
      if (needed>this.npcCount || (needed>0 && metrics?.canAffordNpcSignatures?.(needed)===false)) return false;
    } else if (players>humans) return false;
    if (kind==='projetos' || kind==='oposicao' || kind==='apoio' || kind==='votacao') {
      const consumed = drawing && (kind==='votacao' && this.votedThisBallot || kind==='apoio' && this.supportedThisBallot);
      return !this.cannotVote && this.ballotsLeft-Number(consumed)>=remaining;
    }
    return !this.cannotVote || !['campanhaUltimaHora','protocolo','propaganda','discurso','emenda','auditoria'].includes(kind);
  }

  private countFacts(mission:Mission, facts:Parameters<typeof applyFacts>[1]) {
    let seen = this.factsByMission.get(mission.id);
    if (!seen) this.factsByMission.set(mission.id,seen=new Map());
    return Math.max(0,applyFacts(seen,facts)-mission.current);
  }

  acceptGameplayEvent(event:GameplayEvent) {
    const key = event.type==='photo-published' && event.photo
      ? JSON.stringify([event.type,event.photo.id,event.place])
      : event.eventId!==undefined ? 'event:'+event.eventId
        : JSON.stringify([event.type,event.at,event.item,event.target,event.kind,event.place,event.photo?.id]);
    if (this.seenEvents.has(key)) return false;
    this.seenEvents.add(key);
    return true;
  }

  applyGameplayEvent(metrics:AgendaMetrics, event:GameplayEvent, scandalPizza:boolean) {
    const gains:Partial<Record<Agenda,number>> = {};
    if (event.type==='purchased' && event.kind) this.acquired.add(event.kind);
    if (event.type==='purchased' && event.kind && isOfficeFurniture(event.kind)) {
      gains.ostentacao = event.amount ?? officeGoods[event.kind].price;
    }
    for (const mission of this.missions) {
      const kind = mission.kind;
      if (mission.person) {
        const target = mission.person.id;
        if (event.type==='transferred' && event.target===target && event.item!==undefined && !this.rewardedItemIds.has(event.item) &&
            (kind==='documentoAlvo' && event.kind==='document' || kind==='pizzaAlvo' && event.kind==='pizza')) {
          this.rewardedItemIds.add(event.item);
          gains[kind] = 1;
        }
        if (kind==='visitaCortesia' && event.type==='office-guest-interaction' && event.target===target) gains[kind] = 1;
        if (kind==='visitaAlvo' && event.type==='room-entered' && event.target===target) gains[kind] = 1;
        if (kind==='selfieAlvo' && event.type==='photo' && event.photo?.selfie &&
            event.photo.people.some(person=>person.id===target)) gains[kind] = 1;
      }
      const matches = activityMissions[kind as keyof typeof activityMissions];
      if (matches?.(event)) {
        const requiresNewItem = kind==='solenidadeInauguracao' || kind==='privilegioAdquirido';
        if (!requiresNewItem) gains[kind] = 1;
        else if (event.item!==undefined && !this.rewardedItemIds.has(event.item)) {
          this.rewardedItemIds.add(event.item);
          gains[kind] = 1;
        }
      }
      const rule = photoMissions[kind as keyof typeof photoMissions];
      if (rule && (kind!=='pizzada' || scandalPizza)) {
        const photo = event.photo;
        const humanPhoto = photo ? {...photo,people:photo.people.filter(person=>!person.id.startsWith('npc-parliamentarian-'))} : undefined;
        gains[kind] = this.countFacts(mission,rule.facts(humanPhoto ? {...event,photo:humanPhoto} : event));
      }
      if ((kind==='assinaturas' || kind==='comissaoImprovisada') && event.type==='edited' && event.item!==undefined) {
        const facts = this.factsByMission.get(mission.id);
        if (facts?.delete(String(event.item))) mission.current = Math.max(0,...[...facts.values()].map(group=>group.size));
      }
      if (kind==='visitaDoisGabinetes' && event.type==='room-entered' &&
          this.targets.some(person=>person.id===event.target && this.hasOffice?.(person.id)!==false) ||
          kind==='doisPix' && event.type==='pix-received' && event.target) {
        gains[kind] = this.countFacts(mission,[{value:event.target!}]);
      }
      if (kind==='recolhimentoExtraordinario' && event.item!==undefined) {
        const item = String(event.item);
        if (event.type==='npc-robbed' && (event.amount ?? 0)>=0.2) {
          this.countFacts(mission,[{value:item}]);
          if (mission.current===0) gains[kind] = 1;
        }
        if (event.type==='cash-part-deposited' && this.factsByMission.get(mission.id)?.get('')?.has(item)) gains[kind] = 1;
      }
      if (kind==='presencaPlenario' && event.place==='Plenário') {
        if (event.type==='room-entered') this.countFacts(mission,[{value:'entrada'}]);
        if (event.type==='room-left' && this.factsByMission.has(mission.id)) gains[kind] = 1;
      }
      if (kind==='tresSelfies' && event.type==='photo' && event.photo?.selfie &&
          event.photo.location!=='Corredor' && event.photo.location!=='Sala de Isolamento' &&
          !privateOffices.some(office=>office.name===event.photo!.location)) {
        gains[kind] = this.countFacts(mission,[{value:event.photo.location}]);
      }
      if (kind==='reuniaoGabinete' && event.type==='office-meeting-time' ||
          kind==='reuniaoPublica' && event.type==='public-meeting-time') gains[kind] = event.duration ?? 0;
      if (kind==='vigilanciaInstitucional' && event.type==='security-camera-viewed' && event.place) {
        gains[kind] = this.countFacts(mission,[{value:event.place}]);
      }
      if (kind==='duasCameras' && event.type==='spy-viewed' && event.kind==='spyCamera' && event.item!==undefined) {
        gains[kind] = this.countFacts(mission,[{value:String(event.item)}]);
      }
      if (kind==='doisMoveis' && event.type==='installed' && event.kind && isOfficeFurniture(event.kind)) {
        gains[kind] = this.countFacts(mission,[{value:event.kind}]);
      }
      if (kind==='bandejaGourmet' && event.type==='used' && event.target===event.actor &&
          event.kind && Object.hasOwn(foods,event.kind)) gains[kind] = this.countFacts(mission,[{value:event.kind}]);
      if (kind==='reuniaoVip') {
        if (event.type==='vip-meeting-interrupted') mission.current = 0;
        if (event.type==='vip-meeting-time') gains[kind] = event.duration ?? 0;
      }
      if (kind==='segurancaParlamentar') {
        if (event.type==='security-watch-interrupted') mission.current = 0;
        if (event.type==='security-watch-time') gains[kind] = event.duration ?? 0;
      }
      if (kind==='nadaADeclarar' && event.type==='concealed-cash-time') gains[kind] = event.duration ?? 0;
      if (kind==='escutaAtiva' && event.type==='wiretap-time') gains[kind] = event.duration ?? 0;
      if (kind==='debateTelefonico' && event.type==='call-time' || kind==='discursoMegafone' && event.type==='megaphone-time') {
        gains[kind] = event.duration ?? 0;
      }
      if (kind==='chamadasUrgentes' && event.type==='call-time' && event.target && event.item!==undefined) {
        const call = `${event.item}:${event.target}`;
        let samples = this.callSamples.get(mission.id);
        if (!samples) this.callSamples.set(mission.id,samples=new Map());
        const elapsed = (samples.get(call) ?? 0)+(event.duration ?? 0);
        samples.set(call,elapsed);
        if (elapsed>=10_000) gains[kind] = this.countFacts(mission,[{value:event.target}]);
      }
      if (kind==='amizadeInstitucional' && event.target && event.kind && !cashAmount(event.kind) &&
          this.targets.some(person=>person.id===event.target) && !this.visitedTargets.has(kind+':'+event.target) &&
          (event.type==='transferred' || event.type==='item-received')) {
        const sent = event.type==='transferred';
        const opposite = this.factsByMission.get(mission.id)?.get(`${event.target}:${!sent}`);
        if (opposite && [...opposite].some(item=>item!==event.kind)) {
          this.visitedTargets.add(kind+':'+event.target);
          gains[kind] = 1;
        } else {
          this.countFacts(mission,[{group:`${event.target}:${sent}`,value:event.kind}]);
        }
      }
      if (kind==='investimentoPolitico' && event.type==='advertisement-aired') gains[kind] = event.amount ?? 0;
      if (kind==='contribuinte' && event.type==='delivered' && event.place==='treasury') gains[kind] = event.amount ?? 0;
      if (kind==='reservaCofre' && event.type==='money-pocketed') gains[kind] = event.amount ?? 0;
      if (kind==='turismo' && event.type==='photo' && event.photo && event.photo.location!=='Corredor') {
        gains[kind] = this.countFacts(mission,[{value:event.photo.location}]);
      }
      if (kind==='trabalhoRemoto' && event.type==='room-time' && event.target===event.actor) gains[kind] = event.duration ?? 0;
      if (kind==='plantaoArquivo' && event.place===archiveDutyRoom) {
        if (event.type==='room-left') mission.current = 0;
        if (event.type==='room-time') gains[kind] = event.duration ?? 0;
      }
      if (kind==='passeio' && event.type==='room-entered' && event.place && !event.target &&
          event.place!=='Sala de Isolamento' && !privateOffices.some(office=>office.name===event.place)) {
        gains.passeio = this.countFacts(mission,[{value:event.place}]);
      }
      if ((event.type==='game-played' && (kind==='jogar' || kind==='jogarOculto' && !event.witnesses.length ||
          kind==='produtividade' && event.place==='own-office')) ||
          (event.type==='room-time' && event.place==='Cafezinho' && kind==='pausaCafe')) gains[kind] = event.duration ?? 0;
    }
    if (event.kind==='coffee') {
      if (event.type==='used') gains.cafe = 1;
      if (event.type==='transferred' && event.target && this.missions.some(mission=>mission.kind==='entrega')) {
        this.missionCoffee.add(event.target);
      }
    }
    this.progress(metrics,gains);
  }

  private canMeetCampaignTarget(metrics:AgendaMetrics, remaining:number) {
    return !this.cannotVote && (metrics.remainingAdvertisements?.() ?? 0)*ELECTION_RULES.advertisementCost>=remaining;
  }

  private eligible(kind:Agenda, metrics:AgendaMetrics) {
    const equipmentPrice = (item:ObjectKind)=>{
      const commerce = metrics.commerce?.();
      return marketProduct('equipment',item,commerce?.policies,commerce?.publicBudget)?.price ?? Infinity;
    };
    if (kind==='investimentoPolitico' && (!this.canMeetCampaignTarget(metrics,CAMPAIGN_SPENDING_TARGET) ||
        metrics.wallet<Math.ceil(CAMPAIGN_SPENDING_TARGET/ELECTION_RULES.advertisementCost)*ELECTION_RULES.advertisementCost)) return false;
    if (kind==='recebido' || kind==='articulacao' || kind==='doisPix') {
      const requiredPayers = missionTargets[kind] ?? 1;
      if (kind==='doisPix' && !metrics.canReceivePayments) return false;
      if (metrics.canReceivePayments?.(requiredPayers)===false) return false;
    }
    if (kind==='pagamento' || kind==='dinheiroAlvo' || kind==='pixVinte') {
      if (metrics.canPay?.()===false) return false;
      if (this.availableTargets && !this.targets.some(person=>this.targetAvailable(kind,person.id))) return false;
    }
    if (kind==='dinheiroPresencialVinte' && !metrics.hasCashLot?.(CASH_HANDOVER_MISSION_AMOUNT)) return false;
    if ((kind==='rouboNpc' || kind==='recolhimentoExtraordinario') && metrics.npcHasCash?.()===false) return false;
    if (kind==='votoNpc') {
      if (this.cannotVote || this.ballotsLeft===0 || metrics.canPay?.()===false) return false;
      if (metrics.npcVotePrice && (metrics.npcVotePrice() ?? Infinity)>metrics.wallet) return false;
    }
    const action = kind==='campanhaUltimaHora' ? 'propaganda' : kind;
    if ((action==='propaganda' || action==='discurso' || action==='emenda') && metrics.canAgendaAction?.(action)===false) return false;
    const food = consumableRequirements[kind as keyof typeof consumableRequirements];
    if (food && metrics.wallet<(food==='firstAidKit' ? firstAidKit.price : foods[food].price) && !metrics.owns?.(food)) {
      const pizza = food==='pizza' ? metrics.installedPizza?.() : undefined;
      if (kind==='pizza') {
        if (!pizza?.canTakeSlice) return false;
      } else if (kind==='fatias' || kind==='pizzada') {
        const required = photoMissions[kind].target;
        if (!pizza?.owned || pizza.slices<required || (kind==='pizzada' && !metrics.isScandalPizza?.(pizza.id))) return false;
        const guests = this.targets.filter(person=>this.targetAvailable(kind,person.id) && !pizza.served.has(person.id));
        if (guests.length<required) return false;
      } else return false;
    }
    const decoration = decorationRequirements[kind as keyof typeof decorationRequirements];
    if (decoration && metrics.wallet<credentialGoods[decoration].price && !metrics.owns?.(decoration)) return false;
    if (!canCompleteTimedMission(kind,metrics)) return false;
    if (mailMissions.has(kind) && metrics.wallet<mailPublicationFee(metrics.commerce?.().policies)) return false;
    if (kind==='retratacaoOficial' && !metrics.hasForensicReport?.()) return false;
    if (kind==='heroiInesperado' && !metrics.canFightCrisis?.()) return false;
    if ((kind==='fiscalizacaoParalela' || kind==='patrimonioSuspeito') && !metrics.owns?.('xray')) return false;
    if (kind==='fiscalizacaoParalela' && !this.targets.some(person=>this.hasOffice?.(person.id))) return false;
    if (kind==='patrimonioSuspeito' && !this.npcCount) return false;
    if (kind==='flagraGabinete' && !this.targets.some(person=>this.hasOffice?.(person.id))) return false;
    if (kind==='escutaAtiva' && !metrics.ownsWiretap?.()) return false;
    if (kind==='varredura' && !metrics.owns?.('bugDetector') && metrics.wallet<equipmentPrice('bugDetector')) return false;
    if (kind==='limpeza' && !metrics.hasKnownForeignSpy?.()) return false;
    if (kind==='duasCameras' && (metrics.ownsSpyCameras?.() ?? 0)<2) return false;
    if (kind==='fotoOstentacao' && !metrics.hasLuxuryDecoration?.()) return false;
    if ((kind==='cuecaDinheiro' || kind==='nadaADeclarar') && !metrics.owns?.('mensalUnderwear')) return false;
    if (kind==='instalarGrampo' || kind==='instalarCamera') {
      const device = kind==='instalarGrampo' ? 'wiretap' : 'spyCamera';
      if (!metrics.canInstallSpy?.(device) || metrics.wallet<equipmentPrice(device) && !metrics.owns?.(device)) return false;
    }
    if (kind==='segurancaParlamentar' && metrics.wallet<equipmentPrice('baton') && !metrics.owns?.('baton')) return false;
    if (kind==='discursoMegafone' && metrics.wallet<equipmentPrice('megaphone') && !metrics.owns?.('megaphone')) return false;
    if (kind==='equipamento' && (metrics.owns?.('binoculars') || metrics.wallet<equipmentPrice('binoculars'))) return false;
    if (kind==='reuniaoVip' && !metrics.hasAgendaDecoration?.('anyVip')) return false;
    if (kind==='cerimonialOficial' && !metrics.hasAgendaDecoration?.('anyPortrait')) return false;
    if (kind==='autorretrato' && !metrics.hasAgendaDecoration?.('portrait') &&
        metrics.wallet<credentialGoods.portrait.price && !metrics.owns?.('portrait')) return false;
    if (kind==='reforma' && !metrics.hasAgendaDecoration?.('portrait',true)) return false;
    if (kind==='mandaVip' && !metrics.hasAgendaDecoration?.('vip',true)) return false;
    if (kind==='fiscalVip' && !metrics.hasAgendaDecoration?.('vip')) return false;
    if (kind==='escandalo' && !metrics.canExposeScandal?.()) return false;
    if (kind==='pizzada' && !metrics.hasScandal?.()) return false;
    if (kind==='televisao' || kind==='poltrona' || kind==='gabinete' || kind==='doisMoveis' || kind==='ostentacao') {
      const commerce = metrics.commerce?.();
      const stock = metrics.officeStock?.() ?? furnitureKinds.filter(item=>!this.acquired.has(item));
      const price = (item:OfficeFurniture,budget=commerce?.publicBudget)=>marketProduct('furniture',item,commerce?.policies,budget)!.price;
      const canBuy = (item:OfficeFurniture)=>stock.includes(item) && price(item)<=metrics.wallet;
      const canInstall = (item:OfficeFurniture)=>!!metrics.owns?.(item) || canBuy(item);
      if (kind==='televisao' && !canInstall('officeTv')) return false;
      if (kind==='poltrona' && !canBuy('officeChair')) return false;
      if (kind==='gabinete' && !furnitureKinds.some(canInstall)) return false;
      if (kind==='doisMoveis' || kind==='ostentacao') {
        const alreadyOwned = kind==='doisMoveis' ? furnitureKinds.filter(item=>metrics.owns?.(item)) : [];
        function viable(remaining:readonly OfficeFurniture[],count:number,spent:number,budget:number):boolean {
          if (kind==='doisMoveis' ? count>=2 : spent>=furnitureSpendingTarget*10) return true;
          return remaining.some(item=>{
            const quoted = price(item,budget);
            const total = spent+Math.round(quoted*10);
            const afterSubsidy = Math.round((budget-(officeGoods[item].price-quoted))*10)/10;
            return total<=Math.round(metrics.wallet*10) &&
              viable(remaining.filter(other=>other!==item),count+1,total,afterSubsidy);
          });
        }
        if (!viable(stock.filter(item=>!alreadyOwned.includes(item)),alreadyOwned.length,0,commerce?.publicBudget ?? Infinity)) return false;
      }
    }
    return (!Object.hasOwn(targetedAgendas,kind) || !!this.pickTarget(kind)) && this.availableInMatch(kind,missionTargets[kind] ?? 1,metrics) &&
      metrics.wallet>=(purchaseRequirements[kind] ?? 0) &&
      (kind!=='campanha' || metrics.popularity<100) &&
      (kind!=='equipamento' || !!metrics.owns || !this.acquired.has('binoculars'));
  }

  private fillMissions(metrics:AgendaMetrics, initial=false) {
    while (this.missions.length<activeMissionCount) {
      const recent = this.completed.at(-1)?.kind;
      const canDraw = (kind:Agenda) => this.eligible(kind,metrics) && !this.hasActive(kind);
      const foodActive = this.missions.some(mission=>foodMissions.has(mission.kind));
      const diverse = initial ? -1 : this.missionDeck.findIndex(kind=>kind!==recent && canDraw(kind) &&
        (!foodMissions.has(kind) || !foodActive && (!recent || !foodMissions.has(recent))));
      const fresh = this.missionDeck.findIndex(kind=>kind!==recent && canDraw(kind));
      const index = diverse>=0 ? diverse : fresh>=0 ? fresh : this.missionDeck.findIndex(canDraw);
      if (index<0) return;
      const [kind] = this.missionDeck.splice(index,1);
      this.missionDeck.push(kind);
      let target = photoMissions[kind as keyof typeof photoMissions]?.target ?? missionTargets[kind] ?? 1;
      if (kind==='poupancaInstitucional') this.savingsStartingWallet = metrics.wallet;
      if (kind==='fortuna') target = Math.max(target,metrics.wallet+4);
      if (kind==='campanha') target = Math.min(100,Math.max(target,metrics.popularity+15));
      if (kind==='entrega') this.missionCoffee.clear();
      const person = Object.hasOwn(targetedAgendas,kind) ? this.pickTarget(kind) : undefined;
      this.missions.push({id:++this.nextMissionId,kind,current:0,target,person});
    }
  }

  private missionProgress(metrics:AgendaMetrics, mission:Mission) {
    if (mission.kind==='poupancaInstitucional') return Math.max(0,Math.round((metrics.wallet-this.savingsStartingWallet)*10)/10);
    if (mission.kind==='fortuna') return metrics.wallet;
    if (mission.kind==='campanha') return metrics.popularity;
    if (mission.kind==='entrega') return this.missionCoffee.size;
    return mission.current;
  }

  progress(metrics:AgendaMetrics, gains:Partial<Record<Agenda,number>> = {}) {
    const reward = {xp:0,cash:0,popularity:0};
    const completed:Mission[] = [];
    for (const mission of this.missions) {
      const total = this.missionProgress(metrics,mission)+(gains[mission.kind] ?? 0);
      const current = mission.kind==='ostentacao' ? Math.round(total*10)/10 : total;
      mission.current = Math.min(current,mission.target);
      if (current>=mission.target) {
        this.factsByMission.delete(mission.id);
        this.callSamples.delete(mission.id);
        completed.push({...mission});
        if (mission.person) this.visitedTargets.add(mission.kind+':'+mission.person.id);
        const earned = missionReward(mission.kind);
        reward.xp += earned.xp;
        reward.cash += earned.cash ?? 0;
        reward.popularity += earned.popularity ?? 0;
      }
    }
    this.missions = this.missions.filter(mission => mission.current<mission.target);
    if (reward.xp) {
      this.completed.push(...completed);
      this.reward(reward,completed);
      this.progress(metrics);
    }
    this.fillMissions(metrics);
  }

  replaceUnavailableScandal(metrics:AgendaMetrics) {
    if (metrics.canExposeScandal?.() || !this.hasActive('escandalo')) return;
    this.missions = this.missions.filter(mission=>mission.kind!=='escandalo');
    this.fillMissions(metrics);
  }

  hasActive(kind:Agenda) {
    return this.missions.some(mission=>mission.kind===kind);
  }

  view(metrics:AgendaMetrics):PoliticsView['missions'] {
    return {
      active:this.missions.map(mission=>({...mission,current:Math.min(mission.target,this.missionProgress(metrics,mission))})),
      completed:this.completed.map(mission=>({...mission})),
    };
  }
}
