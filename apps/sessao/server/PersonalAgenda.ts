import { isOfficeFurniture, officeGoods, privateOffices } from '../src/private-offices';
import type { GameplayEvent } from '../src/gameplay';
import { agendas, AGENDA_TRANSFER_MIN, missionCategory, missionReward, type Agenda, type Mission, type PoliticsView } from '../src/politics';
import { applyFacts, photoMissions } from './photo-missions';

type AgendaMetrics = Readonly<{wallet:number; popularity:number}>;

const activityMissions = {
  protocolo:(event:GameplayEvent) => event.type==='filed',
  embolso:(event:GameplayEvent) => event.type==='money-pocketed' && event.kind==='briefcase',
  assinar:(event:GameplayEvent) => event.type==='signed' && !!event.target && event.target!==event.actor,
  transporte:(event:GameplayEvent) => event.type==='room-entered' && event.kind==='briefcase' && event.target===event.actor,
  equipamento:(event:GameplayEvent) => event.type==='purchased' && event.kind==='binoculars',
  presente:(event:GameplayEvent) => event.type==='transferred' && event.kind==='gift' && !!event.target && event.target!==event.actor,
  visitaArquivo:(event:GameplayEvent) => event.type==='room-entered' && event.place==='Arquivo',
  pizza:(event:GameplayEvent) => event.type==='used' && event.kind==='pizza',
  lagosta:(event:GameplayEvent) => event.type==='used' && event.kind==='lobster',
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
  articulacao:3, escandalo:3, entrega:4, assinaturas:3, assinar:2,
  recebido:2, pagamento:2, presente:2, visitaGabinete:2, jogarOculto:2,
};
const missionTargets:Partial<Record<Agenda,number>> = {
  entrega:3, fortuna:12, campanha:65, articulacao:2, projetos:2, oposicao:2,
  assinaturas:2, passeio:3, jogar:30_000, jogarOculto:30_000, pausaCafe:10_000, ostentacao:5,
};
const initialCaprichos = ['pizza','jogar','selfieSolo','passeio'] as const;
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
  private furnishingPurchases = 0;
  private cannotVote = false;
  private ballotsLeft = 3;

  constructor(metrics:AgendaMetrics, private playerCount:number, random:()=>number,
    private reward:(amount:number)=>void) {
    const deck = Object.keys(agendas) as Agenda[];
    const missions = deck.filter(kind=>missionCategory(kind)==='Missão' && this.eligible(kind,metrics));
    const mission = missions[Math.floor(random()*missions.length)];
    const capricho = initialCaprichos[Math.floor(random()*initialCaprichos.length)];
    const offset = Math.floor(random()*deck.length);
    const ordered = [...deck.slice(offset),...deck.slice(0,offset)];
    this.missionDeck = ['cafe',mission,capricho,...ordered.filter(kind=>kind!=='cafe' && kind!==mission && kind!==capricho)];
    this.fillMissions(metrics);
  }

  recordPayment(metrics:AgendaMetrics, from:string) {
    if (this.hasActive('articulacao')) this.missionPayers.add(from);
    this.progress(metrics,{recebido:1});
  }

  recordTransfer(metrics:AgendaMetrics, amount:number) {
    if (amount>=AGENDA_TRANSFER_MIN) this.progress(metrics,{pagamento:1});
  }

  recordSignature(metrics:AgendaMetrics, document:number, signer:string) {
    const mission = this.missions.find(mission=>mission.kind==='assinaturas');
    if (mission) this.progress(metrics,{assinaturas:this.countFacts(mission,[{value:signer,group:String(document)}])});
  }

  updateEligibility(metrics:AgendaMetrics, playerCount:number, canVote:boolean, ballotsLeft:number) {
    this.playerCount = playerCount;
    this.cannotVote = !canVote;
    this.ballotsLeft = ballotsLeft;
    this.missions = this.missions.filter(mission=>{
      if (this.availableInMatch(mission.kind,mission.target-mission.current)) return true;
      this.factsByMission.delete(mission.id);
      return false;
    });
    this.fillMissions(metrics);
  }

  private availableInMatch(kind:Agenda, remaining:number) {
    const players = minimumPlayers[kind] ?? photoMissions[kind as keyof typeof photoMissions]?.players ?? 1;
    if (players>this.playerCount) return false;
    if (kind==='projetos' || kind==='oposicao' || kind==='apoio' || kind==='votacao') {
      return !this.cannotVote && this.ballotsLeft>=remaining;
    }
    return !this.cannotVote || !['propaganda','discurso','emenda','auditoria'].includes(kind);
  }

  private countFacts(mission:Mission, facts:Parameters<typeof applyFacts>[1]) {
    let seen = this.factsByMission.get(mission.id);
    if (!seen) this.factsByMission.set(mission.id,seen=new Map());
    return Math.max(0,applyFacts(seen,facts)-mission.current);
  }

  recordGameplay(metrics:AgendaMetrics, event:GameplayEvent, scandalPizza:boolean) {
    const key = JSON.stringify([event.type,event.at,event.item,event.target,event.kind,event.place,event.photo?.id]);
    if (this.seenEvents.has(key)) return;
    this.seenEvents.add(key);
    const gains:Partial<Record<Agenda,number>> = {};
    if (event.type==='purchased' && event.kind) this.acquired.add(event.kind);
    if (event.type==='purchased' && event.kind && isOfficeFurniture(event.kind)) {
      gains.ostentacao = officeGoods[event.kind].price;
      this.furnishingPurchases += gains.ostentacao;
    }
    for (const mission of this.missions) {
      const kind = mission.kind;
      const matches = activityMissions[kind as keyof typeof activityMissions];
      if (matches?.(event)) gains[kind] = 1;
      const rule = photoMissions[kind as keyof typeof photoMissions];
      if (rule && (kind!=='pizzada' || scandalPizza)) {
        gains[kind] = this.countFacts(mission,rule.facts(event));
      }
      if (kind==='assinaturas' && event.type==='edited' && event.item!==undefined) {
        const facts = this.factsByMission.get(mission.id);
        if (facts?.delete(String(event.item))) mission.current = Math.max(0,...[...facts.values()].map(group=>group.size));
      }
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
    return true;
  }

  private eligible(kind:Agenda, metrics:AgendaMetrics) {
    return this.availableInMatch(kind,missionTargets[kind] ?? 1) &&
      (kind!=='campanha' || metrics.popularity<100) &&
      (kind!=='equipamento' || !this.acquired.has('binoculars')) &&
      (kind!=='poltrona' || !this.acquired.has('officeChair')) &&
      (kind!=='ostentacao' || this.furnishingPurchases<=2);
  }

  private fillMissions(metrics:AgendaMetrics) {
    while (this.missions.length<activeMissionCount) {
      const recent = this.completed.at(-1)?.kind;
      const canDraw = (kind:Agenda) => this.eligible(kind,metrics) && !this.hasActive(kind);
      const fresh = this.missionDeck.findIndex(kind=>kind!==recent && canDraw(kind));
      const index = fresh>=0 ? fresh : this.missionDeck.findIndex(canDraw);
      if (index<0) return;
      const [kind] = this.missionDeck.splice(index,1);
      this.missionDeck.push(kind);
      let target = photoMissions[kind as keyof typeof photoMissions]?.target ?? missionTargets[kind] ?? 1;
      if (kind==='fortuna') target = Math.max(target,metrics.wallet+4);
      if (kind==='campanha') target = Math.min(100,Math.max(target,metrics.popularity+15));
      if (kind==='articulacao') this.missionPayers.clear();
      if (kind==='entrega') this.missionCoffee.clear();
      this.missions.push({id:++this.nextMissionId,kind,current:0,target});
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
    let reward = 0;
    for (const mission of this.missions) {
      const current = this.missionProgress(metrics,mission)+(gains[mission.kind] ?? 0);
      mission.current = Math.min(current,mission.target);
      if (current>=mission.target) {
        this.factsByMission.delete(mission.id);
        this.completed.push({...mission});
        reward += missionReward(mission.kind);
      }
    }
    this.missions = this.missions.filter(mission => mission.current<mission.target);
    if (reward) {
      this.reward(reward);
      this.progress(metrics);
    }
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
