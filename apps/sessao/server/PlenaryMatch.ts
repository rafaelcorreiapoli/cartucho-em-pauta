import {
  BALLOT_MS, bills, MIN_PLAYERS, NEGOTIATION_MS, stations, STATION_RADIUS,
  type Action, type Impact, type Outcome, type Phase, type PlenaryView, type Role, type Vote,
} from '../src/plenary';
import { localPerception, playerName, type Player } from '../src/map';
import { HEARING_MS, TRADE_RADIUS, type Contact, type PoliticsAction } from '../src/politics';
import { PoliticalEconomy } from './PoliticalEconomy';

const clamp = (value:number) => Math.max(0,Math.min(100,value));

export class PlenaryMatch {
  phase: Phase = 'lobby';
  private round = 0;
  private ends = 0;
  private stability = 48;
  private budget = 32;
  private electorate = new Set<string>();
  private votes = new Map<string,Vote>();
  private infiltrators = new Set<string>();
  private economy = new PoliticalEconomy();
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
  private outcome?: Outcome;
  private winner?: Role;
  private reason?: string;

  get running() { return this.phase==='negotiation' || this.phase==='ballot' || this.phase==='hearing'; }

  start(requester:string, players:Player[], now:number, random = Math.random, requested=1) {
    const ids = players.map(({id}) => id);
    if (this.running || ids.length<MIN_PLAYERS || ids[0]!==requester) return false;
    this.electorate = new Set(ids);
    const candidates = [...players];
    const count = players.length===6 && requested===2 ? 2 : 1;
    this.infiltrators.clear();
    for (let i=0;i<count;i++) this.infiltrators.add(candidates.splice(Math.floor(random()*candidates.length),1)[0].id);
    this.economy.reset(players.map(player => ({id:player.id,name:playerName(player,players,true)})),random);
    this.infiltratorName = [...this.infiltrators].map(id => this.economy.name(id)).join(', ');
    this.hearingUsed = false;
    this.hearingTarget = this.hearingResult = undefined;
    this.stability = 48;
    this.budget = 32;
    this.round = 0;
    this.outcome = this.winner = this.reason = undefined;
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
    this.fraud = this.reportedFraud = false;
  }

  leave(id:string) {
    if (!this.running || !this.electorate.delete(id)) return;
    this.votes.delete(id);
    this.economy.cancelOffers(id);
    if (![...this.infiltrators].some(infiltrator => this.electorate.has(infiltrator))) this.finish('Parlamentar','Os infiltrados saíram da partida.');
    else if (this.electorate.size<MIN_PLAYERS) this.finish(undefined,'Partida encerrada: faltaram jogadores.');
  }

  act(player:Player, action:Action, now:number) {
    if (!this.electorate.has(player.id) || this.phase!=='negotiation' || now>=this.ends) return;
    const station = stations[action==='fraud' ? 'panel' : action];
    if (Math.hypot(player.x-station.x,player.y-station.y)>STATION_RADIUS) return;
    if (action==='amendment') this.amended = true;
    if (action==='fraud' && this.infiltrators.has(player.id) && !this.economy.suspended(player.id) && !this.fraud) {
      this.fraud = true;
      this.audits.clear();
    }
    if (action==='audit') {
      this.audits.set(player.id,this.fraud ? 'fraud' : 'clean');
      const note = this.economy.audit(player.id,this.round);
      if (note) this.auditNotes.set(player.id,note);
    }
    if (action==='panel' && this.audits.get(player.id)==='fraud') this.reportedFraud = true;
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
    return this.phase==='negotiation' ? players.filter(other => this.nearby(player,other))
      .map(({id}) => ({id,name:this.economy.name(id)})) : [];
  }

  politics(player:Player, action:PoliticsAction, players:Player[], now:number) {
    const {id} = player;
    if (this.phase!=='negotiation' || now>=this.ends || !this.electorate.has(id)) return;
    const near = (target:string) => players.some(other => other.id===target && this.nearby(player,other));
    switch (action.kind) {
      case 'grant': {
        if (!this.at(player,'cabinet')) break;
        const result = this.economy.grant(id,action.diverted,this.budget,this.round);
        if (!result) break;
        this.budget -= result.budget;
        this.stability = clamp(this.stability+result.stability);
        if (!this.stability) this.finish('Infiltrado','O Congresso entrou em colapso.');
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
      case 'publish':
        if (this.at(player,'press')) this.economy.publish(id,action.evidence);
        break;
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

  private impact(vote:Vote, misleading = false): Impact {
    const impact = bills[this.round][vote];
    if (vote==='no') return impact;
    return {
      stability:impact.stability-(this.amended ? 8 : 0),
      budget:impact.budget+(this.amended ? 16 : 0)+(misleading ? 24 : 0),
    };
  }

  advance(now:number) {
    if (!this.running || now<this.ends) return;
    if (this.phase==='hearing') {
      const target = this.hearingTarget!;
      const yes = [...this.votes.values()].filter(vote => vote==='yes').length;
      const removed = this.canVote(target) && yes>=this.quorum();
      if (removed) {
        this.economy.suspend(target);
        if (!this.infiltrators.has(target)) this.stability = clamp(this.stability-12);
      }
      this.hearingResult = `${this.economy.name(target)}: mandato ${removed ? 'cassado' : 'mantido'} (${yes} votos pela cassação).`;
      this.hearingTarget = undefined;
      this.votes.clear();
      if (!this.stability) this.finish('Infiltrado','O Congresso entrou em colapso.');
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
    const needed = this.quorum();
    const passed = yes>=needed;
    const impact = this.impact(passed ? 'yes' : 'no');
    const balance = this.budget+impact.budget;
    this.economy.billResult(this.votes,passed,bills[this.round].yes.stability>0);
    this.budget = clamp(balance);
    this.stability = clamp(this.stability+impact.stability+Math.min(0,balance)*2);
    this.outcome = {round:this.round,passed,yes,no:this.votes.size-yes,needed,deficit:Math.max(0,-balance),fraud:this.fraud};
    if (!this.stability) this.finish('Infiltrado','O Congresso entrou em colapso.');
    else if (this.round===bills.length-1) {
      this.finish(this.stability>=45 ? 'Parlamentar' : 'Infiltrado',
        this.stability>=45 ? 'O Congresso terminou a sessão estável.' : 'A sessão terminou abaixo de 45 de estabilidade.');
    } else {
      this.round++;
      this.nextRound(now);
    }
  }

  private votingPlayers() { return [...this.electorate].filter(id => this.canVote(id)).length; }
  private quorum() { return Math.floor(this.votingPlayers()/2)+1; }

  private finish(winner:Role | undefined, reason:string) {
    this.phase = 'finished';
    this.winner = winner;
    this.reason = reason;
  }

  view(id:string, ids:string[], now:number, contacts:Contact[] = []): PlenaryView {
    const role = this.electorate.has(id) ? this.infiltrators.has(id) ? 'Infiltrado' : 'Parlamentar' : undefined;
    return {
      phase:this.phase,round:this.round,remaining:this.running ? Math.max(0,Math.ceil((this.ends-now)/1000)) : 0,
      stability:this.stability,budget:this.budget,host:ids[0],role,players:ids.length,
      electorate:this.votingPlayers(),vote:this.votes.get(id),voted:this.votes.size,
      amended:this.amended,canFraud:role==='Infiltrado' && !this.fraud && this.canVote(id),
      audit:this.audits.get(id),reportedFraud:this.reportedFraud,
      yes:this.impact('yes',this.fraud && !this.reportedFraud && !this.audits.has(id) && role!=='Infiltrado' && this.running),
      politics:role ? this.economy.view(id,contacts,this.round,!this.hearingUsed,id => this.canVote(id)) : undefined,
      auditNote:this.auditNotes.get(id),
      hearing:this.hearingTarget ? {target:this.economy.name(this.hearingTarget),voted:this.votes.size,vote:this.votes.get(id)} : undefined,
      hearingResult:this.hearingResult,
      no:this.impact('no'),outcome:this.outcome,winner:this.winner,reason:this.reason,
      infiltratorName:this.phase==='finished' ? this.infiltratorName : undefined,
    };
  }
}
