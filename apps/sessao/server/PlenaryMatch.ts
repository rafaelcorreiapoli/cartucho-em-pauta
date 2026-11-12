import type { GameplayWorld } from './gameplay-world';
import { offices, type ElectionAction } from '../src/elections';
import { ElectionCycle } from './ElectionCycle';
import {
  BALLOT_MS, bills, MIN_PLAYERS, NEGOTIATION_MS, stations, STATION_RADIUS,
  type Action, type Impact, type Outcome, type Phase, type PlenaryView, type Role, type Vote,
} from '../src/plenary';
import { localPerception, type Player } from '../src/map';
import { HEARING_MS, money, TRADE_RADIUS, type Contact, type PoliticsAction } from '../src/politics';
import type { RoomActivity, RoomActivityResult } from '../src/room-activities';
import { PoliticalEconomy } from './PoliticalEconomy';

const clamp = (value:number) => Math.max(0,Math.min(100,value));

export class PlenaryMatch {
  phase: Phase = 'lobby';
  private round = 0;
  private started = 0;
  private ends = 0;
  private stability = 48;
  private budget = 32;
  private initialPlayers = 0;
  private electorate = new Set<string>();
  private votes = new Map<string,Vote>();
  private infiltrators = new Set<string>();
  private economy = new PoliticalEconomy();
  private election = new ElectionCycle();
  private objector?:string;
  private popularity = (id:string) => this.economy.popularity(id);
  private hearingTarget?: string;
  private hearingUsed = false;
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
    const ids = players.map(({id}) => id);
    if (this.running || ids.length<MIN_PLAYERS || ids[0]!==requester) return false;
    this.electorate = new Set(ids);
    this.initialPlayers = ids.length;
    const candidates = [...players];
    const count = ids.length===1 ? 0 : ids.length>=6 && requested===2 ? 2 : 1;
    this.infiltrators.clear();
    for (let i=0;i<count;i++) this.infiltrators.add(candidates.splice(Math.floor(random()*candidates.length),1)[0].id);
    const contacts = players.map(player => ({id:player.id,name:player.nick,character:player.character}));
    this.started = now;
    this.economy.reset(contacts,random);
    this.election.reset(players.map(({id,nick,character}) => ({id,name:nick,character})),now,random);
    this.infiltratorName = [...this.infiltrators].map(id => this.economy.name(id)).join(', ') || undefined;
    this.hearingUsed = false;
    this.hearingTarget = this.hearingResult = undefined;
    this.stability = 48;
    this.budget = 32;
    this.round = 0;
    this.outcomes = [];
    this.winner = this.reason = undefined;
    this.nextRound(now);
    return true;
  }

  private nextRound(now:number) {
    this.phase = 'negotiation';
    this.ends = now+NEGOTIATION_MS;
    this.votes.clear();
    this.audits.clear();
    this.auditNotes.clear();
    this.amended = false;
    this.objector = undefined;
    this.fraud = this.reportedFraud = false;
  }

  leave(id:string, now:number) {
    if (!this.running || !this.electorate.delete(id)) return;
    this.votes.delete(id);
    this.election.leave(id,now);
    this.economy.cancelOffers(id);
    if (this.infiltrators.size && ![...this.infiltrators].some(infiltrator => this.electorate.has(infiltrator))) this.finish('Parlamentar','Os infiltrados saíram da partida.');
    else if (this.electorate.size<Math.min(3,this.initialPlayers)) this.finish(undefined,'Partida encerrada: faltaram jogadores.');
  }

  act(player:Player, action:Action, now:number) {
    if (!this.electorate.has(player.id)) return;
    if (this.phase!=='negotiation' || now>=this.ends) {
      if (action==='audit') return {text:'A auditoria só pode ser feita durante a articulação.',critical:false};
      return;
    }
    if (!this.at(player,action==='fraud' ? 'panel' : action)) {
      if (action==='audit') return {text:'Chegue mais perto do ponto da Controladoria.',critical:false};
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
      const note = this.economy.audit(player.id,this.round,this.election.office(player.id)==='senator' ? 2 : 1);
      if (note) this.auditNotes.set(player.id,note);
      const finding = this.reportedFraud ? 'O Painel já mostra os números corrigidos.' :
        this.fraud ? 'Fraude no projeto. Vá ao Painel para corrigir os números.' : 'Os números do projeto conferem.';
      return {text:note ? `${finding} ${note}` : finding,critical:this.fraud && !this.reportedFraud};
    }
    if (action==='panel' && this.audits.get(player.id)==='fraud') this.reportedFraud = true;
  }

  roomActivity(player:Player, activity:RoomActivity, now:number):RoomActivityResult | undefined {
    const {id} = player;
    if (this.phase!=='negotiation' || now>=this.ends || !this.electorate.has(id) || !this.at(player,activity)) return;
    const bill = bills[this.round].name;
    switch (activity) {
      case 'cabinet': return {activity,text:`O orçamento público está em ${this.budget} de 100.`};
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
        return {activity,text:office ? `${this.economy.name(id)} · ${offices[office].name} · Salário de ${money(offices[office].salary)} por mandato.` :
          `${this.economy.name(id)} · Assessor`};
      }
      case 'benches': return {activity,text:`Parlamentares aptos a votar nesta rodada: ${this.votingPlayers()}.`};
      case 'gallery': return {activity,text:`Sua popularidade com o público está em ${this.popularity(id)} de 100.`};
      default: return {activity};
    }
  }

  gameplayWorld(players:Player[], now:number, voice:(id:string)=>boolean):GameplayWorld {
    return {
      players:players.filter(player => this.electorate.has(player.id)),now,
      started:this.started,spend:(id,amount)=>this.economy.spend(id,amount),
      office:id=>this.election.office(id),voice,earn:(id,amount)=>this.economy.earn(id,amount),
      publish:event=>this.economy.recordGameplay(event),
    };
  }

  canHandleObjects(id:string, now:number) {
    return this.electorate.has(id) && now<this.ends && (this.phase==='negotiation' || this.phase==='ballot');
  }

  vote(id:string, vote:Vote, now:number) {
    if ((this.phase==='ballot' || this.phase==='hearing') && now<this.ends && this.canVote(id)) this.votes.set(id,vote);
  }

  private canVote(id:string) { return this.electorate.has(id) && !this.economy.suspended(id); }

  private at(player:Player, key:keyof typeof stations) {
    const station = stations[key];
    return Math.hypot(player.x-station.x,player.y-station.y)<=STATION_RADIUS;
  }

  private nearby(player:Player, other:Player) {
    return player.id!==other.id && this.electorate.has(other.id) &&
      Math.hypot(player.x-other.x,player.y-other.y)<=TRADE_RADIUS && localPerception(player,other).visible;
  }

  contacts(player:Player, players:Player[]): Contact[] {
    return this.phase==='negotiation' || this.phase==='ballot' ? players.filter(other => this.nearby(player,other))
      .map(({id}) => ({id,name:this.economy.name(id)})) : [];
  }

  politics(player:Player, action:PoliticsAction, players:Player[], now:number) {
    const {id} = player;
    const privateDeal = action.kind==='transfer' || action.kind==='share' || action.kind==='accept' || action.kind==='cancel';
    if ((this.phase!=='negotiation' && !(this.phase==='ballot' && privateDeal)) ||
      now>=this.ends || !this.electorate.has(id)) return;
    const near = (target:string) => players.some(other => other.id===target && this.nearby(player,other));
    switch (action.kind) {
      case 'grant': {
        if (!this.at(player,'cabinet') || this.election.office(id)!=='deputy') break;
        const result = this.economy.grant(id,action.diverted,this.budget,this.round);
        if (!result) break;
        this.budget -= result.budget;
        this.stability = clamp(this.stability+result.stability);
        if (!this.stability) this.finish(this.infiltrators.size ? 'Infiltrado' : undefined,'O Congresso entrou em colapso.');
        break;
      }
      case 'campaign':
        if (this.at(player,'press')) this.economy.campaign(id,this.round);
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
        const president = [...this.electorate].find(person => this.election.office(person)==='president');
        const published = this.economy.publish(id,action.evidence,president);
        if (published) this.election.scandal(published.from);
        break;
      }
      case 'hearing':
        if (this.hearingUsed || !this.economy.canCall(id) || !this.canVote(action.target) ||
            id===action.target || !this.at(player,'panel')) break;
        this.hearingUsed = true;
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
      case 'run': this.election.run(id,action.office,now); break;
      case 'invest': this.election.invest(id,action.amount,spend); break;
      case 'advertise': if (this.at(player,'press')) this.election.advertise(id,spend); break;
      case 'speech':
        if (this.at(player,'panel') && this.election.speech(id)) this.economy.changePopularity(id,3);
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
    return this.objector && this.election.office(this.objector)==='president' ? this.economy.name(this.objector) : undefined;
  }

  private impact(vote:Vote, misleading = false): Impact {
    const impact = bills[this.round][vote];
    if (vote==='no') return impact;
    return {
      stability:impact.stability-(this.amended ? 8 : 0),
      budget:impact.budget+(this.amended ? 16 : 0)+(misleading ? 24 : 0),
    };
  }

  advance(now:number) {
    if (!this.running) return;
    if (this.phase!=='ballot' && !(this.phase==='negotiation' && now>=this.ends)) {
      this.election.advance(now,this.popularity,(id,amount) => this.economy.earn(id,amount));
    }
    if (now<this.ends) return;
    if (this.phase==='hearing') {
      const target = this.hearingTarget!;
      const yes = [...this.votes.values()].filter(vote => vote==='yes').length;
      const removed = this.canVote(target) && yes>=this.quorum();
      if (removed) {
        this.economy.suspend(target);
        this.election.leave(target,now);
        if (!this.infiltrators.has(target)) this.stability = clamp(this.stability-12);
      }
      this.hearingResult = `${this.economy.name(target)}: mandato ${removed ? 'cassado' : 'mantido'} (${yes} votos pela cassação).`;
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
      this.phase = 'ballot';
      this.ends = now+BALLOT_MS;
      return;
    }
    const yes = [...this.votes.values()].filter(vote => vote==='yes').length;
    const needed = this.billQuorum();
    const passed = yes>=needed;
    const impact = this.impact(passed ? 'yes' : 'no');
    const balance = this.budget+impact.budget;
    this.economy.billResult(this.votes,passed,bills[this.round].yes.stability>0);
    const previous = {budget:this.budget,stability:this.stability};
    this.budget = clamp(balance);
    this.stability = clamp(this.stability+impact.stability+Math.min(0,balance)*2);
    this.outcomes.push({round:this.round,passed,yes,no:this.votes.size-yes,needed,deficit:Math.max(0,-balance),fraud:this.fraud,
      applied:{budget:this.budget-previous.budget,stability:this.stability-previous.stability}});
    this.election.advance(now,this.popularity,(id,amount) => this.economy.earn(id,amount));
    this.economy.cancelOffers();
    if (!this.stability) this.finish(this.infiltrators.size ? 'Infiltrado' : undefined,'O Congresso entrou em colapso.');
    else if (this.round===bills.length-1) {
      this.finish(this.stability>=45 ? 'Parlamentar' : this.infiltrators.size ? 'Infiltrado' : undefined,
        this.stability>=45 ? 'O Congresso terminou a sessão estável.' : 'A sessão terminou abaixo de 45 de estabilidade.');
    } else {
      this.round++;
      this.nextRound(now);
    }
  }

  private votingPlayers() { return [...this.electorate].filter(id => this.canVote(id)).length; }
  private quorum() { return Math.floor(this.votingPlayers()/2)+1; }

  private billQuorum() { return Math.min(this.votingPlayers(),this.quorum()+(this.objection() ? 1 : 0)); }

  private finish(winner:Role | undefined, reason:string) {
    this.economy.settleAgendas(this.electorate);
    this.phase = 'finished';
    this.winner = winner;
    this.reason = reason;
  }

  view(id:string, ids:string[], now:number, contacts:Contact[] = []): PlenaryView {
    const role = this.electorate.has(id) ? this.infiltrators.has(id) ? 'Infiltrado' : 'Parlamentar' : undefined;
    return {
      phase:this.phase,round:this.round,remaining:this.running ? Math.max(0,Math.ceil((this.ends-now)/1000)) : 0,
      stability:this.stability,budget:this.budget,host:ids[0],role,solo:this.initialPlayers===1,players:ids.length,
      electorate:this.votingPlayers(),vote:this.votes.get(id),voted:this.votes.size,
      amended:this.amended,canFraud:role==='Infiltrado' && !this.fraud && this.canVote(id),
      audit:this.audits.get(id),reportedFraud:this.reportedFraud,
      yes:this.impact('yes',this.fraud && !this.reportedFraud && !this.audits.has(id) && role!=='Infiltrado' && this.running),
      billQuorum:this.billQuorum(),
      election:role ? this.election.view(id,now,this.popularity,this.phase==='negotiation',this.objection()) : undefined,
      politics:role ? this.economy.view(id,contacts,this.round,!this.hearingUsed,id => this.canVote(id)) : undefined,
      auditNote:this.auditNotes.get(id),
      hearing:this.hearingTarget ? {target:this.economy.name(this.hearingTarget),voted:this.votes.size,vote:this.votes.get(id)} : undefined,
      hearingResult:this.hearingResult,
      no:this.impact('no'),outcome:this.outcomes.at(-1),outcomes:this.outcomes.slice(),winner:this.winner,reason:this.reason,
      infiltratorName:this.phase==='finished' ? this.infiltratorName : undefined,
    };
  }
}
