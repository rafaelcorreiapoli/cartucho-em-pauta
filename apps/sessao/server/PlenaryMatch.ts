import {investmentImpact,type InvestmentAnnouncement} from '../src/public-investments';
import { StationCooldowns } from './StationCooldowns';
import type {SessionParticipant} from '../src/plenary';
import {Complaints} from './Complaints';
import {complaintRules} from '../src/complaints';
import type {Photo} from '../src/photography';
import {Fire} from './Fire';
import {canActOnFire,fireRules,fireSites,type FireAction,type FireInteraction} from '../src/fire';
import {Power} from './Power';
import {canOperatePanel,powerPanels,powerRules,type PowerAction,type PowerPanel} from '../src/power';
import { npcRules } from '../src/parliamentarians';
import type { AttributeRequest } from '../src/progression';
import { canInteract } from '../src/interactions';
import { publishGameplay, type GameplayWorld } from './gameplay-world';
import {cashAmount,type GameplayEvent} from '../src/gameplay';
import { ELECTION_RULES as rules, type ElectionAction } from '../src/elections';
import { ElectionCycle } from './ElectionCycle';
import {
  BALLOT_MS, payrollRules, type PayrollView, majorityQuorum, CASSATION_NOTICE_MS, bills, MIN_PLAYERS, projectRules, stations, canReachStation, stabilityRules, publicDebtRules, publicDebtStabilityLoss,
  campaignPolicyMultiplier, energySavings, pingaProgram, bankAuditCost, policyDuration, type BillPolicies, type BillPolicy, type Action, type BillVote, type Impact, type Outcome, type Phase, type PlenaryView, type Role, type Vote,
} from '../src/plenary';
import {isolationRoom,localPerception,roomAt,type Player} from '../src/map';
import { cassationFee } from '../src/npcs';
import { CRISIS_MISSION_STABILITY_LIMIT, CASSATION_POPULARITY, HEARING_MS, HEARING_IMMUNITY_MS, SUSPENSION_MS, TRADE_RADIUS, type Contact, type PoliticsAction } from '../src/politics';
import type { RoomActivity, RoomActivityResult } from '../src/room-activities';
import { PoliticalEconomy } from './PoliticalEconomy';

const clamp = (value:number) => Math.max(0,Math.min(stabilityRules.maximum,value));

export class PlenaryMatch {
  phase: Phase = 'lobby';
  private round = 0;
  private proposal?:{project:number; proposer:string; voteAt:number};
  private protocolOpensAt = 0;
  private agendaNow = 0;
  private pausedGameTime?: number;
  private pausedDuration = 0;
  private voteEndsAt = 0;

  get voting() { return this.pausedGameTime!==undefined; }

  // Gameplay deadlines exclude time spent on open ballots. Ballot deadlines use the room clock.
  gameTime(realNow:number) { return this.pausedGameTime ?? realNow-this.pausedDuration; }

  private openVote(phase:'ballot'|'hearing',realNow:number,gameNow:number,duration:number) {
    this.pausedGameTime = gameNow;
    this.voteEndsAt = realNow+duration;
    this.phase = phase;
    this.economy.interruptPlenaryVisits();
  }

  private agendaBallotsLeft = -1;
  private get sessionEndsAt() { return this.started+rules.matchDuration; }
  private readonly complaints = new Complaints();
  private readonly fire = new Fire();
  private power = new Power();
  get powerOut() { return this.running && this.power.active; }
  get projectIndex() { return this.proposal?.project; }
  private started = 0;
  private readonly policies = new Map<BillPolicy,number>();
  private activePolicies(now:number):BillPolicies {
    return Object.fromEntries([...this.policies].filter(([,until])=>until>now));
  }

  transportActive(now:number) {
    return this.running && (this.policies.get('transport') ?? 0)>now;
  }

  private treasuryBonus?:{until:number;amount:number};
  private treasuryReputation = new Map<string,number>();
  private npcVotes = new Map<string,Vote>();
  private npcIds = new Set<string>();

  addParliamentarian(player:Player) {
    if (this.npcIds.has(player.id) || this.electorate.has(player.id)) return;
    this.npcIds.add(player.id);
    const [min,max] = npcRules.startingWallet;
    const wallet = min+Math.floor(Math.random()*(max-min+1));
    this.economy.addParliamentarian({id:player.id,name:player.nick,character:player.character},wallet);
    this.cash.npcIssued += wallet;
  }

  private cash = {initial:0,npcIssued:0,spawned:0,expired:0,treasury:0,salaries:0,publicDuty:0,projects:0,cassationFees:0,diverted:0};

  economySummary(physical:number) {
    const totals = this.economy.totals();
    const issued = this.cash.initial+this.cash.npcIssued+this.cash.spawned;
    const spent = this.cash.expired+this.cash.publicDuty+this.cash.projects+this.cash.cassationFees;
    const held = totals.humans+totals.npcs+totals.reserve+physical+this.budget;
    return {...totals,...this.cash,physical,budget:this.budget,issued,spent,
      discrepancy:Math.round((issued-spent-held)*10)/10 || 0};
  }

  private get criticalStability() { return this.stability<CRISIS_MISSION_STABILITY_LIMIT; }

  private get canArticulateBeforeDeadline() {
    return this.running && this.agendaNow<this.sessionEndsAt;
  }

  private canFightCrisis(id:string) {
    return this.criticalStability && this.canArticulateBeforeDeadline && (this.fire.burning || this.canRepairOutage(id));
  }

  setAgendaMailAvailability(nextPublicationAt:(id:string)=>number,agendaSelfies?:Parameters<PoliticalEconomy['setAgendaMailAvailability']>[1],agendaReportNotices?:(id:string)=>readonly number[]) {
    this.economy.setAgendaMailAvailability(id=>this.canPublishBeforeDeadline(id,nextPublicationAt(id)),agendaSelfies,agendaReportNotices);
  }

  private canPublishBeforeDeadline(id:string,nextPublicationAt:number) {
    if (!this.running || this.expelled.has(id)) return false;
    return Math.max(this.agendaNow,nextPublicationAt,this.economy.suspensionEndsAt(id) ?? 0)<this.sessionEndsAt;
  }

  setAgendaCashAvailability(check:Parameters<PoliticalEconomy['setAgendaCashAvailability']>[0]) {
    this.economy.setAgendaCashAvailability(check);
  }

  setAgendaCommerce(now:()=>number) {
    this.economy.setAgendaCommerce(()=>({policies:this.activePolicies(now()),publicBudget:this.budget}));
  }

  setAgendaXrayAvailability(canUse:(id:string,wallet:number)=>boolean) {
    this.economy.setAgendaXrayAvailability(canUse);
  }

  setAgendaInventory(...inventory:Parameters<PoliticalEconomy['setAgendaInventory']>) {
    this.economy.setAgendaInventory(...inventory);
  }

  private readonly disconnected = new Set<string>();

  setPlayerConnected(id:string,connected:boolean) {
    if (connected) this.disconnected.delete(id);
    else {
      this.disconnected.add(id);
      this.power.remove(id);
    }
    if (this.running) this.refreshAgendaEligibility();
  }

  private remainingAgendaBallots(now:number) {
    const inBallot = this.phase==='ballot';
    const freeAt = Math.max(now,this.cassationAt ?? now);
    const first = inBallot ? now+projectRules.cooldownMs+projectRules.debateMs : this.proposal
      ? Math.max(freeAt,this.proposal.voteAt)
      : Math.max(freeAt,this.protocolOpensAt)+projectRules.debateMs;
    const cycle = projectRules.cooldownMs+projectRules.debateMs;
    const future = first>=this.sessionEndsAt ? 0 : 1+Math.floor((this.sessionEndsAt-first-1)/cycle);
    return Math.min(bills.length-this.outcomes.length,future+Number(inBallot));
  }

  refreshAgendaEligibility(now=this.agendaNow) {
    this.agendaNow = Math.max(this.agendaNow,now);
    this.agendaBallotsLeft = this.remainingAgendaBallots(this.agendaNow);
    const agendaPlayers = this.expelled.size
      ? new Set([...this.electorate].filter(id=>!this.expelled.has(id)))
      : this.electorate;
    this.economy.updateAgendaEligibility(agendaPlayers,this.agendaBallotsLeft,id=>!!this.election.office(id),this.round,this.disconnected,id=>this.election.hasFutureAdvertising(id,this.agendaNow));
  }

  former(id:string) { return this.electorate.has(id) && !this.election.office(id); }

  private hasFutureVoteNegotiation(now:number) {
    return this.remainingAgendaBallots(now)>Number(this.phase==='ballot');
  }

  negotiableProject(now:number) {
    if (this.phase==='negotiation' && this.hasFutureVoteNegotiation(now)) return this.projectIndex;
  }

  get projectRound() { return this.round; }

  recordNpcVote(id:string,vote:Vote) {
    if (this.phase==='ballot' && this.npcIds.has(id) && !this.npcVotes.has(id)) this.npcVotes.set(id,vote);
  }

  private changeBudget(amount:number,now:number) {
    this.budget = Math.round((this.budget+amount)*10)/10;
    this.nextDebtPenaltyAt = this.budget<0 ? this.nextDebtPenaltyAt ?? now+publicDebtRules.interval : undefined;
  }

  private applyDebtPenalty(now:number) {
    const due = this.nextDebtPenaltyAt;
    if (due===undefined || now<due) return;
    const intervals = 1+Math.floor((now-due)/publicDebtRules.interval);
    this.nextDebtPenaltyAt = due+intervals*publicDebtRules.interval;
    this.stability = clamp(this.stability-intervals*publicDebtStabilityLoss(this.budget));
    if (!this.stability) this.finish(this.infiltrators.size ? 'Infiltrado' : undefined,'A dívida pública derrubou a estabilidade.');
  }

  private nextPayrollAt = 0;
  private lastPayroll?:{at:number;recipients:Set<string>};

  private payrollRecipients() {
    return new Set([...this.election.mandateIds(),...this.npcIds]);
  }

  private payrollView(id:string,now:number):PayrollView {
    return {
      next:this.running && this.nextPayrollAt<this.sessionEndsAt ? {
        remaining:Math.max(0,Math.ceil((this.nextPayrollAt-now)/1000)),
        cost:this.payrollRecipients().size*payrollRules.salary,
      } : undefined,
      last:this.lastPayroll && {at:this.lastPayroll.at,received:this.lastPayroll.recipients.has(id) ? payrollRules.salary : 0},
    };
  }

  private distributeSalaries(now:number) {
    while (this.nextPayrollAt<=now && this.nextPayrollAt<this.sessionEndsAt) {
      const recipients = this.payrollRecipients();
      for (const id of recipients) this.economy.earn(id,payrollRules.salary);
      const cost = recipients.size*payrollRules.salary;
      this.changeBudget(-cost,now);
      this.cash.salaries += cost;
      this.lastPayroll = {at:this.nextPayrollAt,recipients};
      this.nextPayrollAt += payrollRules.interval;
    }
  }

  private advertisementMultiplier(now:number) {
    return (this.policies.get('campaign') ?? 0)>now ? campaignPolicyMultiplier : 1;
  }

  private renew(now:number) {
    const previous = this.election.eliminated;
    const cycle = this.election.currentCycle;
    this.election.advance(now,this.popularity,this.advertisementMultiplier(now));
    const eliminated = this.election.eliminated;
    if (eliminated && eliminated!==previous) {
      this.votes.delete(eliminated);
    }
    if (cycle!==this.election.currentCycle) {
      const publicDuty = rules.publicDuty-(this.energySavingsActive(now) ? energySavings.publicDutyDiscount : 0);
      this.changeBudget(-publicDuty,now);
      this.cash.publicDuty += publicDuty;
      this.treasuryReputation.clear();
      this.refreshAgendaEligibility();
    }
    if (this.infiltrators.size && [...this.infiltrators].every(id=>!this.election.office(id))) {
      this.finish('Parlamentar','Todos os infiltrados perderam o mandato.');
    }
  }

  constructor(
    readonly minimumPlayers = MIN_PLAYERS,
    private readonly stationCooldowns = new StationCooldowns(),
    private readonly localSolo = false,
  ) {}

  private ends = 0;
  private stability:number = stabilityRules.initial;
  private budget:number = rules.startingBudget;
  private nextDebtPenaltyAt?:number;
  private initialPlayers = 0;
  private electorate = new Set<string>();
  private votes = new Map<string,BillVote>();
  private voteIntents = new Map<string,Vote>();
  private infiltrators = new Set<string>();
  private economy = new PoliticalEconomy();
  private election = new ElectionCycle();
  private objector?:string;
  private popularity = (id:string) => this.economy.popularity(id);
  private eventSequence = 0;
  private eventSequenceAtStart = 0;
  private matchGeneration = 0;
  private readonly receivedEvents = new Set<number>();
  private readonly filedDocuments = new Set<number>();
  private readonly studiedBills = new Map<number,Set<string>>();
  private hearingTarget?: string;
  private cassationAt?:number;
  private cassationCall?:{caller:string;calledAt:number};
  private cassationOpen = false;
  private readonly cassationVotes = new Map<string,string|null>();
  private readonly expelled = new Set<string>();
  private cassationResult?:{text:string};
  private readonly hearingImmunity = new Map<string,number>();
  private hearingResult?: string;
  private auditNotes = new Map<string,string>();
  private infiltratorName?: string;
  private fraud = false;
  private reportedFraud = false;
  private audits = new Map<string,'clean' | 'fraud'>();
  private outcomes: Outcome[] = [];
  private winner?: Role;
  private congressDestroyed?: boolean;
  private finalRoster:SessionParticipant[] = [];
  private reason?: string;

  get running() { return this.phase==='negotiation' || this.phase==='ballot' || this.phase==='hearing'; }

  start(requester:string, players:Player[], now:number, random = Math.random, requested=1, asInfiltrator=false) {
    players = players.filter(player=>!player.npc);
    const ids = players.map(({id}) => id);
    if (this.running || ids.length<this.minimumPlayers || ids[0]!==requester) return false;
    this.electorate = new Set(ids);
    this.disconnected.clear();
    this.treasuryReputation.clear();
    this.npcIds.clear();
    this.npcVotes.clear();
    this.initialPlayers = ids.length;
    const forceHost = this.localSolo && asInfiltrator;
    const candidates = forceHost ? players.slice(1) : [...players];
    const count = ids.length===1 && !forceHost ? 0 : ids.length>=6 && requested===2 ? 2 : 1;
    this.infiltrators.clear();
    if (forceHost) this.infiltrators.add(requester);
    while (this.infiltrators.size<count) {
      this.infiltrators.add(candidates.splice(Math.floor(random()*candidates.length),1)[0].id);
    }
    const contacts = players.map(player => ({id:player.id,name:player.nick,character:player.character}));
    this.finalRoster = contacts.map(contact=>({...contact,role:this.infiltrators.has(contact.id) ? 'Infiltrado' : 'Parlamentar'}));
    this.pausedGameTime = undefined;
    this.pausedDuration = 0;
    this.started = now;
    this.nextPayrollAt = now+payrollRules.interval;
    this.lastPayroll = undefined;
    this.fire.reset(now,random);
    this.power = new Power();
    this.stationCooldowns.reset();
    this.policies.clear();
    this.treasuryBonus = undefined;
    this.complaints.reset();
    this.matchGeneration++;
    this.eventSequenceAtStart = this.eventSequence;
    this.receivedEvents.clear();
    this.filedDocuments.clear();
    this.studiedBills.clear();
    let campaignReady = false;
    this.economy.reset(contacts,random,(id,kind)=>{
      if (!campaignReady) return true;
      if (kind==='leitura') {
        const project = this.proposal?.project;
        if (this.phase!=='ballot' && project!==undefined && !this.studiedBills.get(project)?.has(id)) return true;
        return this.remainingAgendaBallots(this.agendaNow)>Number(this.phase==='ballot' || project!==undefined);
      }
      if (kind==='votoNpc') return this.hasFutureVoteNegotiation(this.agendaNow);
      if (kind==='responderCrise') return this.canArticulateBeforeDeadline;
      return this.election.canCampaignAction(id,kind);
    });
    this.economy.setAgendaCrisisAvailability(id=>this.canRepairOutage(id),id=>this.canFightCrisis(id));
    const {humans,reserve} = this.economy.totals();
    this.cash = {initial:humans+reserve+rules.startingBudget,npcIssued:0,spawned:0,expired:0,treasury:0,salaries:0,publicDuty:0,projects:0,cassationFees:0,diverted:0};
    this.election.reset(players.map(({id,nick,character}) => ({id,name:nick,character})),now,random);
    campaignReady = true;
    this.infiltratorName = [...this.infiltrators].map(id => this.economy.name(id)).join(', ') || undefined;
    this.hearingImmunity.clear();
    this.hearingTarget = this.hearingResult = undefined;
    this.cassationAt = this.cassationResult = undefined;
    this.cassationCall = undefined;
    this.cassationOpen = false;
    this.cassationVotes.clear();
    this.expelled.clear();
    this.stability = stabilityRules.initial;
    this.budget = rules.startingBudget;
    this.nextDebtPenaltyAt = undefined;
    this.round = 0;
    this.protocolOpensAt = now;
    this.agendaNow = now;
    this.agendaBallotsLeft = -1;
    this.outcomes = [];
    this.winner = this.reason = this.congressDestroyed = undefined;
    this.nextRound();
    return true;
  }

  private agendaYesVotes = new Set<string>();

  private nextRound() {
    this.proposal = undefined;
    this.resetVote();
    this.phase = 'negotiation';
    this.ends = this.sessionEndsAt;
  }

  private resetVote() {
    this.voteIntents.clear();
    this.agendaYesVotes.clear();
    this.votes.clear();
    this.npcVotes.clear();
    this.audits.clear();
    this.auditNotes.clear();
    this.objector = undefined;
    this.fraud = this.reportedFraud = false;
  }

  leave(id:string, now:number) {
    this.power.remove(id);
    this.disconnected.delete(id);
    if (!this.running || !this.electorate.delete(id)) return;
    this.votes.delete(id);
    this.cassationVotes.delete(id);
    this.voteIntents.delete(id);
    this.election.leave(id,now);
    this.refreshAgendaEligibility();
    this.economy.cancelOffers(id);
    if (this.infiltrators.size && ![...this.infiltrators].some(infiltrator => this.election.office(infiltrator))) this.finish('Parlamentar','Nenhum infiltrado permanece com mandato.');
    else if (this.electorate.size<Math.min(3,this.initialPlayers)) this.finish(undefined,'Partida encerrada: faltaram jogadores.');
  }

  private publishActivity(player:Player,type:GameplayEvent['type'],now:number,
    details?:Pick<GameplayEvent,'target'|'amount'|'duration'|'place'|'project'>,publish:GameplayWorld['publish']=event=>this.recordGameplay(event)) {
    publishGameplay({players:[],now,nextEventId:()=>++this.eventSequence,publish},
      player,type,{...details,witnesses:[]});
  }

  private recordGameplay(event:GameplayEvent):boolean {
    if (!this.running || event.at<this.started) return false;

    const project = event.type==='filed' ? event.project : undefined;
    if (project!==undefined && this.projectFilingError(event.actor,project,event.at)) return false;
    if (event.eventId!==undefined) {
      if (event.eventId<=this.eventSequenceAtStart || this.receivedEvents.has(event.eventId)) return false;
      this.receivedEvents.add(event.eventId);
    }
    if (event.type==='bill-studied') {
      const studied = event.project;
      if (studied===undefined || this.phase!=='negotiation' || this.proposal?.project!==studied) return false;
      const readers = this.studiedBills.get(studied) ?? new Set<string>();
      if (readers.has(event.actor)) return false;
      readers.add(event.actor);
      this.studiedBills.set(studied,readers);
    }
    if (event.type==='filed' && event.item!==undefined) {
      if (this.filedDocuments.has(event.item)) return false;
      this.filedDocuments.add(event.item);
    }
    if (project!==undefined) {
      this.proposal = {project,proposer:this.economy.name(event.actor),voteAt:event.at+projectRules.debateMs};
      this.refreshAgendaEligibility(event.at);
    }
    this.complaints.record(event,this.started);
    this.economy.recordGameplay(event);
    const changedSpyCustody = (event.kind==='wiretap' || event.kind==='spyCamera') &&
      (event.type==='collected' || event.type==='dropped' || event.type==='transferred' ||
        event.type==='stored' || event.type==='recovered' || event.type==='destroyed');
    const changedPizza = event.kind==='pizza' && (event.type==='installed' || event.type==='uninstalled' || event.type==='slice');
    const changedCashCustody = event.kind && cashAmount(event.kind) &&
      (event.type==='npc-robbed' || event.type==='delivered' || event.type==='money-pocketed' ||
        event.type==='cash-received' || event.type==='collected' || event.type==='dropped' ||
        event.type==='stored' || event.type==='recovered');
    if (changedCashCustody || changedSpyCustody || changedPizza || event.kind==='xray' || event.type==='photo-published' || event.type==='mail-published' && !!event.photo || event.type==='spy-removed' || event.type==='spy-installed' || event.type==='advertisement-aired' ||
        (event.kind==='vip' || event.kind==='portrait') && (event.type==='installed' || event.type==='uninstalled' || event.type==='marked')) this.refreshAgendaEligibility();
    return true;
  }

  private projectFilingClosed(now:number) {
    return Math.max(now,this.protocolOpensAt)+projectRules.debateMs>=this.sessionEndsAt;
  }

  private projectFilingError(id:string,project:number,now:number) {
    if (!bills[project] || !this.canVote(id)) return 'Somente jogadores com mandato podem protocolar projetos.';
    if (this.outcomes.some(outcome=>outcome.project===project)) return 'Esse projeto já foi votado nesta partida.';
    if (this.proposal) return 'Já há um projeto em pauta.';
    if (this.phase!=='negotiation' || this.cassationAt!==undefined) return 'O Protocolo aguarda a liberação do Plenário.';
    if (this.projectFilingClosed(now)) return 'Não há tempo para votar outro projeto nesta partida.';
    if (now<this.protocolOpensAt) return `Protocolo disponível em ${Math.ceil((this.protocolOpensAt-now)/1000)} s.`;
  }

  act(player:Player, action:Action, now:number) {
    if (!this.canVote(player.id) || (action!=='audit' && (!this.proposal || this.projectVoteExpired(now)))) return;
    if (this.phase!=='negotiation' || now>=this.ends) {
      if (action==='audit') return {text:'A auditoria só pode ser feita durante a articulação.',critical:false};
      return;
    }
    if (!this.at(player,action==='fraud' ? 'panel' : action)) {
      if (action==='audit') return {text:'Chegue mais perto do ponto da Corregedoria.',critical:false};
      return;
    }
    if (action==='fraud' && this.infiltrators.has(player.id) && !this.economy.suspended(player.id) && !this.fraud) {
      this.fraud = true;
      this.audits.clear();
    }
    if (action==='audit') {
      if (this.proposal) this.audits.set(player.id,this.fraud ? 'fraud' : 'clean');
      this.publishActivity(player,'audit-performed',now);
      const fee = bankAuditCost(this.activePolicies(now));
      const note = this.economy.audit(player.id,this.round,1,fee);
      if (note) this.auditNotes.set(player.id,note);
      const finding = !this.proposal ? 'Nenhum projeto em pauta.' : this.reportedFraud ? 'O Painel já mostra os números corrigidos.' :
        this.fraud ? 'Fraude no projeto. Vá ao Painel para corrigir os números.' : 'Os números do projeto conferem.';
      return {text:note ? `${finding} ${note}` : finding,critical:this.fraud && !this.reportedFraud};
    }
    if (action==='panel' && this.audits.get(player.id)==='fraud') this.reportedFraud = true;
  }

  roomActivity(player:Player, activity:Exclude<RoomActivity,'coffee'>, now:number,publish?:GameplayWorld['publish']):RoomActivityResult | undefined {
    const {id} = player;
    if (this.phase!=='negotiation' || now>=this.ends || !this.electorate.has(id) || this.isolated(id) || !this.at(player,activity)) return;
    const project = this.proposal?.project;
    if (project===undefined) return {activity,text:'Nenhum projeto em pauta.'};
    if (this.studiedBills.get(project)?.has(id)) return {activity,text:`Você já estudou o projeto ${bills[project].name}.`};
    this.publishActivity(player,'bill-studied',now,{project},publish);
    this.refreshAgendaEligibility(now);
    return {activity,text:`Você estudou o projeto ${bills[project].name}.`};
  }

  gameplayWorld(players:Player[], now:number, voice:(id:string)=>boolean):Omit<GameplayWorld,'publish'> & {publish:(event:GameplayEvent)=>boolean} {
    const generation = this.matchGeneration;
    const current = ()=>this.running && generation===this.matchGeneration;
    return {
      players:players.filter(player => this.electorate.has(player.id) || this.npcIds.has(player.id)),now,
      policies:this.activePolicies(now),publicBudget:this.budget,
      spendSubsidized:(id,price,subsidy)=>{
        if (!current() || Math.round(subsidy*10)>Math.round(this.budget*10) || !this.economy.spend(id,price)) return false;
        this.changeBudget(-subsidy,now);
        this.cash.projects += subsidy;
        return true;
      },
      plenary:this.phase!=='negotiation',started:this.started,wallet:id=>this.economy.wallet(id),spend:(id,amount)=>current() && this.economy.spend(id,amount),
      earnXp:(id,amount)=>{ if (current()) this.economy.earnXp(id,amount); },
      settleBet:(id,stake,payout,maxPayout)=>current() && this.economy.settleBet(id,stake,payout,maxPayout),
      office:id=>this.npcIds.has(id) ? 'deputy' : this.election.office(id),
      projectFilingError:(id,project)=>current() ? this.projectFilingError(id,project,now) : 'Partida encerrada.',
      projectSignatures:Math.max(0,Math.min(2,this.initialPlayers-1)),
      hasMandate:id=>this.npcIds.has(id) || !!this.election.office(id),
      cashFlow:(kind,amount)=>{ if (current()) this.cash[kind] += amount; },
      deposit:(id,amount)=>{
        if (!current() || !this.running || !this.electorate.has(id) || amount<=0) return false;
        this.cash.treasury += amount;
        this.changeBudget(amount,now);
        const credited = this.treasuryReputation.get(id) ?? 0;
        const gain = Math.max(0,Math.min(rules.treasuryReputationCap-credited,Math.floor(amount)));
        this.treasuryReputation.set(id,credited+gain);
        const bonus = this.treasuryBonus && now<this.treasuryBonus.until ? this.treasuryBonus.amount : 0;
        this.economy.changePopularity(id,gain+Math.min(gain,bonus));
        return true;
      },
      lootWallet:(id,fraction)=>current() && this.electorate.has(id) ? this.economy.takeWallet(id,fraction) : 0,
      takeWallet:id=>current() && this.npcIds.has(id) ? this.economy.takeWallet(id) : 0,
      paymentsLeft:id=>current() ? this.economy.paymentsLeft(id,this.round) : 0,
      payNpc:(from,to,amount)=>current() && this.npcIds.has(to) && this.economy.transfer(from,to,amount,true,this.round),
      hasEvidence:(id,kind)=>this.economy.hasEvidence(id,kind),
      callCassation:player=>current() ? this.callCassation(player,now) : 'Partida encerrada.',
      missionSwapUsed:id=>current() && this.economy.missionSwapUsed(id),
      swapMissions:id=>{
        if (!current() || this.phase!=='negotiation' || !this.canHandleObjects(id,now)) return 'unavailable';
        return this.economy.swapMissions(id);
      },
      hasMission:(id,mission)=>this.economy.hasMission(id,mission),voice,earn:(id,amount)=>{ if (current()) this.economy.earn(id,amount); },
      // An obsolete world must not mint an ID the next match would accept.
      nextEventId:()=>current() ? ++this.eventSequence : this.eventSequenceAtStart,
      publish:event=>current() && this.recordGameplay(event),
    };
  }

  allocateAttribute(player:Player, request:AttributeRequest, now:number) {
    return this.phase==='negotiation' && this.canHandleObjects(player.id,now) && this.ballotCountdown(now)===undefined &&
      !player.knockedOut && !player.carrying && !player.carried && this.economy.allocate(player.id,request);
  }

  isolated(id:string) { return this.running && (this.expelled.has(id) || this.economy.suspended(id)); }

  canHandleObjects(id:string, now:number) {
    return this.electorate.has(id) && !this.isolated(id) && now<this.ends && (this.phase==='negotiation' || this.phase==='ballot' || this.cassationOpen);
  }

  private projectVoteExpired(now:number) {
    return !!this.proposal && Math.max(this.proposal.voteAt,now)>=this.sessionEndsAt;
  }

  private projectWarning(now:number) {
    const at = this.proposal?.voteAt;
    if (this.phase!=='negotiation' || at===undefined || this.cassationAt!==undefined ||
        this.projectVoteExpired(now)) return;
    const seconds = Math.max(1,Math.ceil((at-now)/1000));
    if (seconds<=projectRules.warningSeconds) return seconds;
  }

  ballotCountdown(now:number) {
    const warning = this.projectWarning(now);
    if (warning!==undefined && warning<=projectRules.countdownSeconds) return warning;
  }

  declareVote(id:string,vote:Vote|null,now:number) {
    if (this.phase!=='negotiation' || !this.proposal || this.projectVoteExpired(now) || now>=this.ends || !this.canVote(id)) return;
    if (vote===null) this.voteIntents.delete(id);
    else this.voteIntents.set(id,vote);
  }

  vote(id:string, vote:BillVote, now:number) {
    if (this.cassationOpen || (this.phase!=='ballot' && this.phase!=='hearing') || now>=this.voteEndsAt || !this.canVote(id)) return;
    if (this.phase==='hearing' && vote==='abstain') return;
    const previous = this.votes.get(id);
    this.votes.set(id,vote);
    if (this.phase!=='ballot') return;
    const firstSupport = vote==='yes' && !this.agendaYesVotes.has(id);
    if (firstSupport) this.agendaYesVotes.add(id);
    if (previous===undefined || firstSupport) this.economy.recordVote(id,previous===undefined,firstSupport);
  }

  private canVoteInCassation(id:string) {
    return this.canVote(id) && !this.disconnected.has(id);
  }

  private canScheduleHearing(now:number,notice=0) {
    return this.phase==='negotiation' && this.cassationAt===undefined &&
      now+notice<this.sessionEndsAt;
  }

  private canCallHearing(id:string,now:number) {
    return this.canScheduleHearing(now) && this.canVote(id) && this.votingPlayers()>1 && this.economy.canCall(id);
  }

  callCassation(player:Player, now:number) {
    const {id} = player;
    if (!canInteract(player,stations.audit,{handsFree:true})) return 'Aproxime-se do balcão da Corregedoria.';
    if (!this.canScheduleHearing(now,CASSATION_NOTICE_MS) || this.ballotCountdown(now)!==undefined) {
      return 'Cassação indisponível neste momento.';
    }
    if (!this.canVoteInCassation(id)) return 'Você precisa de um mandato ativo para convocar.';
    if (this.popularity(id)<CASSATION_POPULARITY) return `Você precisa de ${CASSATION_POPULARITY} de popularidade.`;
    if (this.cassationElectorate().length<3) return 'São necessários pelo menos três eleitores elegíveis.';
    if (!this.economy.spend(id,cassationFee)) return 'Saldo insuficiente para convocar cassação.';
    this.cash.cassationFees += cassationFee;
    this.cassationAt = now+CASSATION_NOTICE_MS;
    this.cassationCall = {caller:id,calledAt:now};
    this.refreshAgendaEligibility(now);
  }

  private cassationElectorate() {
    return [...this.electorate].filter(id=>this.canVoteInCassation(id));
  }

  castCassation(id:string, candidate:string|null, now:number) {
    if (!this.cassationOpen || now>=this.voteEndsAt || !this.canVoteInCassation(id) ||
        (candidate!==null && (candidate===id || !this.canVoteInCassation(candidate)))) return;
    this.cassationVotes.set(id,candidate);
  }

  private cassationChoice(id:string) {
    if (!this.canVoteInCassation(id)) return undefined;
    const target = this.cassationVotes.get(id);
    return target == null || this.canVoteInCassation(target) ? target : undefined;
  }

  private resolveCassation(now:number) {
    const electorate = this.cassationElectorate();
    const tally = new Map<string,number>();
    for (const id of electorate) {
      const target = this.cassationChoice(id);
      if (target) tally.set(target,(tally.get(target) ?? 0)+1);
    }
    const majority = majorityQuorum(electorate.length);
    const result = [...tally].find(([,votes])=>votes>=majority);
    this.cassationCall = undefined;
    this.cassationOpen = false;
    this.cassationVotes.clear();
    this.phase = 'negotiation';
    this.ends = this.sessionEndsAt;
    if (!result) {
      this.cassationResult = {text:'Ninguém foi cassado. Nenhum suspeito recebeu a maioria dos votos.'};
      if (now<this.sessionEndsAt) this.refreshAgendaEligibility(now);
      return;
    }
    const [target,votes] = result;
    this.expelled.add(target);
    this.election.leave(target,now);
    this.voteIntents.delete(target);
    this.refreshAgendaEligibility();
    this.cassationResult = {text:`${this.economy.name(target)} perdeu o mandato com ${votes} votos.`};
    if (this.infiltrators.size && [...this.infiltrators].every(id=>!this.election.office(id))) {
      this.finish('Parlamentar','Todos os infiltrados foram eliminados.');
    }
  }

  private canVote(id:string) { return this.electorate.has(id) && !!this.election.office(id) && !this.economy.suspended(id); }

  private at(player:Player, key:keyof typeof stations) {
    return canReachStation(player,key);
  }

  private nearby(player:Player, other:Player) {
    return player.id!==other.id && this.electorate.has(other.id) &&
      canInteract(player,other,{radius:TRADE_RADIUS,handsFree:true});
  }

  private canReceivePix(id:string) {
    return this.electorate.has(id) && !this.disconnected.has(id) && !this.isolated(id);
  }

  private canSendPix(id:string, now:number) {
    return this.canReceivePix(id) && now<this.ends && (this.phase==='negotiation' || this.phase==='ballot');
  }

  contacts(player:Player, players:Player[]): Contact[] {
    return this.phase==='negotiation' || this.phase==='ballot' ? players.filter(other => this.nearby(player,other))
      .map(({id}) => ({id,name:this.economy.name(id)})) : [];
  }

  politics(player:Player, action:PoliticsAction, players:Player[], now:number) {
    const {id} = player;
    if (action.kind==='transfer') {
      return this.canSendPix(id,now) && this.canReceivePix(action.to) &&
        this.economy.transfer(id,action.to,action.amount,true,this.round,'pix');
    }
    const privateDeal = action.kind==='share' || action.kind==='accept' || action.kind==='cancel';
    if ((this.phase!=='negotiation' && !(this.phase==='ballot' && privateDeal)) ||
      now>=this.ends || !this.electorate.has(id) || this.isolated(id)) return;
    const near = (target:string) => players.some(other => other.id===target && this.nearby(player,other));
    switch (action.kind) {
      case 'grant': {
        if (!this.at(player,'cabinet') || !this.canVote(id) || this.ballotCountdown(now)!==undefined || this.budget<action.amount) break;
        const {invested,diverted,stability,hp,duration} = investmentImpact(action.amount,action.diversion);
        if (!this.economy.grant(id,diverted,this.round,now)) break;
        this.changeBudget(-action.amount,now);
        this.cash.diverted += diverted;
        this.cash.projects += invested;
        const wasCritical = this.criticalStability;
        this.stability = clamp(this.stability+stability);
        if (action.area==='safety') this.fire.delayNextFire(duration);
        if (action.area==='supplies' || action.area==='transport') {
          this.policies.set(action.area,Math.max(now,this.policies.get(action.area) ?? 0)+duration);
        }
        if ((this.fire.burning || this.powerOut) && wasCritical!==this.criticalStability) this.refreshAgendaEligibility(now);
        const announcement:InvestmentAnnouncement = {author:player.nick,area:action.area,amount:action.amount};
        return {announcement,hp:action.area==='health' ? hp : 0};
      }
      case 'share':
        if (near(action.to)) this.economy.share(id,action.to,action.evidence,action.price);
        break;
      case 'accept': {
        const offer = this.economy.offer(action.offer);
        if (offer && near(offer.from)) this.economy.accept(id,action.offer,this.round);
        break;
      }
      case 'cancel':
        this.economy.cancel(id,action.offer);
        break;
      case 'publish': {
        if (!this.at(player,'press')) break;
        const published = this.economy.publish(id,action.evidence);
        if (published) this.election.scandal(published.from);
        break;
      }
      case 'hearing':
        if (!this.canCallHearing(id,now) || !this.canVote(action.target) ||
            (this.hearingImmunity.get(action.target) ?? 0)>now || id===action.target || !this.at(player,'panel')) break;
        this.hearingTarget = action.target;
        this.votes.clear();
        this.openVote('hearing',now+this.pausedDuration,now,HEARING_MS);
        this.refreshAgendaEligibility(now);
        break;
    }
  }

  private canUseCampaignActions(id:string, now:number) {
    return this.phase==='negotiation' && now<this.ends && this.canVote(id) &&
      this.election.open(now) && this.ballotCountdown(now)===undefined;
  }

  electionAction(player:Player, action:ElectionAction, now:number, hasVoice:boolean) {
    const {id} = player;
    if (!this.canUseCampaignActions(id,now)) return;
    const spend = (amount:number) => this.economy.spend(id,amount);
    switch (action.kind) {
      case 'advertise': {
        if (!this.at(player,'press')) return;
        const advertisement = this.election.advertise(id,spend,action.advertisement);
        if (!advertisement) return;
        this.economy.changePopularity(id,advertisement.offer.popularity);
        this.publishActivity(player,'advertisement-aired',now,{duration:this.election.timeUntilRenewal(now),amount:advertisement.offer.cost});
        return {...advertisement.broadcast,character:player.character};
      }
      case 'speech':
        if (this.at(player,'panel') && this.election.speech(id)) {
          this.publishActivity(player,'speech-given',now);
          this.economy.changePopularity(id,3);
        }
        break;
      case 'interview': if (hasVoice && this.at(player,'tv')) this.election.interview(id,now); break;
      case 'object':
        if (this.proposal && this.at(player,'panel') && !this.objection() && this.election.object(id)) this.objector = id;
        break;
    }
  }

  speaker(now:number) { return this.running ? this.election.speaker(now) : undefined; }
  stopBroadcast(id:string, now:number) {
    if (this.speaker(now)===id) this.election.stopBroadcast(now);
  }
  private objection() {
    return this.objector && this.canVote(this.objector) ? this.economy.name(this.objector) : undefined;
  }

  private impact(vote:Vote, misleading = false): Impact {
    if (!this.proposal) return {budget:0,stability:0};
    const bill = bills[this.proposal.project];
    const impact = bill[vote];
    if (vote==='yes' && bill.effect?.kind==='allowance') {
      return {...impact,budget:-bill.effect.perMandate*this.votingPlayers()};
    }
    if (vote==='yes' && bill.effect?.kind==='pinga-distribution') {
      return {...impact,budget:-this.pingaProgramCost()};
    }
    if (vote==='no') return {...impact,budget:Math.min(0,impact.budget)};
    return {
      ...impact,
      budget:Math.min(0,impact.budget+(misleading ? 24 : 0)),
    };
  }



  complaintView(id:string,photos?:readonly Photo[]) {
    const name = (actor:string)=>this.economy.name(actor);
    return {available:this.complaints.available(id,name,photos),history:this.complaints.history(),
      proofs:photos && this.complaints.proofs(id,photos,actor=>this.electorate.has(actor),name)};
  }

  canFileComplaint(player:Player,now:number) {
    return this.phase==='negotiation' && !player.knockedOut && !player.carried && !player.carrying &&
      this.canHandleObjects(player.id,now) && this.at(player,'audit');
  }

  submitComplaint(player:Player,id:number|string,now:number,photo?:Photo) {
    if (!this.canFileComplaint(player,now)) {
      return 'Vá ao balcão da Corregedoria durante a articulação.';
    }
    const name = (actor:string)=>this.economy.name(actor);
    const result = typeof id==='number' ? this.complaints.submit(player.id,id,name,photo) :
      photo && this.complaints.submitGame(player.id,photo,id,actor=>this.electorate.has(actor),name);
    if (!result) return 'Caso indisponível ou fotografia incompatível.';
    this.economy.rewardFromReserve(player.id,complaintRules.reward);
    this.economy.changePopularity(player.id,complaintRules.popularityGain);
    this.economy.earnXp(player.id,complaintRules.xp);
    this.economy.changePopularity(result.actor,-complaintRules.popularityLoss);
    this.election.scandal(result.actor);
    this.economy.recordOfficialScandal();
  }

  private energySavingsActive(now:number) { return (this.policies.get('energySavings') ?? 0)>now; }

  private powerCooldown(now:number) {
    return this.energySavingsActive(now) ? energySavings.sabotageCooldown : powerRules.cooldownMs;
  }

  private canFinishOutageRepair(now:number) {
    if (!this.powerOut) return false;
    if (this.voting) return now+powerRules.repairMs<this.sessionEndsAt;
    if (this.proposal && this.cassationAt===undefined && !this.projectVoteExpired(now)) {
      const {voteAt} = this.proposal;
      const cutoff = voteAt-projectRules.countdownSeconds*1000;
      return (now<cutoff && this.power.canFinishBefore(now,cutoff)) ||
        Math.max(now,voteAt)+powerRules.repairMs<this.sessionEndsAt;
    }
    return this.power.canFinishBefore(now,this.sessionEndsAt);
  }

  private canRepairOutage(id:string) {
    return this.canArticulateBeforeDeadline && this.canFinishOutageRepair(this.agendaNow) && !this.disconnected.has(id) && !this.isolated(id) &&
      [...this.electorate].some(other=>other!==id && !this.disconnected.has(other) && !this.isolated(other));
  }

  private canUsePower(now:number) {
    return this.phase==='negotiation' && this.ballotCountdown(now)===undefined;
  }

  private canSabotagePower(id:string,now:number) {
    return (this.electorate.size-this.disconnected.size>=2 || this.localSolo && this.initialPlayers===1) && this.infiltrators.has(id) &&
      this.canUsePower(now) && this.canHandleObjects(id,now) && this.power.canSabotage(now,this.powerCooldown(now));
  }

  private canOperatePower(player:Player,panel:PowerPanel,now:number) {
    return this.canUsePower(now) && this.canHandleObjects(player.id,now) &&
      !this.disconnected.has(player.id) && !player.carried && canOperatePanel(player,panel);
  }

  actOnPower(player:Player,action:PowerAction,now:number,failed?:(message:string)=>void) {
    if (!this.canOperatePower(player,action.panel,now)) {
      return failed?.('Aproxime-se do painel em condições de operá-lo.');
    }
    if (action.kind==='sabotage' && !this.canSabotagePower(player.id,now)) {
      return failed?.(this.power.active ? 'A energia já está cortada.' :
        this.power.canSabotage(now,this.powerCooldown(now)) ? 'O corte de energia está indisponível.' : 'O painel está em recarga.');
    }
    const couldRepair = this.canFinishOutageRepair(now);
    const result = this.power.act(player.id,action,now,this.powerCooldown(now));
    if (couldRepair!==this.canFinishOutageRepair(now)) this.refreshAgendaEligibility(now);
    if (!result) failed?.(this.power.active ? 'O painel não está disponível para esta ação.' : 'A energia já foi restaurada.');
    return result;
  }

  advancePower(now:number,playerAt:(id:string)=>Player|undefined) {
    const couldRepair = this.canFinishOutageRepair(now);
    const repairedBy = this.power.advance(now,(id,panel)=>{
      const player = playerAt(id);
      return !!player && this.canOperatePower(player,panel,now);
    });
    if (!repairedBy) {
      if (couldRepair && !this.canFinishOutageRepair(now)) this.refreshAgendaEligibility(now);
      return;
    }
    for (const panel of [0,1] as const) {
      const id = repairedBy[panel];
      const player = id && playerAt(id);
      if (!player) continue;
      this.economy.changePopularity(player.id,powerRules.popularityReward);
      this.publishActivity(player,'power-repaired',now,{
        amount:this.stability,place:roomAt(player)===powerPanels[panel].name ? 'inside-crisis-room' : undefined,
      });
    }
    this.refreshAgendaEligibility();
  }

  private canUseFire(player:Player,now:number) {
    return this.phase==='negotiation' && now<this.ends && this.ballotCountdown(now)===undefined &&
      (this.canHandleObjects(player.id,now) ||
        this.electorate.has(player.id) && this.isolated(player.id) && roomAt(player)===isolationRoom.name);
  }

  fireInteraction(player:Player,now:number,vision:number,hasDevice:boolean,hasExtinguisher:boolean):FireInteraction|undefined {
    if (this.phase!=='negotiation') return;
    const site = this.fire.smoke;
    const smoke = site!==undefined && localPerception(player,fireSites[site],vision).visible ? site : undefined;
    const allowed = this.canUseFire(player,now);
    const option = allowed ? this.fire.option(player,hasDevice,hasExtinguisher) : undefined;
    const progress = allowed ? this.fire.progress(player.id,now) : undefined;
    if (option || smoke!==undefined || progress!==undefined) return {option,smoke,progress};
  }

  fireHandlingDirection(player:Player) {
    const site = this.fire.handlingSite(player.id);
    if (site===undefined) return;
    const {x,y} = fireSites[site];
    const dx = x-player.x;
    const dy = y-player.y;
    return Math.abs(dx)>Math.abs(dy) ? (dx>0 ? 1 : 3) : (dy>0 ? 0 : 2);
  }

  updateFireInstallation(now:number,findPlayer:(id:string)=>Player|undefined,
    owns:(actor:string,item:number)=>boolean,consume:(actor:string,item:number)=>boolean) {
    const actor = this.fire.installer;
    if (actor===undefined) return;
    const player = findPlayer(actor);
    let failed = false;
    const feedback = this.fire.updateInstallation(player && this.canUseFire(player,now) ? player : undefined,now,owns,consume,message=>{
      failed = true;
      return message;
    });
    if (feedback) return {actor,feedback,failed};
  }

  actOnFire(player:Player, action:FireAction, site:number, now:number, hasExtinguisher=false, device?:number,failed?:(message:string)=>void) {
    if (!this.canUseFire(player,now)) return failed?.('Esta ação está indisponível neste momento.');
    if (!canActOnFire(player,site)) return failed?.('Aproxime-se do local.');
    if (action==='plant') {
      if (device===undefined) return failed?.('Você precisa de um dispositivo incendiário.');
      if (player.moving) return failed?.('Pare para instalar o dispositivo.');
      if (this.fire.plant(player,site,device,now)) return 'Instalando dispositivo…';
      return failed?.('Já existe um dispositivo em uso ou um incêndio ativo.');
    }
    if (action==='disarm') {
      if (this.fire.disarm(site)) return 'Dispositivo desarmado.';
      return failed?.('O dispositivo já não está armado neste local.');
    }
    if (!hasExtinguisher) return failed?.('Você precisa de um extintor.');
    if (!this.fire.extinguish(site)) return failed?.('Já não há incêndio neste local.');
    this.economy.changePopularity(player.id,fireRules.popularityReward);
    const insideRoom = roomAt(player)===fireSites[site].name;
    this.publishActivity(player,'fire-extinguished',now,
      {amount:this.stability,place:insideRoom ? 'inside-crisis-room' : undefined});
    this.refreshAgendaEligibility(now);
    return 'Incêndio apagado.';
  }

  private pingaRecipients() { return [...this.electorate].filter(id=>this.canVote(id) && !this.disconnected.has(id)); }

  private pingaProgramCost() { return this.pingaRecipients().length*pingaProgram.doseCost; }

  advance(realNow:number, distributePinga?:(recipients:readonly string[])=>void, ownsOfficeRoom?:(id:string,room:string)=>boolean) {
    if (!this.running) return;
    const gameNow = this.gameTime(realNow);
    if (this.pausedGameTime!==undefined) {
      if (realNow<this.voteEndsAt) return;
      this.pausedDuration = realNow-gameNow;
      this.pausedGameTime = undefined;
      this.resolveVote(gameNow,distributePinga);
      return;
    }
    const scheduledVoteAt = this.cassationAt ?? this.proposal?.voteAt;
    // A tick that arrives after the deadline must still open a ballot already due before it.
    const now = scheduledVoteAt!==undefined && scheduledVoteAt<this.sessionEndsAt && gameNow>=this.sessionEndsAt
      ? Math.max(scheduledVoteAt,this.agendaNow)
      : gameNow;
    const electionWasOpen = this.election.open(this.agendaNow);
    const canReturn = this.canArticulateBeforeDeadline;
    const couldRepair = this.canFinishOutageRepair(this.agendaNow);
    this.agendaNow = Math.max(this.agendaNow,now);
    const wasCritical = this.criticalStability;
    const wasBurning = this.fire.burning;
    const damage = this.fire.advance(now,this.phase==='negotiation',(actor,site)=>{
      const {x,y,name} = fireSites[site];
      this.recordGameplay({type:'fire-started',actor,position:{x,y},at:now,place:name,witnesses:[],
        ownOffice:ownsOfficeRoom?.(actor,name)});
    });
    if (damage) {
      this.stability = clamp(this.stability-damage);
      if (!this.stability) {
        this.finish(this.infiltrators.size ? 'Infiltrado' : undefined,'O incêndio derrubou a estabilidade.');
        return;
      }
    }
    const expiredSuspensions = this.economy.expireSuspensions(now);
    this.applyDebtPenalty(Math.min(now,this.sessionEndsAt));
    if (!this.running) return;
    const changedCriticalFire = wasBurning!==this.fire.burning && (wasCritical || this.criticalStability);
    const crossedCrisisThreshold = (this.fire.burning || this.powerOut) && wasCritical!==this.criticalStability;
    if (expiredSuspensions || changedCriticalFire || crossedCrisisThreshold || canReturn!==this.canArticulateBeforeDeadline ||
        couldRepair!==this.canFinishOutageRepair(this.agendaNow)) this.refreshAgendaEligibility();
    if (now>=this.sessionEndsAt) {
      this.finishAtDeadline();
      return;
    }
    if (this.phase==='negotiation' && now<this.ends && this.cassationAt===undefined) {
      this.renew(now);
      if (!this.running) return;
    }
    if (now<this.sessionEndsAt) this.distributeSalaries(now);
    if (this.remainingAgendaBallots(this.agendaNow)!==this.agendaBallotsLeft ||
        (electionWasOpen && !this.election.open(this.agendaNow))) this.refreshAgendaEligibility();
    if (this.cassationAt!==undefined && now>=this.cassationAt) {
      this.cassationAt = undefined;
      this.cassationOpen = true;
      this.openVote('hearing',realNow,now,HEARING_MS);
      this.refreshAgendaEligibility(now);
      return;
    }
    if (!this.proposal || now<this.proposal.voteAt || this.cassationAt!==undefined || this.projectVoteExpired(now)) return;
    this.openVote('ballot',realNow,now,BALLOT_MS);
    if (!this.hasFutureVoteNegotiation(now)) this.refreshAgendaEligibility(now);
  }

  private resolveVote(now:number,distributePinga?:(recipients:readonly string[])=>void) {
    if (this.cassationOpen) {
      this.resolveCassation(now);
      if (this.running && now>=this.sessionEndsAt) this.finishAtDeadline();
      return;
    }
    if (this.phase==='hearing') {
      const target = this.hearingTarget!;
      const {yes,quorum} = this.hearingTally();
      const removed = this.canVote(target) && yes>=quorum;
      if (removed) {
        this.voteIntents.delete(target);
        this.economy.suspend(target,now+SUSPENSION_MS);
        this.hearingImmunity.set(target,now+SUSPENSION_MS+HEARING_IMMUNITY_MS);
      }
      this.hearingResult = `${this.economy.name(target)}: afastamento ${removed ? 'aprovado' : 'rejeitado'} (${yes} votos pelo afastamento).`;
      this.hearingTarget = undefined;
      this.votes.clear();
      this.phase = 'negotiation';
      this.ends = this.sessionEndsAt;
      if (now>=this.sessionEndsAt) this.finishAtDeadline();
      else this.refreshAgendaEligibility(now);
      return;
    }
    if (!this.proposal) return;
    const {project,proposer} = this.proposal;
    const bill = bills[project];
    const votes = [...this.votes.values()];
    let yes = votes.filter(vote=>vote==='yes').length;
    let no = votes.filter(vote=>vote==='no').length;
    const abstentions = votes.filter(vote=>vote==='abstain').length;
    const absences = Math.max(0,this.votingPlayers()-votes.length);
    const preference = [...this.npcVotes.values()].reduce((score,vote)=>score+(vote==='yes' ? 1 : -1),0);
    if (this.votes.size===this.votingPlayers() && yes===no && yes>0) {
      if (preference>0) yes++;
      if (preference<0) no++;
    }
    const needed = this.billQuorum();
    const passed = yes>=needed;
    const impact = this.impact(passed ? 'yes' : 'no');
    const effect = passed ? bill.effect : undefined;
    const servesPinga = effect?.kind==='pinga-distribution' && impact.budget<0 && distributePinga;
    const cost = effect?.kind==='pinga-distribution' && !servesPinga ? 0 : Math.min(0,impact.budget);
    if (servesPinga) servesPinga(this.pingaRecipients());
    if (effect?.kind==='fire-safety') this.fire.increaseSafety();
    if (effect?.kind==='treasury-reputation') this.treasuryBonus = {until:now+effect.duration,amount:effect.bonus};
    if (effect?.kind==='policy') this.policies.set(effect.policy,now+(effect.duration ?? policyDuration));
    const payout = effect?.kind==='allowance' ? effect.perMandate : 0;
    this.economy.billResult(this.votes,passed,bill.yes.stability>0);
    const previous = {budget:this.budget,stability:this.stability};
    this.changeBudget(cost,now);
    if (payout) {
      for (const id of this.electorate) if (this.canVote(id)) this.economy.earn(id,payout);
      this.cash.salaries += previous.budget-this.budget;
    } else this.cash.projects += previous.budget-this.budget;
    this.stability = clamp(this.stability+impact.stability);
    this.outcomes.push({round:this.round,project,proposer,passed,yes,no,abstentions,absences,needed,deficit:Math.max(0,-this.budget),fraud:this.fraud,
      applied:{budget:this.budget-previous.budget,stability:this.stability-previous.stability}});
    this.economy.cancelOffers();
    if (!this.stability) this.finish(this.infiltrators.size ? 'Infiltrado' : undefined,'O Congresso entrou em colapso.');
    else {
      this.round++;
      this.protocolOpensAt = now+projectRules.cooldownMs;
      this.nextRound();
      this.refreshAgendaEligibility();
      if (now>=this.sessionEndsAt) this.finishAtDeadline();
    }
  }

  private votingPlayers() { return [...this.electorate].filter(id => this.canVote(id)).length; }
  private quorum() { return majorityQuorum(this.votingPlayers()); }

  private billQuorum() { return Math.min(this.votingPlayers(),this.quorum()+(this.objection() ? 1 : 0)); }

  private finishAtDeadline() {
    const won = this.stability>=stabilityRules.target;
    this.finish(won ? 'Parlamentar' : 'Infiltrado', won
      ? 'O Congresso manteve a estabilidade até o fim da sessão.'
      : 'O Congresso terminou abaixo da meta de estabilidade.');
  }

  private finish(winner:Role | undefined, reason:string) {
    this.pausedGameTime = undefined;
    this.phase = 'finished';
    this.policies.clear();
    this.treasuryBonus = undefined;
    this.cassationAt = undefined;
    this.cassationCall = undefined;
    this.cassationOpen = false;
    this.congressDestroyed = winner==='Infiltrado' || this.stability===0 || undefined;
    this.winner = winner==='Infiltrado' && !this.infiltrators.size ? undefined : winner;
    this.reason = reason;
  }

  private hearingTally() {
    let voted = 0;
    let yes = 0;
    for (const [id,vote] of this.votes) {
      if (vote==='abstain' || !this.canVote(id)) continue;
      voted++;
      if (vote==='yes') yes++;
    }
    return {voted,yes,quorum:this.quorum()};
  }

  private hearingVote(id:string) {
    const vote = this.canVote(id) ? this.votes.get(id) : undefined;
    return vote==='abstain' ? undefined : vote;
  }

  view(id:string, ids:string[], realNow:number, contacts:Contact[] = []): PlenaryView {
    const now = this.gameTime(realNow);
    const role = this.electorate.has(id) ? this.infiltrators.has(id) ? 'Infiltrado' : 'Parlamentar' : undefined;
    const candidates = this.cassationOpen ? this.finalRoster.flatMap(({id,name,character}) =>
      this.canVoteInCassation(id) ? [{id,name,character}] : []) : undefined;
    const caller = this.finalRoster.find(person=>person.id===this.cassationCall?.caller);
    const votes = candidates?.flatMap(({id:voter})=>{
      const candidate = this.cassationChoice(voter);
      return candidate===undefined ? [] : [{voter,candidate}];
    });
    const projectVoteExpired = this.phase==='negotiation' && this.projectVoteExpired(now);
    const hearing = this.hearingTarget ? this.hearingTally() : undefined;
    const phaseTimeLeft = this.voting ? this.voteEndsAt-realNow
      : (projectVoteExpired ? this.sessionEndsAt : this.proposal?.voteAt ?? this.sessionEndsAt)-now;
    return {
      policies:this.activePolicies(now),
      suppliesSeconds:Math.ceil(Math.max(0,(this.policies.get('supplies') ?? 0)-now)/1000) || undefined,
      cassationIn:this.cassationAt===undefined ? undefined : Math.max(0,Math.ceil((this.cassationAt-now)/1000)),
      cassation:candidates && votes && {candidates,votes,
        caller:caller && {id:caller.id,name:caller.name,character:caller.character},calledAt:this.cassationCall?.calledAt,
        eligible:this.canVoteInCassation(id),electorate:candidates.length,
        quorum:majorityQuorum(candidates.length),voted:votes.length,
        choice:this.cassationChoice(id)},
      cassationResult:this.cassationResult,
      ballotCountdown:this.ballotCountdown(now),
      projectWarning:this.projectWarning(now),
      projectVoteExpired:projectVoteExpired || undefined,
      phase:this.phase,round:this.round,project:this.proposal?.project,proposer:this.proposal?.proposer,
      projectFilingClosed:this.running && this.projectFilingClosed(now) || undefined,
      protocolCooldown:this.protocolOpensAt>now ? Math.ceil((this.protocolOpensAt-now)/1000) : undefined,
      remaining:this.running ? Math.max(0,Math.ceil(phaseTimeLeft/1000)) : 0,
      sessionRemaining:this.running ? Math.max(0,Math.ceil((this.sessionEndsAt-now)/1000)) : undefined,
      debtPenaltyIn:this.running && this.nextDebtPenaltyAt!==undefined ? Math.max(0,Math.ceil((this.nextDebtPenaltyAt-now)/1000)) : undefined,
      stability:this.stability,budget:this.budget,host:ids[0],role,mandate:role ? !!this.election.office(id) : undefined,solo:this.initialPlayers===1,players:ids.length,minimumPlayers:this.minimumPlayers,
      voteIntents:[...this.voteIntents].filter(([player])=>this.canVote(player)).map(([id,vote])=>({id,name:this.economy.name(id),vote})),
      billVoters:this.phase==='ballot' ? this.finalRoster.flatMap(({id,name,character}) =>
        this.canVote(id) ? [{id,name,character,vote:this.votes.get(id)}] : []) : undefined,
      electorate:this.votingPlayers(),vote:this.votes.get(id),voted:this.votes.size,
      canFraud:!!this.proposal && !projectVoteExpired && role==='Infiltrado' && !this.fraud && this.canVote(id),
      audit:this.audits.get(id),reportedFraud:this.reportedFraud,
      yes:this.impact('yes',this.fraud && !this.reportedFraud && !this.audits.has(id) && role!=='Infiltrado' && this.running),
      billQuorum:this.billQuorum(),
      payroll:role ? this.payrollView(id,now) : undefined,
      election:role ? this.election.view(id,now,this.popularity,this.canUseCampaignActions(id,now),this.objection(),this.advertisementMultiplier(now)) : undefined,
      politics:role ? this.economy.view(id,contacts,this.round,this.canCallHearing(id,now),id => this.canVote(id) && (this.hearingImmunity.get(id) ?? 0)<=now, recipient=>this.canSendPix(id,now) && this.canReceivePix(recipient),now) : undefined,
      outage:this.powerOut ? this.power.view(id,now,!this.canUsePower(now)) : undefined,
      canStartAsInfiltrator:this.localSolo && !this.running && id===ids[0] ? true : undefined,
      canSabotagePower:this.canSabotagePower(id,now) || undefined,
      fire:this.running ? this.fire.view(this.phase==='negotiation') : undefined,
      isolationSeconds:this.isolated(id) ? this.economy.suspensionRemaining(id,now) : undefined,
      auditNote:this.auditNotes.get(id),
      hearing:this.hearingTarget && hearing ? {target:this.economy.name(this.hearingTarget),voted:hearing.voted,quorum:hearing.quorum,vote:this.hearingVote(id)} : undefined,
      hearingResult:this.hearingResult,
      no:this.impact('no'),outcome:this.outcomes.at(-1),outcomes:this.outcomes.slice(),winner:this.winner,reason:this.reason,congressDestroyed:this.congressDestroyed,
      finalRoster:this.phase==='finished' ? this.finalRoster : undefined,
      infiltratorName:this.phase==='finished' ? this.infiltratorName : undefined,
    };
  }
}
