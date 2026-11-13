import {Complaints} from './Complaints';
import {complaintRules} from '../src/complaints';
import type {Photo} from '../src/photography';
import {Fire} from './Fire';
import {canActOnFire,type FireAction} from '../src/fire';
import { npcRules } from '../src/parliamentarians';
import type { AttributeRequest } from '../src/progression';
import { canInteract } from '../src/interactions';
import type { GameplayWorld } from './gameplay-world';
import { ELECTION_RULES as rules, type ElectionAction } from '../src/elections';
import { ElectionCycle } from './ElectionCycle';
import {
  BALLOT_MS, bills, MIN_PLAYERS, NEGOTIATION_MS, stations, STATION_RADIUS,
  type Action, type Impact, type Outcome, type Phase, type PlenaryView, type Role, type Vote,
} from '../src/plenary';
import type { Player } from '../src/map';
import { HEARING_MS, HEARING_IMMUNITY_MS, SUSPENSION_MS, money, TRADE_RADIUS, type Contact, type PoliticsAction } from '../src/politics';
import type { RoomActivity, RoomActivityResult } from '../src/room-activities';
import { PoliticalEconomy } from './PoliticalEconomy';

const clamp = (value:number) => Math.max(0,Math.min(100,value));

export class PlenaryMatch {
  phase: Phase = 'lobby';
  private round = 0;
  private project?:number;
  private readonly complaints = new Complaints();
  private readonly fire = new Fire();
  private readonly agenda = new Set<number>();
  private get projectIndex() { return this.project ?? this.agenda.values().next().value ?? this.round%bills.length; }
  private started = 0;
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

  logEconomy(physical:number,roomId:string) {
    console.info(JSON.stringify({event:'economy-totals',roomId,...this.economySummary(physical)}));
  }

  setAgendaInventory(...inventory:Parameters<PoliticalEconomy['setAgendaInventory']>) {
    this.economy.setAgendaInventory(...inventory);
  }

  refreshAgendaEligibility() {
    const scheduled = this.agenda.size+Number(this.phase==='ballot');
    const ballotsLeft = Math.max(scheduled,bills.length-this.round%bills.length);
    this.economy.updateAgendaEligibility(this.electorate,ballotsLeft,id=>!!this.election.office(id));
  }

  former(id:string) { return this.electorate.has(id) && !this.election.office(id); }

  get projectRound() { return this.round; }
  get projectName() { return bills[this.projectIndex].name; }

  recordNpcVote(id:string,vote:Vote) {
    if (this.phase==='ballot' && this.npcIds.has(id) && !this.npcVotes.has(id)) this.npcVotes.set(id,vote);
  }

  private settleBudget(ids:string[]) {
    const planned = ids.length*rules.salary;
    const salaryShare = Math.floor(this.budget*rules.salaryShare*10)/10;
    const publicShare = this.budget-salaryShare;
    const publicPaid = Math.min(rules.publicDuty,publicShare+Math.max(0,salaryShare-planned));
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
    this.stability = clamp(this.stability-Math.ceil(rules.publicDutyPenalty*(1-publicPaid/rules.publicDuty)));
    return payments;
  }

  private renew(now:number) {
    const previous = this.election.eliminated;
    this.election.advance(now,this.popularity,ids=>this.settleBudget(ids));
    const eliminated = this.election.eliminated;
    if (eliminated && eliminated!==previous) {
      this.votes.delete(eliminated);
      this.refreshAgendaEligibility();
    }
    if (!this.stability) this.finish('Infiltrado','O Congresso entrou em colapso.');
    else if (this.infiltrators.size && [...this.infiltrators].every(id=>!this.election.office(id))) {
      this.finish('Parlamentar','Todos os infiltrados perderam o mandato.');
    }
  }

  constructor(private readonly minimumPlayers = MIN_PLAYERS) {}

  private ends = 0;
  private stability = 48;
  private budget:number = rules.startingBudget;
  private initialPlayers = 0;
  private electorate = new Set<string>();
  private votes = new Map<string,Vote>();
  private voteIntents = new Map<string,Vote>();
  private infiltrators = new Set<string>();
  private economy = new PoliticalEconomy();
  private election = new ElectionCycle();
  private objector?:string;
  private popularity = (id:string) => this.economy.popularity(id);
  private hearingTarget?: string;
  private readonly hearingImmunity = new Map<string,number>();
  private hearingResult?: string;
  private interruptedTime = 0;
  private auditNotes = new Map<string,string>();
  private infiltratorName?: string;
  private amended = false;
  private fraud = false;
  private reportedFraud = false;
  private audits = new Map<string,'clean' | 'fraud'>();
  private outcomes: Outcome[] = [];
  private winner?: Role;
  private reason?: string;

  get running() { return this.phase==='negotiation' || this.phase==='ballot' || this.phase==='hearing'; }

  start(requester:string, players:Player[], now:number, random = Math.random, requested=1) {
    players = players.filter(player=>!player.npc);
    const ids = players.map(({id}) => id);
    if (this.running || ids.length<this.minimumPlayers || ids[0]!==requester) return false;
    this.electorate = new Set(ids);
    this.treasuryReputation.clear();
    this.npcIds.clear();
    this.npcVotes.clear();
    this.initialPlayers = ids.length;
    const candidates = [...players];
    const count = ids.length===1 ? 0 : ids.length>=6 && requested===2 ? 2 : 1;
    this.infiltrators.clear();
    for (let i=0;i<count;i++) this.infiltrators.add(candidates.splice(Math.floor(random()*candidates.length),1)[0].id);
    const contacts = players.map(player => ({id:player.id,name:player.nick,character:player.character}));
    this.started = now;
    this.fire.reset(now);
    this.complaints.reset();
    this.economy.reset(contacts,random);
    const {humans,reserve} = this.economy.totals();
    this.cash = {initial:humans+reserve+rules.startingBudget,npcIssued:0,spawned:0,expired:0,treasury:0,salaries:0,publicDuty:0,projects:0,diverted:0};
    this.election.reset(players.map(({id,nick,character}) => ({id,name:nick,character})),now,random);
    this.infiltratorName = [...this.infiltrators].map(id => this.economy.name(id)).join(', ') || undefined;
    this.hearingImmunity.clear();
    this.hearingTarget = this.hearingResult = undefined;
    this.stability = 48;
    this.budget = rules.startingBudget;
    this.round = 0;
    this.agenda.clear();
    this.outcomes = [];
    this.winner = this.reason = undefined;
    this.nextRound(now);
    return true;
  }

  private agendaYesVotes = new Set<string>();

  private nextRound(now:number) {
    this.project = undefined;
    this.resetVote();
    this.phase = 'negotiation';
    this.ends = now+NEGOTIATION_MS;
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
    if (!this.running || !this.electorate.delete(id)) return;
    this.votes.delete(id);
    this.voteIntents.delete(id);
    this.election.leave(id,now);
    this.refreshAgendaEligibility();
    this.economy.cancelOffers(id);
    if (this.infiltrators.size && ![...this.infiltrators].some(infiltrator => this.election.office(infiltrator))) this.finish('Parlamentar','Nenhum infiltrado permanece com mandato.');
    else if (this.electorate.size<Math.min(3,this.initialPlayers)) this.finish(undefined,'Partida encerrada: faltaram jogadores.');
  }

  act(player:Player, action:Action, now:number) {
    if (!this.canVote(player.id)) return;
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
      this.economy.recordActivity(player.id,'emenda');
    }
    if (action==='fraud' && this.infiltrators.has(player.id) && !this.economy.suspended(player.id) && !this.fraud) {
      this.fraud = true;
      this.audits.clear();
    }
    if (action==='audit') {
      this.audits.set(player.id,this.fraud ? 'fraud' : 'clean');
      const note = this.economy.audit(player.id,this.round,1);
      if (note) this.auditNotes.set(player.id,note);
      const finding = this.reportedFraud ? 'O Painel já mostra os números corrigidos.' :
        this.fraud ? 'Fraude no projeto. Vá ao Painel para corrigir os números.' : 'Os números do projeto conferem.';
      return {text:note ? `${finding} ${note}` : finding,critical:this.fraud && !this.reportedFraud};
    }
    if (action==='panel' && this.audits.get(player.id)==='fraud') this.reportedFraud = true;
  }

  roomActivity(player:Player, activity:RoomActivity, now:number):RoomActivityResult | undefined {
    const {id} = player;
    if (this.phase!=='negotiation' || now>=this.ends || !this.electorate.has(id) || this.isolated(id) || !this.at(player,activity)) return;
    const bill = bills[this.projectIndex].name;
    switch (activity) {
      case 'cabinet': return {activity,text:`O orçamento público está em ${money(this.budget)}.`};
      case 'coffee':
        this.economy.recordActivity(id,'cafe');
        return {activity,text:'Cafezinho tomado. De volta à articulação!'};
      case 'library':
        this.economy.recordActivity(id,'leitura');
        return {activity,text:`Você estudou o projeto ${bill}.`};
      case 'committees': return {activity,text:`Votos a favor necessários para aprovar ${bill}: ${this.billQuorum()}.`};
      case 'credentials': {
        this.economy.recordActivity(id,'credencial');
        const office = this.election.office(id);
        return {activity,text:office ? `${this.economy.name(id)} · Parlamentar · Salário previsto de ${money(rules.salary)} por ciclo.` :
          `${this.economy.name(id)} · Ex-parlamentar`};
      }
      case 'benches': return {activity,text:`Parlamentares aptos a votar nesta rodada: ${this.votingPlayers()}.`};
      default: return {activity};
    }
  }

  gameplayWorld(players:Player[], now:number, voice:(id:string)=>boolean):GameplayWorld {
    return {
      players:players.filter(player => this.electorate.has(player.id) || this.npcIds.has(player.id)),now,
      plenary:this.phase!=='negotiation',started:this.started,wallet:id=>this.economy.wallet(id),spend:(id,amount)=>this.economy.spend(id,amount),
      office:id=>this.npcIds.has(id) ? 'deputy' : this.election.office(id),
      hasMandate:id=>this.npcIds.has(id) || !!this.election.office(id),
      cashFlow:(kind,amount)=>{ this.cash[kind] += amount; },
      deposit:(id,amount)=>{
        if (!this.running || !this.electorate.has(id) || amount<=0) return false;
        this.cash.treasury += amount;
        this.budget = Math.round((this.budget+amount)*10)/10;
        const credited = this.treasuryReputation.get(id) ?? 0;
        const gain = Math.max(0,Math.min(rules.treasuryReputationCap-credited,Math.floor(amount)));
        this.treasuryReputation.set(id,credited+gain);
        this.economy.changePopularity(id,gain);
        return true;
      },
      lootWallet:(id,fraction)=>this.electorate.has(id) ? this.economy.takeWallet(id,fraction) : 0,
      takeWallet:id=>this.npcIds.has(id) ? this.economy.takeWallet(id) : 0,
      payNpc:(from,to,amount)=>this.npcIds.has(to) && this.economy.transfer(from,to,amount,true,this.round),
      hasEvidence:(id,kind)=>this.economy.hasEvidence(id,kind),
      hasMission:(id,mission)=>this.economy.hasMission(id,mission),voice,earn:(id,amount)=>this.economy.earn(id,amount),
      publish:event=>{
        if (this.phase==='negotiation' && event.type==='filed' && event.project!==undefined && bills[event.project]) {
          if (!this.agenda.size && event.project!==this.projectIndex) this.voteIntents.clear();
          this.agenda.add(event.project);
          this.refreshAgendaEligibility();
        }
        this.complaints.record(event,this.started);
        this.economy.recordGameplay(event);
      },
    };
  }

  allocateAttribute(id:string, request:AttributeRequest, now:number) {
    return this.phase==='negotiation' && now<this.ends && this.electorate.has(id) && this.economy.allocate(id,request);
  }

  isolated(id:string) { return this.running && this.economy.suspended(id); }

  canHandleObjects(id:string, now:number) {
    return this.electorate.has(id) && !this.isolated(id) && now<this.ends && (this.phase==='negotiation' || this.phase==='ballot');
  }

  declareVote(id:string,vote:Vote|null,now:number) {
    if (this.phase!=='negotiation' || now>=this.ends || !this.canVote(id)) return;
    if (vote===null) this.voteIntents.delete(id);
    else this.voteIntents.set(id,vote);
  }

  vote(id:string, vote:Vote, now:number) {
    if ((this.phase!=='ballot' && this.phase!=='hearing') || now>=this.ends || !this.canVote(id)) return;
    const previous = this.votes.get(id);
    this.votes.set(id,vote);
    if (this.phase!=='ballot') return;
    const firstSupport = vote==='yes' && !this.agendaYesVotes.has(id);
    if (firstSupport) this.agendaYesVotes.add(id);
    if (previous===undefined || firstSupport) this.economy.recordVote(id,previous===undefined,firstSupport);
  }

  private canVote(id:string) { return this.electorate.has(id) && !!this.election.office(id) && !this.economy.suspended(id); }

  private at(player:Player, key:keyof typeof stations) {
    const station = stations[key];
    return canInteract(player,station,{radius:STATION_RADIUS,handsFree:true});
  }

  private nearby(player:Player, other:Player) {
    return player.id!==other.id && this.electorate.has(other.id) &&
      canInteract(player,other,{radius:TRADE_RADIUS,handsFree:true});
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
      case 'campaign':
        if (this.canVote(id) && this.at(player,'press')) this.economy.campaign(id,this.round);
        break;
      case 'transfer':
        if (near(action.to)) this.economy.transfer(id,action.to,action.amount,action.clandestine,this.round);
        break;
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
        if (!this.canVote(id) || !this.economy.canCall(id) || !this.canVote(action.target) ||
            (this.hearingImmunity.get(action.target) ?? 0)>now || id===action.target || !this.at(player,'panel')) break;
        this.hearingTarget = action.target;
        this.interruptedTime = this.ends-now;
        this.ends = now+HEARING_MS;
        this.votes.clear();
        this.economy.cancelOffers();
        this.phase = 'hearing';
        break;
    }
  }

  electionAction(player:Player, action:ElectionAction, now:number, hasVoice:boolean) {
    const {id} = player;
    if (this.phase!=='negotiation' || now>=this.ends || !this.canVote(id) || !this.election.open(now)) return;
    const spend = (amount:number) => this.economy.spend(id,amount);
    switch (action.kind) {
      case 'invest': this.election.invest(id,action.amount,spend); break;
      case 'advertise':
        if (this.at(player,'press') && this.election.advertise(id,spend)) this.economy.recordActivity(id,'propaganda');
        break;
      case 'speech':
        if (this.at(player,'panel') && this.election.speech(id)) {
          this.economy.recordActivity(id,'discurso');
          this.economy.changePopularity(id,3);
        }
        break;
      case 'interview': if (hasVoice && this.at(player,'tv')) this.election.interview(id,now); break;
      case 'support': this.election.support(id,action.to); break;
      case 'object':
        if (this.at(player,'panel') && !this.objection() && this.election.object(id)) this.objector = id;
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
    const impact = bills[this.projectIndex][vote];
    if (vote==='no') return {...impact,budget:Math.min(0,impact.budget)};
    return {
      stability:impact.stability-(this.amended ? 8 : 0),
      budget:Math.min(0,impact.budget+(this.amended ? 16 : 0)+(misleading ? 24 : 0)),
    };
  }

  complaintView(id:string) {
    return {available:this.complaints.available(id,actor=>this.economy.name(actor)),history:this.complaints.history()};
  }

  submitComplaint(player:Player,id:number,now:number,photo?:Photo) {
    if (this.phase!=='negotiation' || !this.canHandleObjects(player.id,now) || !this.at(player,'audit')) {
      return 'Vá ao balcão da Corregedoria durante a articulação.';
    }
    const result = this.complaints.submit(player.id,id,actor=>this.economy.name(actor),photo);
    if (!result) return 'Caso indisponível ou fotografia incompatível.';
    this.economy.rewardFromReserve(player.id,complaintRules.reward);
    this.economy.changePopularity(result.actor,-complaintRules.popularityLoss);
    this.election.scandal(result.actor);
    this.economy.recordOfficialScandal();
  }

  actOnFire(player:Player, action:FireAction, site:number, now:number) {
    if (this.phase!=='negotiation' || !this.canHandleObjects(player.id,now) || !canActOnFire(player,site,action)) return;
    if (action==='extinguish') return this.fire.extinguish(site) ? 'Incêndio apagado.' : undefined;
    if (this.infiltrators.has(player.id) && this.fire.potentialSite===site && this.fire.ignite(site)) return 'Incêndio provocado.';
  }

  advance(now:number) {
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
    if (now>=this.started+rules.matchDuration) {
      this.finish(this.stability>0 ? 'Parlamentar' : 'Infiltrado','O tempo da sessão terminou.');
      return;
    }
    if (this.phase==='negotiation' && now<this.ends) {
      this.renew(now);
      if (!this.running) return;
    }
    if (now<this.ends) return;
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
        this.ends = now+this.interruptedTime;
      }
      return;
    }
    if (this.phase==='negotiation') {
      this.economy.cancelOffers();
      this.project = this.projectIndex;
      this.agenda.delete(this.project);
      this.phase = 'ballot';
      this.ends = now+BALLOT_MS;
      return;
    }
    let yes = [...this.votes.values()].filter(vote => vote==='yes').length;
    let no = this.votes.size-yes;
    const preference = [...this.npcVotes.values()].reduce((score,vote)=>score+(vote==='yes' ? 1 : -1),0);
    if (this.votes.size===this.votingPlayers() && yes===no && yes>0) {
      if (preference>0) yes++;
      if (preference<0) no++;
    }
    const needed = this.billQuorum();
    const passed = yes>=needed;
    const impact = this.impact(passed ? 'yes' : 'no');
    const balance = this.budget+Math.min(0,impact.budget);
    if (passed && bills[this.projectIndex].fireSafety) this.fire.increaseSafety();
    this.economy.billResult(this.votes,passed,bills[this.projectIndex].yes.stability>0);
    const previous = {budget:this.budget,stability:this.stability};
    this.budget = Math.max(0,Math.round(balance*10)/10);
    this.cash.projects += previous.budget-this.budget;
    const funding = impact.budget<0 ? Math.min(1,previous.budget/-impact.budget) : 1;
    const benefit = impact.stability>0 ? Math.floor(impact.stability*funding) : impact.stability;
    this.stability = clamp(this.stability+benefit+Math.round(Math.min(0,balance)*2));
    this.outcomes.push({round:this.round,project:this.projectIndex,passed,yes,no,needed,deficit:Math.max(0,-balance),fraud:this.fraud,
      applied:{budget:this.budget-previous.budget,stability:this.stability-previous.stability}});
    this.economy.cancelOffers();
    if (!this.stability) this.finish(this.infiltrators.size ? 'Infiltrado' : undefined,'O Congresso entrou em colapso.');
    else {
      this.round++;
      if (this.agenda.size) {
        this.resetVote();
        this.project = this.agenda.values().next().value;
        if (this.project!==undefined) this.agenda.delete(this.project);
        this.ends = now+BALLOT_MS;
      } else this.nextRound(now);
      this.refreshAgendaEligibility();
    }
  }

  private votingPlayers() { return [...this.electorate].filter(id => this.canVote(id)).length; }
  private quorum() { return Math.floor(this.votingPlayers()/2)+1; }

  private billQuorum() { return Math.min(this.votingPlayers(),this.quorum()+(this.objection() ? 1 : 0)); }

  private finish(winner:Role | undefined, reason:string) {
    this.phase = 'finished';
    this.winner = winner;
    this.reason = reason;
  }

  view(id:string, ids:string[], now:number, contacts:Contact[] = []): PlenaryView {
    const role = this.electorate.has(id) ? this.infiltrators.has(id) ? 'Infiltrado' : 'Parlamentar' : undefined;
    return {
      phase:this.phase,round:this.round,project:this.projectIndex,queuedProjects:[...this.agenda],remaining:this.running ? Math.max(0,Math.ceil((this.ends-now)/1000)) : 0,
      stability:this.stability,budget:this.budget,host:ids[0],role,mandate:role ? !!this.election.office(id) : undefined,solo:this.initialPlayers===1,players:ids.length,minimumPlayers:this.minimumPlayers,
      voteIntents:[...this.voteIntents].filter(([player])=>this.canVote(player)).map(([id,vote])=>({id,name:this.economy.name(id),vote})),
      electorate:this.votingPlayers(),vote:this.votes.get(id),voted:this.votes.size,
      amended:this.amended,canFraud:role==='Infiltrado' && !this.fraud && this.canVote(id),
      audit:this.audits.get(id),reportedFraud:this.reportedFraud,
      yes:this.impact('yes',this.fraud && !this.reportedFraud && !this.audits.has(id) && role!=='Infiltrado' && this.running),
      billQuorum:this.billQuorum(),
      election:role ? this.election.view(id,now,this.popularity,this.phase==='negotiation',this.objection()) : undefined,
      politics:role ? this.economy.view(id,contacts,this.round,this.canVote(id),id => this.canVote(id) && (this.hearingImmunity.get(id) ?? 0)<=now) : undefined,
      fire:this.running ? this.fire.view(this.phase==='negotiation') : undefined,
      sabotageFireSite:role==='Infiltrado' && this.phase==='negotiation' && !this.isolated(id) ? this.fire.potentialSite : undefined,
      isolationSeconds:this.isolated(id) ? this.economy.suspensionRemaining(id,now) : undefined,
      auditNote:this.auditNotes.get(id),
      hearing:this.hearingTarget ? {target:this.economy.name(this.hearingTarget),voted:this.votes.size,vote:this.votes.get(id)} : undefined,
      hearingResult:this.hearingResult,
      no:this.impact('no'),outcome:this.outcomes.at(-1),outcomes:this.outcomes.slice(),winner:this.winner,reason:this.reason,
      infiltratorName:this.phase==='finished' ? this.infiltratorName : undefined,
    };
  }
}
