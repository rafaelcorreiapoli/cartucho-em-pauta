import { internalMailRules } from '../src/internal-mail';
import { firstAidKit } from '../src/medical';
import { inPlenary } from '../src/map';
import { shop } from '../src/installations';
import { equipment } from '../src/equipment';
import { foods } from '../src/food';
import { ELECTION_RULES } from '../src/elections';
import { isOfficeFurniture, officeFurniture, officeGoods, privateOffices, type OfficeFurniture } from '../src/private-offices';
import type { GameplayEvent, ObjectKind } from '../src/gameplay';
import { agendaDurationMs, agendas, targetedAgendas, AGENDA_TRANSFER_MIN, missionReward, type Agenda, type Contact, type Mission, type MissionReward, type PoliticsView } from '../src/politics';
import { applyFacts, photoMissions } from './photo-missions';

export type AgendaMetrics = Readonly<{wallet:number; popularity:number; owns?: (kind:ObjectKind)=>boolean;
  canAgendaAction?:(kind:'propaganda'|'discurso'|'emenda')=>boolean; canPay?:()=>boolean; canAffordNpcSignatures?:(needed:number)=>boolean; canReceivePayments?:(requiredPayers:number)=>boolean; npcVotePrice?:()=>number|undefined; npcHasCash?:()=>boolean; hasScandal?:()=>boolean; canExposeScandal?:()=>boolean; installedPizza?:()=>{id:number;owned:boolean;canTakeSlice:boolean;slices:number;served:ReadonlySet<string>}|undefined; isScandalPizza?:(id:number)=>boolean; officeStock?:()=>readonly OfficeFurniture[]; hasOffice?:(id?:string)=>boolean; hasAgendaDecoration?:(kind:'portrait'|'vip',replacement?:boolean)=>boolean}>;
const furnitureSpendingTarget = 5;
const signatureTarget = 2;
const furnitureKinds = Object.keys(officeFurniture) as OfficeFurniture[];

const activityMissions = {
  cuecaDinheiro:(event:GameplayEvent) => event.type==='concealment-started' && (event.amount ?? 0)>0,
  provaDocumental:(event:GameplayEvent) => event.type==='photo' && !!event.photo &&
    (event.photo.ground.some(item=>item.kind==='document') || event.photo.people.some(person=>person.exposed?.some(item=>item.kind==='document'))),
  cafeEstrategico:(event:GameplayEvent) => event.type==='used' && event.kind==='coffee' && event.place==='Cafezinho',
  contasTesouraria:(event:GameplayEvent) => event.type==='delivered' && event.kind==='briefcase' && event.place==='treasury',
  registroHistorico:(event:GameplayEvent) => event.type==='photo' && !!event.photo?.selfie && inPlenary(event.position),
  jornalismo:(event:GameplayEvent) => event.type==='photo-published' && !!event.photo && event.place==='internal-mail',
  apagarIncendio:(event:GameplayEvent) => event.type==='fire-extinguished',
  primeirosSocorros:(event:GameplayEvent) => event.type==='used' && event.kind==='firstAidKit',
  socorro:(event:GameplayEvent) => event.type==='aided' && !!event.target && !event.target.startsWith('npc-parliamentarian-'),
  fiscalCafe:(event:GameplayEvent) => event.type==='used' && event.kind==='coffee',
  almocoPlenario:(event:GameplayEvent) => event.type==='used' && event.kind==='pizza' && inPlenary(event.position),
  emenda:(event:GameplayEvent) => event.type==='amendment-filed',
  cafe:(event:GameplayEvent) => event.type==='coffee-drunk',
  leitura:(event:GameplayEvent) => event.type==='bill-studied',
  credencial:(event:GameplayEvent) => event.type==='credential-checked',
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
  presente:(event:GameplayEvent) => event.type==='transferred' && event.kind==='gift' && !!event.target && event.target!==event.actor,
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
  socorro:2, articulacao:3, escandalo:3, entrega:4, assinar:2,
  recebido:2, pagamento:2, presente:2, visitaGabinete:2, jogarOculto:2,
};
const missionTargets:Partial<Record<Agenda,number>> = {
  fiscalCafe:3, contribuinte:5, reservaCofre:5, turismo:3, entrega:3, fortuna:12, campanha:65, articulacao:2, projetos:2, oposicao:2,
  assinaturas:signatureTarget, passeio:3, ostentacao:furnitureSpendingTarget, ...agendaDurationMs,
};
const startingActivities = ['pizza','jogar','selfieSolo','passeio'] as const;
const foodMissions = new Set<Agenda>(['cafe','pizza','lagosta','comprarLagosta','bombom','pausaCafe','cafeEstrategico','fiscalCafe','almocoPlenario']);
const purchaseRequirements:Partial<Record<Agenda,number>> = {
  equipamento:equipment.binoculars.price,
  comprarLagosta:foods.lobster.price,
  propaganda:ELECTION_RULES.advertisementCost,
  pagamento:AGENDA_TRANSFER_MIN,
  dinheiroAlvo:AGENDA_TRANSFER_MIN,
};

const consumableRequirements = {
  cafeEstrategico:'coffee',fiscalCafe:'coffee',primeirosSocorros:'firstAidKit',almocoPlenario:'pizza',pizza:'pizza',pizzaAlvo:'pizza',fatias:'pizza',pizzada:'pizza',lagosta:'lobster',bombom:'chocolates',
} as const satisfies Partial<Record<Agenda,ObjectKind>>;

const decorationRequirements = {
  retrato:'portrait',retratoGabinete:'portrait',reforma:'portrait',
  reserva:'vip',mandaVip:'vip',
} as const satisfies Partial<Record<Agenda,keyof typeof shop>>;

const ownOfficeMissions = new Set<Agenda>(['trabalhoRemoto','reservaCofre','embolso','transporte','retratoGabinete','televisao','gabinete','ostentacao']);
const activeMissionCount = 3;

export class PersonalAgenda {
  private missions:Mission[] = [];
  private completed:Mission[] = [];
  private missionDeck:Agenda[];
  private nextMissionId = 0;
  private factsByMission = new Map<number,Map<string,Set<string>>>();
  private missionPayers = new Set<string>();
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
  private hasOffice:AgendaMetrics['hasOffice'];
  private availableTargets:ReadonlySet<string>|undefined;
  private visitedTargets = new Set<string>();
  private readonly rewardedTargetItems = new Set<number>();
  private pickTarget(kind:Agenda) {
    const targets = this.targets.filter(person=>this.targetAvailable(kind,person.id));
    return targets.find(person=>!this.visitedTargets.has(kind+':'+person.id) && !this.missions.some(mission=>mission.person?.id===person.id)) ??
      targets.find(person=>!this.visitedTargets.has(kind+':'+person.id));
  }

  private targetAvailable(kind:Agenda,id:string) {
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
    if (this.hasActive('articulacao')) this.missionPayers.add(from);
    this.progress(metrics,{recebido:1});
  }

  recordTransfer(metrics:AgendaMetrics, amount:number,to:string,transferId:number) {
    const key = `transfer:${transferId}`;
    if (this.seenEvents.has(key)) return;
    this.seenEvents.add(key);
    if (amount>=AGENDA_TRANSFER_MIN) this.progress(metrics,{pagamento:1,dinheiroAlvo:Number(this.missions.some(m=>m.kind==='dinheiroAlvo' && m.person?.id===to))});
  }

  recordSignature(metrics:AgendaMetrics, document:number, signer:string) {
    const mission = this.missions.find(mission=>mission.kind==='assinaturas');
    const targeted = this.missions.some(m=>m.kind==='assinaturaAlvo' && m.person?.id===signer);
    if (mission || targeted) this.progress(metrics,{assinaturaAlvo:Number(targeted),
      assinaturas:mission ? this.countFacts(mission,[{value:signer,group:String(document)}]) : 0});
  }

  updateEligibility(metrics:AgendaMetrics, playerCount:number, canVote:boolean, ballotsLeft:number,npcCount=0,targets:readonly Contact[] = [],availableTargets?:ReadonlySet<string>) {
    this.targets = targets;
    this.hasOffice = metrics.hasOffice;
    this.availableTargets = availableTargets;
    this.npcCount = npcCount;
    this.playerCount = playerCount;
    this.cannotVote = !canVote;
    this.ballotsLeft = ballotsLeft;
    this.missions = this.missions.filter(mission=>{
      if (this.availableInMatch(mission.kind,mission.target-mission.current) && (!mission.person || targets.some(person=>person.id===mission.person?.id && this.targetAvailable(mission.kind,person.id)))) return true;
      this.factsByMission.delete(mission.id);
      return false;
    });
    this.fillMissions(metrics);
  }

  private availableInMatch(kind:Agenda, remaining:number, metrics?:AgendaMetrics) {
    const drawing = metrics!==undefined;
    if (ownOfficeMissions.has(kind) && this.hasOffice?.()===false) return false;
    if (kind==='visitaGabinete' && this.hasOffice && !this.targets.some(person=>this.hasOffice?.(person.id))) return false;
    if (kind==='presidenteFoto') return false;
    if ((kind==='rouboNpc' || kind==='votoNpc') && !this.npcCount) return false;
    const players = minimumPlayers[kind] ?? photoMissions[kind as keyof typeof photoMissions]?.players ?? 1;
    // Isolation is temporary. Keep collective missions already in progress.
    const usesAvailablePlayers = drawing && kind!=='visitaGabinete' && kind!=='visitaAlvo' && kind!=='jogarOculto';
    const humans = usesAvailablePlayers
      ? this.availableTargets ? 1+this.targets.filter(person=>this.availableTargets?.has(person.id)).length : this.playerCount
      : this.playerCount;
    if (kind==='assinaturas') {
      const available = this.availableTargets;
      const colleagues = drawing && available
        ? this.targets.filter(person=>available.has(person.id)).length
        : Math.max(0,this.playerCount-1);
      const needed = signatureTarget-colleagues;
      if (needed>this.npcCount || (needed>0 && metrics?.canAffordNpcSignatures?.(needed)===false)) return false;
    } else if (players>humans) return false;
    if (kind==='projetos' || kind==='oposicao' || kind==='apoio' || kind==='votacao') {
      const consumed = drawing && (kind==='votacao' && this.votedThisBallot || kind==='apoio' && this.supportedThisBallot);
      return !this.cannotVote && this.ballotsLeft-Number(consumed)>=remaining;
    }
    return !this.cannotVote || !['protocolo','propaganda','discurso','emenda','auditoria'].includes(kind);
  }

  private countFacts(mission:Mission, facts:Parameters<typeof applyFacts>[1]) {
    let seen = this.factsByMission.get(mission.id);
    if (!seen) this.factsByMission.set(mission.id,seen=new Map());
    return Math.max(0,applyFacts(seen,facts)-mission.current);
  }

  acceptGameplayEvent(event:GameplayEvent) {
    const key = event.type==='photo-published' && event.photo
      ? JSON.stringify([event.type,event.photo.id,event.place])
      : JSON.stringify([event.type,event.at,event.item,event.target,event.kind,event.place,event.photo?.id]);
    if (this.seenEvents.has(key)) return false;
    this.seenEvents.add(key);
    return true;
  }

  applyGameplayEvent(metrics:AgendaMetrics, event:GameplayEvent, scandalPizza:boolean) {
    const gains:Partial<Record<Agenda,number>> = {};
    if (event.type==='purchased' && event.kind) this.acquired.add(event.kind);
    if (event.type==='purchased' && event.kind && isOfficeFurniture(event.kind)) {
      gains.ostentacao = officeGoods[event.kind].price;
    }
    for (const mission of this.missions) {
      const kind = mission.kind;
      if (mission.person) {
        const target = mission.person.id;
        if (event.type==='transferred' && event.target===target && event.item!==undefined && !this.rewardedTargetItems.has(event.item) &&
            (kind==='documentoAlvo' && event.kind==='document' || kind==='pizzaAlvo' && event.kind==='pizza')) {
          this.rewardedTargetItems.add(event.item);
          gains[kind] = 1;
        }
        if (kind==='visitaAlvo' && event.type==='room-entered' && event.target===target) gains[kind] = 1;
        if (kind==='selfieAlvo' && event.type==='photo' && event.photo?.selfie &&
            event.photo.people.some(person=>person.id===target)) gains[kind] = 1;
      }
      const matches = activityMissions[kind as keyof typeof activityMissions];
      if (matches?.(event)) gains[kind] = 1;
      const rule = photoMissions[kind as keyof typeof photoMissions];
      if (rule && (kind!=='pizzada' || scandalPizza)) {
        const photo = event.photo;
        const humanPhoto = photo ? {...photo,people:photo.people.filter(person=>!person.id.startsWith('npc-parliamentarian-'))} : undefined;
        gains[kind] = this.countFacts(mission,rule.facts(humanPhoto ? {...event,photo:humanPhoto} : event));
      }
      if (kind==='assinaturas' && event.type==='edited' && event.item!==undefined) {
        const facts = this.factsByMission.get(mission.id);
        if (facts?.delete(String(event.item))) mission.current = Math.max(0,...[...facts.values()].map(group=>group.size));
      }
      if (kind==='contribuinte' && event.type==='delivered' && event.place==='treasury') gains[kind] = event.amount ?? 0;
      if (kind==='reservaCofre' && event.type==='money-pocketed') gains[kind] = event.amount ?? 0;
      if (kind==='turismo' && event.type==='photo' && event.photo && event.photo.location!=='Corredor') {
        gains[kind] = this.countFacts(mission,[{value:event.photo.location}]);
      }
      if (kind==='trabalhoRemoto' && event.type==='room-time' && event.target===event.actor) gains[kind] = event.duration ?? 0;
      if (kind==='passeio' && event.type==='room-entered' && event.place) {
        gains.passeio = this.countFacts(mission,[{value:event.place}]);
      }
      if ((event.type==='game-played' && (kind==='jogar' || kind==='jogarOculto' && !event.witnesses.length)) ||
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

  private eligible(kind:Agenda, metrics:AgendaMetrics) {
    if (kind==='recebido' || kind==='articulacao') {
      const requiredPayers = kind==='articulacao' ? missionTargets.articulacao! : 1;
      if (metrics.canReceivePayments?.(requiredPayers)===false) return false;
    }
    if (kind==='pagamento' || kind==='dinheiroAlvo') {
      if (metrics.canPay?.()===false) return false;
      if (this.availableTargets && !this.targets.some(person=>this.targetAvailable(kind,person.id))) return false;
    }
    if (kind==='rouboNpc' && metrics.npcHasCash?.()===false) return false;
    if (kind==='votoNpc') {
      if (this.cannotVote || this.ballotsLeft===0 || metrics.canPay?.()===false) return false;
      if (metrics.npcVotePrice && (metrics.npcVotePrice() ?? Infinity)>metrics.wallet) return false;
    }
    if ((kind==='propaganda' || kind==='discurso' || kind==='emenda') && metrics.canAgendaAction?.(kind)===false) return false;
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
    if (decoration && metrics.wallet<shop[decoration] && !metrics.owns?.(decoration)) return false;
    if (kind==='jornalismo' && metrics.wallet<internalMailRules.fee) return false;
    if (kind==='cuecaDinheiro' && !metrics.owns?.('mensalUnderwear')) return false;
    if (kind==='equipamento' && metrics.owns?.('binoculars')) return false;
    if (kind==='autorretrato' && !metrics.hasAgendaDecoration?.('portrait') &&
        metrics.wallet<shop.portrait && !metrics.owns?.('portrait')) return false;
    if (kind==='reforma' && !metrics.hasAgendaDecoration?.('portrait',true)) return false;
    if (kind==='mandaVip' && !metrics.hasAgendaDecoration?.('vip',true)) return false;
    if (kind==='fiscalVip' && !metrics.hasAgendaDecoration?.('vip')) return false;
    if (kind==='escandalo' && !metrics.canExposeScandal?.()) return false;
    if (kind==='pizzada' && !metrics.hasScandal?.()) return false;
    const stock = metrics.officeStock?.() ?? furnitureKinds.filter(item=>!this.acquired.has(item));
    const canBuyFurniture = (item:OfficeFurniture) => stock.includes(item) && officeGoods[item].price<=metrics.wallet;
    const canInstallFurniture = (item:OfficeFurniture) => !!metrics.owns?.(item) || canBuyFurniture(item);
    if (kind==='televisao' && !canInstallFurniture('officeTv')) return false;
    if (kind==='poltrona' && !canBuyFurniture('officeChair')) return false;
    if (kind==='gabinete' && !furnitureKinds.some(canInstallFurniture)) return false;
    if (kind==='ostentacao') {
      let totals = [0];
      for (const item of stock) {
        const price = officeGoods[item].price;
        totals = [...totals,...totals.map(total=>total+price).filter(total=>total<=metrics.wallet)];
      }
      if (!totals.some(total=>total>=furnitureSpendingTarget)) return false;
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
      if (kind==='fortuna') target = Math.max(target,metrics.wallet+4);
      if (kind==='campanha') target = Math.min(100,Math.max(target,metrics.popularity+15));
      if (kind==='articulacao') this.missionPayers.clear();
      if (kind==='entrega') this.missionCoffee.clear();
      const person = Object.hasOwn(targetedAgendas,kind) ? this.pickTarget(kind) : undefined;
      this.missions.push({id:++this.nextMissionId,kind,current:0,target,person});
    }
  }

  private missionProgress(metrics:AgendaMetrics, mission:Mission) {
    if (mission.kind==='fortuna') return metrics.wallet;
    if (mission.kind==='campanha') return metrics.popularity;
    if (mission.kind==='articulacao') return this.missionPayers.size;
    if (mission.kind==='entrega') return this.missionCoffee.size;
    return mission.current;
  }

  progress(metrics:AgendaMetrics, gains:Partial<Record<Agenda,number>> = {}) {
    const reward = {xp:0,cash:0,popularity:0};
    const completed:Mission[] = [];
    for (const mission of this.missions) {
      const current = this.missionProgress(metrics,mission)+(gains[mission.kind] ?? 0);
      mission.current = Math.min(current,mission.target);
      if (current>=mission.target) {
        this.factsByMission.delete(mission.id);
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
