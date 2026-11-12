import type { GameplayEvent } from '../src/gameplay';
import { agendas, missionReward, type Agenda, type Mission, type PoliticsView } from '../src/politics';
import { applyFacts, photoMissions } from './photo-missions';

type AgendaMetrics = Readonly<{wallet:number; popularity:number}>;

const activityMissions = {
  protocolo:(event:GameplayEvent) => event.type==='filed',
  sigilo:(event:GameplayEvent) => event.type==='dropped' && !event.witnesses.length,
  joguinho:(event:GameplayEvent) => event.type==='game-won' && !event.witnesses.length,
} satisfies Partial<Record<Agenda,(event:GameplayEvent)=>boolean>>;
const missionTargets:Partial<Record<Agenda,number>> = {
  protocolo:1, entrega:3, sigilo:1, joguinho:1,
  fortuna:12, campanha:65, articulacao:2, projetos:2, oposicao:2, escandalo:1, auditoria:1, emenda:1, votacao:1, cafe:1, leitura:1, credencial:1,
};
const activeMissionCount = 3;

export class PersonalAgenda {
  private missions:Mission[] = [];
  private completed:Mission[] = [];
  private missionDeck:Agenda[];
  private nextMissionId = 0;
  private photoFacts = new Map<number,Map<string,Set<string>>>();
  private missionPayers = new Set<string>();
  private missionCoffee = new Set<string>();
  private paid = false;

  constructor(metrics:AgendaMetrics, playerCount:number, random:()=>number) {
    const deck = (Object.keys(agendas) as Agenda[]).filter(kind =>
      kind!=='cafe' && kind!=='entrega' && !Object.hasOwn(activityMissions,kind) && !Object.hasOwn(photoMissions,kind) && (playerCount>=3 || (kind!=='articulacao' && kind!=='escandalo')));
    const visualDeck = (Object.keys(photoMissions) as (keyof typeof photoMissions)[])
      .filter(kind=>photoMissions[kind].players<=playerCount);
    const offset = Math.floor(random()*deck.length);
    const ordered = [...deck.slice(offset),...deck.slice(0,offset)];
    this.missionDeck = ['cafe',...ordered.slice(0,2),
      ...(playerCount>1 ? visualDeck.slice(0,3) : []),'protocolo','sigilo','joguinho',...ordered.slice(2),
      ...visualDeck.slice(playerCount>1 ? 3 : 0),...(playerCount>=4 ? ['entrega'] as const : [])];
    this.fillMissions(metrics);
  }

  recordPayment(metrics:AgendaMetrics, from:string) {
    if (this.missions.some(mission=>mission.kind==='articulacao')) this.missionPayers.add(from);
    this.progress(metrics);
  }

  recordGameplay(metrics:AgendaMetrics, event:GameplayEvent, scandalPizza:boolean) {
    const gains:Partial<Record<Agenda,number>> = {};
    for (const [mission,matches] of Object.entries(activityMissions)) {
      if (matches(event)) gains[mission as Agenda] = 1;
    }
    for (const mission of this.missions) {
      const rule = photoMissions[mission.kind as keyof typeof photoMissions];
      if (!rule || (mission.kind==='pizzada' && !scandalPizza)) continue;
      const facts = rule.facts(event);
      if (!facts.length) continue;
      let seen = this.photoFacts.get(mission.id);
      if (!seen) this.photoFacts.set(mission.id,seen=new Map());
      gains[mission.kind] = Math.max(0,applyFacts(seen,facts)-mission.current);
    }
    if (event.kind==='coffee') {
      if (event.type==='used') gains.cafe = 1;
      if (event.type==='transferred' && event.target && this.missions.some(mission=>mission.kind==='entrega')) {
        this.missionCoffee.add(event.target);
      }
    }
    this.progress(metrics,gains);
  }

  private fillMissions(metrics:AgendaMetrics) {
    while (this.missions.length<activeMissionCount) {
      const index = this.missionDeck.findIndex(kind => !this.missions.some(mission => mission.kind===kind) &&
        (kind!=='campanha' || metrics.popularity<100));
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
    for (const mission of this.missions) {
      const current = this.missionProgress(metrics,mission)+(gains[mission.kind] ?? 0);
      mission.current = Math.min(current,mission.target);
      if (current>=mission.target) {
        this.photoFacts.delete(mission.id);
        this.completed.push({...mission});
      }
    }
    this.missions = this.missions.filter(mission => mission.current<mission.target);
    this.fillMissions(metrics);
  }

  settle(metrics:AgendaMetrics) {
    if (this.paid) return 0;
    for (const mission of this.missions) mission.current = this.missionProgress(metrics,mission);
    this.paid = true;
    return this.completed.reduce((total,mission)=>total+missionReward(mission.kind),0);
  }

  hasActive(kind:Agenda) {
    return this.missions.some(mission=>mission.kind===kind);
  }

  view(metrics:AgendaMetrics):PoliticsView['missions'] {
    return {
      active:this.missions.map(mission=>({...mission,current:this.paid ? mission.current : this.missionProgress(metrics,mission)})),
      completed:this.completed.map(mission=>({...mission})),
      paid:this.paid,
    };
  }
}
