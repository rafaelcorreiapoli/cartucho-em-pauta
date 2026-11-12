import {
  BALLOT_MS, bills, MIN_PLAYERS, NEGOTIATION_MS, stations, STATION_RADIUS,
  type Action, type Impact, type Outcome, type Phase, type PlenaryView, type Role, type Vote,
} from '../src/plenary';
import { playerName, type Player } from '../src/map';

const clamp = (value:number) => Math.max(0,Math.min(100,value));

export class PlenaryMatch {
  phase: Phase = 'lobby';
  private round = 0;
  private ends = 0;
  private stability = 48;
  private budget = 32;
  private electorate = new Set<string>();
  private votes = new Map<string,Vote>();
  private infiltrator?: string;
  private infiltratorName?: string;
  private amended = false;
  private fraud = false;
  private reportedFraud = false;
  private audits = new Map<string,'clean' | 'fraud'>();
  private outcome?: Outcome;
  private winner?: Role;
  private reason?: string;

  get running() { return this.phase==='negotiation' || this.phase==='ballot'; }

  start(requester:string, players:Player[], now:number, random = Math.random) {
    const ids = players.map(({id}) => id);
    if (this.running || ids.length<MIN_PLAYERS || ids[0]!==requester) return false;
    this.electorate = new Set(ids);
    const chosen = players[Math.floor(random()*players.length)];
    this.infiltrator = chosen.id;
    this.infiltratorName = playerName(chosen,players,true);
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
    this.amended = false;
    this.fraud = this.reportedFraud = false;
  }

  leave(id:string) {
    if (!this.running || !this.electorate.delete(id)) return;
    this.votes.delete(id);
    if (id===this.infiltrator) this.finish('Parlamentar','O infiltrado saiu da partida.');
    else if (this.electorate.size<MIN_PLAYERS) this.finish(undefined,'Partida encerrada: faltaram jogadores.');
  }

  act(player:Player, action:Action, now:number) {
    if (!this.electorate.has(player.id) || this.phase!=='negotiation' || now>=this.ends) return;
    const station = stations[action==='fraud' ? 'panel' : action];
    if (Math.hypot(player.x-station.x,player.y-station.y)>STATION_RADIUS) return;
    if (action==='amendment') this.amended = true;
    if (action==='fraud' && player.id===this.infiltrator && !this.fraud) {
      this.fraud = true;
      this.audits.clear();
    }
    if (action==='audit') this.audits.set(player.id,this.fraud ? 'fraud' : 'clean');
    if (action==='panel' && this.audits.get(player.id)==='fraud') this.reportedFraud = true;
  }

  vote(id:string, vote:Vote, now:number) {
    if (this.phase==='ballot' && now<this.ends && this.electorate.has(id)) this.votes.set(id,vote);
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
    if (this.phase==='negotiation') {
      this.phase = 'ballot';
      this.ends = now+BALLOT_MS;
      return;
    }
    const yes = [...this.votes.values()].filter(vote => vote==='yes').length;
    const needed = Math.floor(this.electorate.size/2)+1;
    const passed = yes>=needed;
    const impact = this.impact(passed ? 'yes' : 'no');
    const balance = this.budget+impact.budget;
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

  private finish(winner:Role | undefined, reason:string) {
    this.phase = 'finished';
    this.winner = winner;
    this.reason = reason;
  }

  view(id:string, ids:string[], now:number): PlenaryView {
    const role = this.electorate.has(id) ? id===this.infiltrator ? 'Infiltrado' : 'Parlamentar' : undefined;
    return {
      phase:this.phase,round:this.round,remaining:this.running ? Math.max(0,Math.ceil((this.ends-now)/1000)) : 0,
      stability:this.stability,budget:this.budget,host:ids[0],role,players:ids.length,
      electorate:this.electorate.size,vote:this.votes.get(id),voted:this.votes.size,
      amended:this.amended,canFraud:role==='Infiltrado' && !this.fraud,
      audit:this.audits.get(id),reportedFraud:this.reportedFraud,
      yes:this.impact('yes',this.fraud && !this.reportedFraud && !this.audits.has(id) && role!=='Infiltrado' && this.running),
      no:this.impact('no'),outcome:this.outcome,winner:this.winner,reason:this.reason,
      infiltratorName:this.phase==='finished' ? this.infiltratorName : undefined,
    };
  }
}
