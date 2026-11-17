import { StationCooldowns } from './StationCooldowns';
import { stationRecharge } from '../src/station-recharge';
import type {SessionParticipant} from '../src/plenary';
import {Complaints} from './Complaints';
import {complaintRules} from '../src/complaints';
import type {Photo} from '../src/photography';
import {Fire} from './Fire';
import {canActOnFire,fireSites,type FireAction,type FireInteraction} from '../src/fire';
import {Power} from './Power';
import {canOperatePanel,powerPanels,powerRules,type PowerAction,type PowerPanel} from '../src/power';
import { npcRules } from '../src/parliamentarians';
import type { AttributeRequest } from '../src/progression';
import { canInteract } from '../src/interactions';
import { publishGameplay, type GameplayWorld } from './gameplay-world';
import type { GameplayEvent } from '../src/gameplay';
import { ELECTION_RULES as rules, type ElectionAction } from '../src/elections';
import { ElectionCycle } from './ElectionCycle';
import {
  BALLOT_MS, majorityQuorum, CASSATION_NOTICE_MS, bills, MIN_PLAYERS, projectRules, stations, canReachStation, stabilityRules, deficitStabilityLoss,
  campaignPolicyMultiplier, energySavings, pingaProgram, bankAuditCost, hearingPolicyFee, policyDuration, type BillPolicies, type BillPolicy, type Action, type BillVote, type Impact, type Outcome, type Phase, type PlenaryView, type Role, type Vote,
} from '../src/plenary';
import {isolationRoom,localPerception,roomAt,type Player} from '../src/map';
import { CRISIS_MISSION_STABILITY_LIMIT, CASSATION_POPULARITY, HEARING_MS, HEARING_IMMUNITY_MS, SUSPENSION_MS, TRADE_RADIUS, type Contact, type PoliticsAction } from '../src/politics';
import type { RoomActivity, RoomActivityResult } from '../src/room-activities';
import { PoliticalEconomy } from './PoliticalEconomy';

const clamp = (value:number) => Math.max(0,Math.min(stabilityRules.maximum,value));

export class PlenaryMatch {
  phase: Phase = 'lobby';
  private round = 0;
  private proposal?:{project:number; proposer:string; voteAt:number};
  private protocolOpensAt = 0;
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
    this.election.addDeputy(player.id);
  }

  private cash = {initial:0,npcIssued:0,spawned:0,expired:0,treasury:0,salaries:0,publicDuty:0,projects:0,diverted:0};

  economySummary(physical:number) {
    const totals = this.economy.totals();
    const issued = this.cash.initial+this.cash.npcIssued+this.cash.spawned;
    const spent = this.cash.expired+this.cash.publicDuty+this.cash.projects;
    const held = totals.humans+totals.npcs+totals.reserve+physical+this.budget;
    return {...totals,...this.cash,physical,budget:this.budget,issued,spent,
      discrepancy:Math.round((issued-spent-held)*10)/10 || 0};
  }

  canFightCrisis() { return this.stability<CRISIS_MISSION_STABILITY_LIMIT && (this.powerOut || !!this.fire.view(true)); }

  setAgendaMailAvailability(nextPublicationAt:(id:string)=>number,agendaSelfies?:Parameters<PoliticalEconomy['setAgendaMailAvailability']>[1]) {
    this.economy.setAgendaMailAvailability(id=>nextPublicationAt(id)<this.started+rules.matchDuration,agendaSelfies);
  }

  setAgendaCommerce(now:()=>number) {
    this.economy.setAgendaCommerce(()=>({policies:this.activePolicies(now()),publicBudget:this.budget}));
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

  refreshAgendaEligibility() {
    const ballotsLeft = bills.length-this.outcomes.length;
    this.economy.updateAgendaEligibility(this.electorate,ballotsLeft,id=>!!this.election.office(id),this.round,this.disconnected,id=>this.election.remainingAdvertisements(id));
  }

  former(id:string) { return this.electorate.has(id) && !this.election.office(id); }

  get projectRound() { return this.round; }

  recordNpcVote(id:string,vote:Vote) {
    if (this.phase==='ballot' && this.npcIds.has(id) && !this.npcVotes.has(id)) this.npcVotes.set(id,vote);
  }

  private settleBudget(ids:string[],now:number) {
    const planned = ids.length*rules.salary;
    const salaryShare = Math.floor(this.budget*rules.salaryShare*10)/10;
    const publicShare = this.budget-salaryShare;
    const publicDuty = rules.publicDuty-(this.energySavingsActive(now) ? energySavings.publicDutyDiscount : 0);
    const publicPaid = Math.min(publicDuty,publicShare+Math.max(0,salaryShare-planned));
    const salaryFunds = Math.min(planned,this.budget-publicPaid);
    // Equal salaries rounded down to a thousand reais. The remainder stays in the budget.
    const paid = ids.length ? Math.floor(Math.round(salaryFunds*10)/ids.length)/10 : 0;
    const payments = new Map<string,number>();
    for (const id of ids) {
      if (paid) this.economy.earn(id,paid);
      payments.set(id,paid);
    }
    this.budget = Math.max(0,Math.round((this.budget-publicPaid-paid*ids.length)*10)/10);
    this.cash.publicDuty += publicPaid;
    this.cash.salaries += paid*ids.length;
    this.treasuryReputation.clear();
    this.stability = clamp(this.stability-Math.ceil(rules.publicDutyPenalty*(1-publicPaid/publicDuty)));
    return payments;
  }

  private advertisementMultiplier(now:number) {
    return (this.policies.get('campaign') ?? 0)>now ? campaignPolicyMultiplier : 1;
  }

  private renew(now:number) {
    const previous = this.election.eliminated;
    const cycle = this.election.currentCycle;
    this.election.advance(now,this.popularity,ids=>this.settleBudget(ids,now),this.advertisementMultiplier(now));
    const eliminated = this.election.eliminated;
    if (eliminated && eliminated!==previous) {
      this.votes.delete(eliminated);
    }
    if (cycle!==this.election.currentCycle) this.refreshAgendaEligibility();
    if (!this.stability) this.finish('Infiltrado','O Congresso entrou em colapso.');
    else if (this.infiltrators.size && [...this.infiltrators].every(id=>!this.election.office(id))) {
      this.finish('Parlamentar','Todos os infiltrados perderam o mandato.');
    }
  }

  constructor(private readonly minimumPlayers = MIN_PLAYERS, private readonly stationCooldowns = new StationCooldowns()) {}

  private ends = 0;
  private stability:number = stabilityRules.initial;
  private budget:number = rules.startingBudget;
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
  private hearingTarget?: string;
  private cassationAt?:number;
  private cassationOpen = false;
  private readonly cassationVotes = new Map<string,string|null>();
  private readonly expelled = new Set<string>();
  private cassationResult?:{text:string};
  private readonly hearingImmunity = new Map<string,number>();
  private hearingResult?: string;
  private auditNotes = new Map<string,string>();
  private infiltratorName?: string;
  private amended = false;
  private fraud = false;
  private reportedFraud = false;
  private audits = new Map<string,'clean' | 'fraud'>();
  private outcomes: Outcome[] = [];
  private winner?: Role;
  private finalRoster:SessionParticipant[] = [];
  private reason?: string;

  get allowsPlenaryCombat() { return this.phase==='ballot' || this.cassationOpen; }

  get running() { return this.phase==='negotiation' || this.phase==='ballot' || this.phase==='hearing'; }

  start(requester:string, players:Player[], now:number, random = Math.random, requested=1) {
    players = players.filter(player=>!player.npc);
    const ids = players.map(({id}) => id);
    if (this.running || ids.length<this.minimumPlayers || ids[0]!==requester) return false;
    this.electorate = new Set(ids);
    this.disconnected.clear();
    this.treasuryReputation.clear();
    this.npcIds.clear();
    this.npcVotes.clear();
    this.initialPlayers = ids.length;
    const candidates = [...players];
    const count = ids.length===1 ? 0 : ids.length>=6 && requested===2 ? 2 : 1;
    this.infiltrators.clear();
    for (let i=0;i<count;i++) this.infiltrators.add(candidates.splice(Math.floor(random()*candidates.length),1)[0].id);
    const contacts = players.map(player => ({id:player.id,name:player.nick,character:player.character}));
    this.finalRoster = contacts.map(contact=>({...contact,role:this.infiltrators.has(contact.id) ? 'Infiltrado' : 'Parlamentar'}));
    this.started = now;
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
    let campaignReady = false;
    this.economy.reset(contacts,random,(id,kind)=>!campaignReady || (kind==='emenda' ? !this.amended : this.election.canCampaignAction(id,kind)));
    const {humans,reserve} = this.economy.totals();
    this.cash = {initial:humans+reserve+rules.startingBudget,npcIssued:0,spawned:0,expired:0,treasury:0,salaries:0,publicDuty:0,projects:0,diverted:0};
    this.election.reset(players.map(({id,nick,character}) => ({id,name:nick,character})),now,random);
    campaignReady = true;
    this.infiltratorName = [...this.infiltrators].map(id => this.economy.name(id)).join(', ') || undefined;
    this.hearingImmunity.clear();
    this.hearingTarget = this.hearingResult = undefined;
    this.cassationAt = this.cassationResult = undefined;
    this.cassationOpen = false;
    this.cassationVotes.clear();
    this.expelled.clear();
    this.stability = stabilityRules.initial;
    this.budget = rules.startingBudget;
    this.round = 0;
    this.protocolOpensAt = now;
    this.outcomes = [];
    this.winner = this.reason = undefined;
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
    this.amended = false;
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
    details?:Pick<GameplayEvent,'target'|'amount'|'duration'|'place'>) {
    publishGameplay({players:[],now,nextEventId:()=>++this.eventSequence,publish:event=>this.recordGameplay(event)},
      player,type,{...details,witnesses:[]});
  }

  private recordGameplay(event:GameplayEvent):boolean {
    if (event.at<this.started) return false;

    const project = event.type==='filed' ? event.project : undefined;
    if (project!==undefined && this.projectFilingError(event.actor,project,event.at)) return false;
    if (event.eventId!==undefined) {
      if (event.eventId<=this.eventSequenceAtStart || this.receivedEvents.has(event.eventId)) return false;
      this.receivedEvents.add(event.eventId);
    }
    if (event.type==='filed' && event.item!==undefined) {
      if (this.filedDocuments.has(event.item)) return false;
      this.filedDocuments.add(event.item);
    }
    if (project!==undefined) {
      this.proposal = {project,proposer:this.economy.name(event.actor),voteAt:event.at+projectRules.debateMs};
      this.refreshAgendaEligibility();
    }
    this.complaints.record(event,this.started);
    this.economy.recordGameplay(event);
    const droppedSpy = event.type==='dropped' && (event.kind==='wiretap' || event.kind==='spyCamera');
    if (droppedSpy || event.type==='photo-published' || event.type==='spy-removed' || event.type==='spy-installed' || event.type==='advertisement-aired' ||
        (event.kind==='vip' || event.kind==='portrait') && (event.type==='installed' || event.type==='uninstalled' || event.type==='marked')) this.refreshAgendaEligibility();
    return true;
  }

  private projectFilingError(id:string,project:number,now:number) {
    if (!bills[project] || !this.canVote(id)) return 'Somente jogadores com mandato podem protocolar projetos.';
    if (this.outcomes.some(outcome=>outcome.project===project)) return 'Esse projeto já foi votado nesta partida.';
    if (this.proposal) return 'Já há um projeto em pauta.';
    if (this.phase!=='negotiation' || this.cassationAt!==undefined) return 'O Protocolo aguarda a liberação do Plenário.';
    if (now<this.protocolOpensAt) return `Protocolo disponível em ${Math.ceil((this.protocolOpensAt-now)/1000)} s.`;
    if (now+projectRules.debateMs+BALLOT_MS>this.sessionEndsAt) return 'Não há tempo para votar outro projeto nesta partida.';
  }

  act(player:Player, action:Action, now:number) {
    if (!this.canVote(player.id) || (!this.proposal && action!=='audit')) return;
    if (this.phase!=='negotiation' || now>=this.ends) {
      if (action==='audit') return {text:'A auditoria só pode ser feita durante a articulação.',critical:false};
      return;
    }
    if (!this.at(player,action==='fraud' ? 'panel' : action)) {
      if (action==='audit') return {text:'Chegue mais perto do ponto da Corregedoria.',critical:false};
      return;
    }
    if (action==='amendment' && !this.amended) {
      this.amended = true;
      this.publishActivity(player,'amendment-filed',now);
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

  roomActivity(player:Player, activity:RoomActivity, now:number):RoomActivityResult | undefined {
    const {id} = player;
    if (this.phase!=='negotiation' || now>=this.ends || !this.electorate.has(id) || this.isolated(id) || !this.at(player,activity)) return;
    switch (activity) {
      case 'coffee':
        if (!this.stationCooldowns.take('coffee',now)) return {activity,text:stationRecharge.coffee.feedback,unavailable:true};
        this.publishActivity(player,'coffee-drunk',now);
        return {activity,text:'Cafezinho tomado. De volta à articulação!'};
      case 'library':
        if (!this.proposal) return {activity,text:'Nenhum projeto em pauta.'};
        this.publishActivity(player,'bill-studied',now);
        return {activity,text:`Você estudou o projeto ${bills[this.proposal.project].name}.`};
    }
  }

  gameplayWorld(players:Player[], now:number, voice:(id:string)=>boolean):Omit<GameplayWorld,'publish'> & {publish:(event:GameplayEvent)=>boolean} {
    const generation = this.matchGeneration;
    return {
      players:players.filter(player => this.electorate.has(player.id) || this.npcIds.has(player.id)),now,
      policies:this.activePolicies(now),publicBudget:this.budget,
      spendSubsidized:(id,price,subsidy)=>{
        if (Math.round(subsidy*10)>Math.round(this.budget*10) || !this.economy.spend(id,price)) return false;
        this.budget = Math.round((this.budget-subsidy)*10)/10;
        this.cash.projects += subsidy;
        return true;
      },
      plenary:this.phase!=='negotiation',started:this.started,wallet:id=>this.economy.wallet(id),spend:(id,amount)=>this.economy.spend(id,amount),
      earnXp:(id,amount)=>this.economy.earnXp(id,amount),
      settleBet:(id,stake,payout,maxPayout)=>this.economy.settleBet(id,stake,payout,maxPayout),
      office:id=>this.npcIds.has(id) ? 'deputy' : this.election.office(id),
      projectFilingError:(id,project)=>this.projectFilingError(id,project,now),
      projectSignatures:Math.max(0,Math.min(2,this.initialPlayers-1)),
      hasMandate:id=>this.npcIds.has(id) || !!this.election.office(id),
      cashFlow:(kind,amount)=>{ this.cash[kind] += amount; },
      deposit:(id,amount)=>{
        if (!this.running || !this.electorate.has(id) || amount<=0) return false;
        this.cash.treasury += amount;
        this.budget = Math.round((this.budget+amount)*10)/10;
        const credited = this.treasuryReputation.get(id) ?? 0;
        const gain = Math.max(0,Math.min(rules.treasuryReputationCap-credited,Math.floor(amount)));
        this.treasuryReputation.set(id,credited+gain);
        const bonus = this.treasuryBonus && now<this.treasuryBonus.until ? this.treasuryBonus.amount : 0;
        this.economy.changePopularity(id,gain+Math.min(gain,bonus));
        return true;
      },
      lootWallet:(id,fraction)=>this.electorate.has(id) ? this.economy.takeWallet(id,fraction) : 0,
      takeWallet:id=>this.npcIds.has(id) ? this.economy.takeWallet(id) : 0,
      payNpc:(from,to,amount)=>this.npcIds.has(to) && this.economy.transfer(from,to,amount,true,this.round),
      hasEvidence:(id,kind)=>this.economy.hasEvidence(id,kind),
      hasMission:(id,mission)=>this.economy.hasMission(id,mission),voice,earn:(id,amount)=>this.economy.earn(id,amount),
      nextEventId:()=>++this.eventSequence,
      publish:event=>generation===this.matchGeneration && this.recordGameplay(event),
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

  ballotCountdown(now:number) {
    const at = this.proposal?.voteAt;
    if (this.phase!=='negotiation' || at===undefined || at-now>5000 ||
      now+BALLOT_MS>this.sessionEndsAt || this.cassationAt!==undefined) return;
    return Math.max(1,Math.ceil((at-now)/1000));
  }

  declareVote(id:string,vote:Vote|null,now:number) {
    if (this.phase!=='negotiation' || !this.proposal || now>=this.ends || !this.canVote(id)) return;
    if (vote===null) this.voteIntents.delete(id);
    else this.voteIntents.set(id,vote);
  }

  vote(id:string, vote:BillVote, now:number) {
    if (this.cassationOpen || (this.phase!=='ballot' && this.phase!=='hearing') || now>=this.ends || !this.canVote(id)) return;
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

  private canCallCassation(id:string, now:number) {
    return this.phase==='negotiation' && now<this.ends && this.cassationAt===undefined &&
      this.canVoteInCassation(id) && this.popularity(id)>=CASSATION_POPULARITY && this.cassationElectorate().length>=3;
  }

  private cassationElectorate() {
    return [...this.electorate].filter(id=>this.canVoteInCassation(id));
  }

  castCassation(id:string, candidate:string|null, now:number) {
    if (!this.cassationOpen || now>=this.ends || !this.canVoteInCassation(id) ||
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
    this.cassationOpen = false;
    this.cassationVotes.clear();
    this.phase = 'negotiation';
    this.ends = this.sessionEndsAt;
    if (!result) {
      this.cassationResult = {text:'Ninguém foi cassado. Nenhum suspeito recebeu a maioria dos votos.'};
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

  contacts(player:Player, players:Player[]): Contact[] {
    return this.phase==='negotiation' || this.phase==='ballot' ? players.filter(other => this.nearby(player,other))
      .map(({id}) => ({id,name:this.economy.name(id)})) : [];
  }

  politics(player:Player, action:PoliticsAction, players:Player[], now:number) {
    const {id} = player;
    const privateDeal = action.kind==='transfer' || action.kind==='share' || action.kind==='accept' || action.kind==='cancel';
    if ((this.phase!=='negotiation' && !(this.phase==='ballot' && privateDeal)) ||
      now>=this.ends || !this.electorate.has(id) || this.isolated(id)) return;
    const near = (target:string) => players.some(other => other.id===target && this.nearby(player,other));
    switch (action.kind) {
      case 'grant': {
        if (!this.at(player,'cabinet') || !this.canVote(id)) break;
        const result = this.economy.grant(id,action.diverted,this.budget,this.round);
        if (!result) break;
        this.budget -= result.budget;
        this.cash.diverted += action.diverted;
        this.cash.projects += result.budget-action.diverted;
        this.stability = clamp(this.stability+result.stability);
        if (!this.stability) this.finish(this.infiltrators.size ? 'Infiltrado' : undefined,'O Congresso entrou em colapso.');
        break;
      }
      case 'transfer':
        if (!this.canReceivePix(action.to) || !this.economy.transfer(id,action.to,action.amount,action.clandestine ?? true,this.round)) return false;
        this.publishActivity(player,'pix-sent',now,{target:action.to,amount:action.amount});
        const receiver = players.find(other=>other.id===action.to);
        if (receiver) this.publishActivity(receiver,'pix-received',now,{target:id,amount:action.amount});
        return true;
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
      case 'call-cassation':
        if (!this.canCallCassation(id,now) || !this.at(player,'panel')) break;
        if (this.activePolicies(now).hearing && !this.economy.spend(id,hearingPolicyFee)) break;
        this.cassationAt = now+CASSATION_NOTICE_MS;
        break;
      case 'hearing':
        if (this.cassationAt!==undefined || !this.canVote(id) || !this.economy.canCall(id) || !this.canVote(action.target) ||
            (this.hearingImmunity.get(action.target) ?? 0)>now || id===action.target || !this.at(player,'panel')) break;
        if (this.activePolicies(now).hearing && !this.economy.spend(id,hearingPolicyFee)) break;
        this.hearingTarget = action.target;
        this.ends = now+HEARING_MS;
        this.votes.clear();
        this.economy.cancelOffers();
        this.economy.interruptPlenaryVisits();
        this.phase = 'hearing';
        break;
    }
  }

  electionAction(player:Player, action:ElectionAction, now:number, hasVoice:boolean) {
    const {id} = player;
    if (this.phase!=='negotiation' || now>=this.ends || !this.canVote(id) || !this.election.open(now)) return;
    const spend = (amount:number) => this.economy.spend(id,amount);
    switch (action.kind) {
      case 'advertise': {
        if (!this.at(player,'press')) return;
        const advertisement = this.election.advertise(id,spend);
        if (!advertisement) return;
        this.publishActivity(player,'advertisement-aired',now,{duration:this.election.timeUntilRenewal(now),amount:rules.advertisementCost});
        return {...advertisement,character:player.character};
      }
      case 'speech':
        if (this.at(player,'panel') && this.election.speech(id)) {
          this.publishActivity(player,'speech-given',now);
          this.economy.changePopularity(id,3);
        }
        break;
      case 'interview': if (hasVoice && this.at(player,'tv')) this.election.interview(id,now); break;
      case 'support':
        if (this.election.currentCycle<=rules.cycles) this.election.support(id,action.to);
        break;
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
      return {...impact,budget:-this.allowancePerMandate(bill.effect.perMandate)*this.votingPlayers()};
    }
    if (vote==='yes' && bill.effect?.kind==='pinga-distribution') {
      const cost = this.pingaProgramCost();
      return {...impact,budget:cost<=this.budget ? -cost : 0};
    }
    if (vote==='no') return {...impact,budget:Math.min(0,impact.budget)};
    return {
      stability:impact.stability-(this.amended ? 8 : 0),
      budget:Math.min(0,impact.budget+(this.amended ? 16 : 0)+(misleading ? 24 : 0)),
    };
  }

  private allowancePerMandate(requested:number) {
    const electorate = this.votingPlayers();
    return electorate ? Math.min(requested,Math.floor(Math.round(this.budget*10)/electorate)/10) : 0;
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

  private canUsePower(now:number) {
    return this.phase==='negotiation' && this.ballotCountdown(now)===undefined;
  }

  private canSabotagePower(id:string,now:number) {
    return this.electorate.size-this.disconnected.size>=2 && this.infiltrators.has(id) &&
      this.canUsePower(now) && this.canHandleObjects(id,now) && this.power.canSabotage(now,this.powerCooldown(now));
  }

  private canOperatePower(player:Player,panel:PowerPanel,now:number) {
    return this.canUsePower(now) && this.canHandleObjects(player.id,now) &&
      !this.disconnected.has(player.id) && !player.carried && canOperatePanel(player,panel);
  }

  actOnPower(player:Player,action:PowerAction,now:number) {
    if (!this.canOperatePower(player,action.panel,now)) return;
    if (action.kind==='sabotage' && !this.canSabotagePower(player.id,now)) return;
    return this.power.act(player.id,action,now,this.powerCooldown(now));
  }

  advancePower(now:number,playerAt:(id:string)=>Player|undefined) {
    const repairedBy = this.power.advance(now,(id,panel)=>{
      const player = playerAt(id);
      return !!player && this.canOperatePower(player,panel,now);
    });
    if (!repairedBy) return;
    for (const panel of [0,1] as const) {
      const id = repairedBy[panel];
      const player = id && playerAt(id);
      if (player) this.publishActivity(player,'power-repaired',now,{
        amount:this.stability,place:roomAt(player)===powerPanels[panel].name ? 'inside-crisis-room' : undefined,
      });
    }
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
    const feedback = this.fire.updateInstallation(player && this.canUseFire(player,now) ? player : undefined,now,owns,consume);
    if (feedback) return {actor,feedback};
  }

  actOnFire(player:Player, action:FireAction, site:number, now:number, hasExtinguisher=false, device?:number) {
    if (!this.canUseFire(player,now) || !canActOnFire(player,site)) return;
    if (action==='plant') {
      if (device!==undefined && this.fire.plant(player,site,device,now)) return 'Instalando dispositivo…';
      return;
    }
    if (action==='disarm') {
      if (this.fire.disarm(site)) return 'Dispositivo desarmado.';
      return;
    }
    if (!hasExtinguisher || !this.fire.extinguish(site)) return;
    const insideRoom = roomAt(player)===fireSites[site].name;
    this.publishActivity(player,'fire-extinguished',now,
      {amount:this.stability,place:insideRoom ? 'inside-crisis-room' : undefined});
    return 'Incêndio apagado.';
  }

  private pingaRecipients() { return [...this.electorate].filter(id=>this.canVote(id) && !this.disconnected.has(id)); }

  private pingaProgramCost() { return this.pingaRecipients().length*pingaProgram.doseCost; }

  advance(now:number, distributePinga?:(recipients:readonly string[])=>void) {
    if (!this.running) return;
    const damage = this.fire.advance(now,this.phase==='negotiation');
    if (damage) {
      this.stability = clamp(this.stability-damage);
      if (!this.stability) {
        this.finish(this.infiltrators.size ? 'Infiltrado' : undefined,'O incêndio derrubou a estabilidade.');
        return;
      }
    }
    if (this.economy.expireSuspensions(now)) this.refreshAgendaEligibility();
    if (now>=this.sessionEndsAt && !(this.phase==='ballot' && this.ends<=this.sessionEndsAt)) {
      this.finishAtDeadline();
      return;
    }
    if (this.phase==='negotiation' && now<this.ends && this.cassationAt===undefined) {
      this.renew(now);
      if (!this.running) return;
    }
    if (this.cassationAt!==undefined && now>=this.cassationAt) {
      this.cassationAt = undefined;
      this.cassationOpen = true;
      this.ends = now+HEARING_MS;
      this.economy.cancelOffers();
      this.economy.interruptPlenaryVisits();
      this.phase = 'hearing';
      return;
    }
    if (this.phase==='negotiation') {
      if (!this.proposal || now<this.proposal.voteAt || this.cassationAt!==undefined || now+BALLOT_MS>this.sessionEndsAt) return;
      this.economy.cancelOffers();
      this.economy.interruptPlenaryVisits();
      this.phase = 'ballot';
      this.ends = now+BALLOT_MS;
      return;
    }
    if (now<this.ends) return;
    if (this.cassationOpen) {
      this.resolveCassation(now);
      return;
    }
    if (this.phase==='hearing') {
      const target = this.hearingTarget!;
      const yes = [...this.votes.values()].filter(vote => vote==='yes').length;
      const removed = this.canVote(target) && yes>=this.quorum();
      if (removed) {
        this.voteIntents.delete(target);
        this.economy.suspend(target,now+SUSPENSION_MS);
        this.hearingImmunity.set(target,now+SUSPENSION_MS+HEARING_IMMUNITY_MS);
        this.refreshAgendaEligibility();
        if (!this.infiltrators.has(target)) this.stability = clamp(this.stability-12);
      }
      this.hearingResult = `${this.economy.name(target)}: afastamento ${removed ? 'aprovado' : 'rejeitado'} (${yes} votos pelo afastamento).`;
      this.hearingTarget = undefined;
      this.votes.clear();
      if (!this.stability) this.finish(this.infiltrators.size ? 'Infiltrado' : undefined,'O Congresso entrou em colapso.');
      else {
        this.phase = 'negotiation';
        this.ends = this.sessionEndsAt;
      }
      return;
    }
    if (!this.proposal) return;
    const {project,proposer} = this.proposal;
    const bill = bills[project];
    let yes = [...this.votes.values()].filter(vote => vote==='yes').length;
    let no = [...this.votes.values()].filter(vote => vote==='no').length;
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
    const balance = this.budget+(effect?.kind==='pinga-distribution' && !servesPinga ? 0 : Math.min(0,impact.budget));
    if (servesPinga) servesPinga(this.pingaRecipients());
    if (effect?.kind==='fire-safety' && balance>=0) this.fire.increaseSafety();
    if (effect?.kind==='treasury-reputation') this.treasuryBonus = {until:now+effect.duration,amount:effect.bonus};
    if (effect?.kind==='policy' && balance>=0) this.policies.set(effect.policy,now+(effect.duration ?? policyDuration));
    const payout = effect?.kind==='allowance' ? this.allowancePerMandate(effect.perMandate) : 0;
    this.economy.billResult(this.votes,passed,bill.yes.stability>0);
    const previous = {budget:this.budget,stability:this.stability};
    this.budget = Math.max(0,Math.round(balance*10)/10);
    if (payout) {
      for (const id of this.electorate) if (this.canVote(id)) this.economy.earn(id,payout);
      this.cash.salaries += previous.budget-this.budget;
    } else this.cash.projects += previous.budget-this.budget;
    const funding = impact.budget<0 ? Math.min(1,previous.budget/-impact.budget) : 1;
    const benefit = impact.stability>0 ? Math.floor(impact.stability*funding) : impact.stability;
    this.stability = clamp(this.stability+benefit-deficitStabilityLoss(-balance));
    this.outcomes.push({round:this.round,project,proposer,passed,yes,no,needed,deficit:Math.max(0,-balance),fraud:this.fraud,
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
    const enoughVotes = this.outcomes.length>=projectRules.requiredVotes;
    const won = enoughVotes && this.stability>=stabilityRules.target;
    this.finish(won ? 'Parlamentar' : 'Infiltrado', !enoughVotes
      ? `A sessão terminou com ${this.outcomes.length} de ${projectRules.requiredVotes} projetos votados.`
      : won ? 'O Congresso cumpriu a meta de votações.' : 'O Congresso terminou abaixo da meta de estabilidade.');
  }

  private finish(winner:Role | undefined, reason:string) {
    this.phase = 'finished';
    this.policies.clear();
    this.treasuryBonus = undefined;
    this.cassationAt = undefined;
    this.cassationOpen = false;
    this.winner = winner;
    this.reason = reason;
  }

  private hearingVote(id:string) {
    const vote = this.votes.get(id);
    return vote==='abstain' ? undefined : vote;
  }

  view(id:string, ids:string[], now:number, contacts:Contact[] = []): PlenaryView {
    const role = this.electorate.has(id) ? this.infiltrators.has(id) ? 'Infiltrado' : 'Parlamentar' : undefined;
    const candidates = this.cassationOpen ? this.finalRoster.flatMap(({id,name,character}) =>
      this.canVoteInCassation(id) ? [{id,name,character}] : []) : undefined;
    return {
      policies:this.activePolicies(now),
      canCallCassation:this.canCallCassation(id,now),
      cassationIn:this.cassationAt===undefined ? undefined : Math.max(0,Math.ceil((this.cassationAt-now)/1000)),
      cassation:candidates && {candidates,eligible:this.canVoteInCassation(id),electorate:candidates.length,
        quorum:majorityQuorum(candidates.length),voted:candidates.filter(candidate=>this.cassationChoice(candidate.id)!==undefined).length,
        choice:this.cassationChoice(id)},
      cassationResult:this.cassationResult,
      ballotCountdown:this.ballotCountdown(now),
      phase:this.phase,round:this.round,project:this.proposal?.project,proposer:this.proposal?.proposer,
      protocolCooldown:this.protocolOpensAt>now ? Math.ceil((this.protocolOpensAt-now)/1000) : undefined,
      remaining:this.running ? Math.max(0,Math.ceil(((this.phase==='negotiation' ? this.proposal?.voteAt ?? this.sessionEndsAt : this.ends)-now)/1000)) : 0,
      stability:this.stability,budget:this.budget,host:ids[0],role,mandate:role ? !!this.election.office(id) : undefined,solo:this.initialPlayers===1,players:ids.length,minimumPlayers:this.minimumPlayers,
      voteIntents:[...this.voteIntents].filter(([player])=>this.canVote(player)).map(([id,vote])=>({id,name:this.economy.name(id),vote})),
      billVoters:this.phase==='ballot' ? this.finalRoster.flatMap(({id,name,character}) =>
        this.canVote(id) ? [{id,name,character,vote:this.votes.get(id)}] : []) : undefined,
      electorate:this.votingPlayers(),vote:this.votes.get(id),voted:this.votes.size,
      amended:this.amended,canFraud:!!this.proposal && role==='Infiltrado' && !this.fraud && this.canVote(id),
      audit:this.audits.get(id),reportedFraud:this.reportedFraud,
      yes:this.impact('yes',this.fraud && !this.reportedFraud && !this.audits.has(id) && role!=='Infiltrado' && this.running),
      billQuorum:this.billQuorum(),
      election:role ? this.election.view(id,now,this.popularity,this.phase==='negotiation',this.objection(),this.advertisementMultiplier(now)) : undefined,
      politics:role ? this.economy.view(id,contacts,this.round,this.canVote(id) && this.votingPlayers()>1 && this.cassationAt===undefined,id => this.canVote(id) && (this.hearingImmunity.get(id) ?? 0)<=now, id=>this.canReceivePix(id)) : undefined,
      outage:this.powerOut ? this.power.view(id,now,!this.canUsePower(now)) : undefined,
      canSabotagePower:this.canSabotagePower(id,now) || undefined,
      fire:this.running ? this.fire.view(this.phase==='negotiation') : undefined,
      isolationSeconds:this.isolated(id) ? this.economy.suspensionRemaining(id,now) : undefined,
      auditNote:this.auditNotes.get(id),
      hearing:this.hearingTarget ? {target:this.economy.name(this.hearingTarget),voted:this.votes.size,quorum:this.quorum(),vote:this.hearingVote(id)} : undefined,
      hearingResult:this.hearingResult,
      no:this.impact('no'),outcome:this.outcomes.at(-1),outcomes:this.outcomes.slice(),winner:this.winner,reason:this.reason,
      finalRoster:this.phase==='finished' ? this.finalRoster : undefined,
      infiltratorName:this.phase==='finished' ? this.infiltratorName : undefined,
    };
  }
}
