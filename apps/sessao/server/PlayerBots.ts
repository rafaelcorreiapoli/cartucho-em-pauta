import {characterStats} from '../src/character-stats';
import {canReachObject,canUseGameplayAction,terminals,type GameplayAction,type GameplayView,type PhoneActivity} from '../src/gameplay';
import {canStand,NAMES,type Motion,type Player} from '../src/map';
import {applyInput,restMovement,type ControlState} from '../src/movement';
import {nickKey} from '../src/nick';
import {bills,canReachStation,publicDebtStabilityLoss,MIN_PLAYERS,projectRules,stabilityRules,stations,type Impact,type PlenaryView,type Vote} from '../src/plenary';
import {canOperatePanel,powerPanels,type PowerPanel} from '../src/power';
import {BotAgenda} from './BotAgenda';
import type {Gameplay} from './Gameplay';
import type {GameplayWorld} from './gameplay-world';
import type {PlenaryMatch} from './PlenaryMatch';

const thinkMs = 650;
const firstFilingDelayMs = 30_000;
const subsequentFilingDelayMs = 120_000;
const walkingSpeedFactor = .8;
const safeDifference = 6;

type Bot = {
  control:ControlState;
  index:number;
  agenda:BotAgenda;
  tempo:number;
  nextThink:number;
  destination?:Motion;
  retryRouteAt:number;
  routeRequest?:Motion;
  round?:number;
  seenAtPanel?:{name:string;at:number};
  suspicion?:string;
  foundFraud?:true;
  lastSignRequest?:{id:string;at:number};
  boughtEvidence?:true;
  cutPower?:true;
  voteReason?:string;
};

function impactScore(impact:Impact,budget:number) {
  const balance = budget+impact.budget;
  const extraDebtLoss = publicDebtStabilityLoss(balance)-publicDebtStabilityLoss(budget);
  return impact.stability-extraDebtLoss+impact.budget/8;
}

export class PlayerBots {
  private bots = new Map<string,Bot>();
  private started = 0;
  private filingSince?:number;
  messages:NonNullable<PlenaryView['botMessages']> = [];

  addTo(players:Map<string,ControlState>,now:number,random=Math.random) {
    this.started = now;
    const occupied = new Set([...players.values()].map(({player})=>player.character));
    const nicknames = new Set([...players.values()].map(({player})=>nickKey(player.nick)));
    for (let number=1;players.size<MIN_PLAYERS;number++) {
      const nick = `Bot ${number}`;
      if (nicknames.has(nickKey(nick))) continue;
      const character = NAMES.findIndex((_,index)=>!occupied.has(index));
      occupied.add(character);
      const player:Player = {id:`bot-${number}`,bot:true,nick,character,x:140,y:146,direction:0,moving:false,
        speed:characterStats[character].speed*walkingSpeedFactor};
      const control:ControlState = {player,ack:0,route:[]};
      const index = this.bots.size;
      const tempo = Math.floor(random()*350);
      this.bots.set(player.id,{control,index,agenda:new BotAgenda(random,now),tempo,nextThink:now+index*125+tempo,retryRouteAt:now});
      players.set(player.id,control);
    }
  }

  clear(players:Map<string,ControlState>) {
    for (const id of this.bots.keys()) players.delete(id);
    this.bots.clear();
    this.filingSince = undefined;
    this.messages = [];
  }

  move(state:ControlState,phone:PhoneActivity|undefined) {
    const bot = this.bots.get(state.player.id)!;
    if (phone) {
      this.stop(bot);
      restMovement(state.player);
      return;
    }
    applyInput(state,{seq:state.ack+1,destination:state.plenary || state.isolated ? undefined : bot.routeRequest});
    bot.routeRequest = undefined;
  }

  tick(match:PlenaryMatch,gameplay:Gameplay,world:GameplayWorld,canSee:(state:ControlState,peer:Player)=>boolean,realNow=world.now,approachLearner=false) {
    if (!this.bots.size) return;
    const {now} = world;
    if (match.phase!=='ballot') this.messages = [];
    if (match.phase!=='ballot' && match.phase!=='negotiation' || match.ballotCountdown(now)!==undefined) return;
    const players = world.players.filter(player=>!player.npc);
    const ids = players.map(player=>player.id);
    for (const [id,bot] of this.bots) {
      if (match.phase==='negotiation') {
        if (now<bot.nextThink) continue;
        bot.nextThink = now+thinkMs+bot.tempo;
      }
      const {player} = bot.control;
      if (player.knockedOut || player.carried || player.carrying || !match.canHandleObjects(id,now)) continue;
      const visible = world.players.filter(peer=>peer!==player && world.present?.(peer.id)!==false && canSee(bot.control,peer));
      const view = match.view(id,ids,realNow,match.contacts(player,visible));
      const canFile = view.phase==='negotiation' && view.project===undefined && !view.protocolCooldown &&
        !view.projectFilingClosed && view.cassationIn===undefined;
      this.filingSince = canFile ? this.filingSince ?? now : undefined;
      if (bot.round!==view.round) {
        bot.round = view.round;
        bot.seenAtPanel = undefined;
        bot.suspicion = undefined;
        bot.foundFraud = undefined;
        bot.boughtEvidence = undefined;
        bot.cutPower = undefined;
        bot.voteReason = undefined;
      }
      if (view.phase==='ballot') {
        this.vote(bot,match,view,players,now,realNow);
        continue;
      }
      if (match.training) {
        this.stop(bot);
        const learner = world.players.find(peer=>!peer.bot && !peer.npc);
        const game = gameplay.view(player,world);
        if (game.call?.state==='incoming') gameplay.act(player,{kind:'answer'},world);
        const request = game.requests[0];
        if (request) gameplay.act(player,{kind:'accept',item:request.id},world);
        if (match.powerOut && bot.index===0) {
          this.go(bot,powerPanels[1],now);
          if (canOperatePanel(player,1)) match.actOnPower(player,{kind:'repair',panel:1},now);
        } else if (approachLearner && learner && bot.index===0) {
          const distance = Math.hypot(player.x-learner.x,player.y-learner.y);
          if (distance>22) this.go(bot,{x:learner.x+(player.x-learner.x)*20/distance,y:learner.y+(player.y-learner.y)*20/distance},now);
        }
      } else this.explore(bot,match,gameplay,world,view,visible);
      const phone = gameplay.phoneActivity(id);
      if (bot.routeRequest && (phone==='open' || phone==='game')) {
        gameplay.act(player,{kind:'phone-close'},world);
      }
    }
  }

  private stop(bot:Bot) {
    bot.control.route = [];
    bot.destination = undefined;
    bot.routeRequest = undefined;
  }

  private go(bot:Bot,point:Motion,now:number) {
    const {control} = bot;
    const same = bot.destination?.x===point.x && bot.destination.y===point.y;
    if (same && (control.route.length || now<bot.retryRouteAt)) return;
    bot.destination = {x:point.x,y:point.y};
    bot.retryRouteAt = now+2_000;
    bot.routeRequest = point;
    control.route = [];
  }

  private meetAtSecretary(bot:Bot,now:number) {
    const {player} = bot.control;
    const center = stations.secretary;
    const angle = bot.index*2*Math.PI/5;
    const point = {x:Math.round(center.x+9*Math.cos(angle)),y:Math.round(center.y+9*Math.sin(angle))};
    const target = canStand(point.x,point.y) && canReachObject({...player,...point},center) ? point : center;
    if (Math.hypot(player.x-target.x,player.y-target.y)<3) this.stop(bot);
    else this.go(bot,target,now);
  }

  private explore(bot:Bot,match:PlenaryMatch,gameplay:Gameplay,world:GameplayWorld,view:PlenaryView,visible:Player[]) {
    const {player} = bot.control;
    const {now} = world;
    const game = gameplay.view(player,world);
    if (game.officeChannel?.kind==='office-cash') {
      this.stop(bot);
      return;
    }
    const act = (action:GameplayAction)=> {
      if (canUseGameplayAction(action,true)) gameplay.act(player,action,world);
    };
    const infiltrator = view.role==='Infiltrado';
    const witness = visible.find(peer=>!peer.npc && canReachStation(peer,'panel'));
    if (view.project!==undefined && witness && view.audit!=='fraud' && !view.reportedFraud) {
      bot.seenAtPanel = {name:witness.nick,at:now};
    }
    const request = game.requests.find(entry=>
      visible.some(peer=>peer.id===entry.from.id && canReachObject(player,peer)));
    if (request) {
      this.stop(bot);
      act({kind:'accept',item:request.id});
      return;
    }
    if (view.outage?.operating!==undefined) {
      this.stop(bot);
      return;
    }
    if (view.outage && !view.outage.paused && (!infiltrator || now-this.started<45_000)) {
      const preferred = (bot.index%2) as PowerPanel;
      const panel = ([preferred,(1-preferred) as PowerPanel]).find(index=>!view.outage!.occupied[index]);
      if (panel!==undefined) {
        if (canOperatePanel(player,panel)) {
          this.stop(bot);
          match.actOnPower(player,{kind:'repair',panel},now);
        } else this.go(bot,powerPanels[panel],now);
        return;
      }
    }
    if (!view.mandate || view.politics?.suspended) {
      this.stop(bot);
      return;
    }
    if (view.project!==undefined && !view.projectVoteExpired &&
        this.workOnBill(bot,match,view,visible,now)) return;
    const document = game.inventory.find(item=>item.document?.project!==undefined);
    if (document && view.outcomes.some(outcome=>outcome.project===document.document?.project)) {
      act({kind:'destroy',item:document.id});
      return;
    }
    const filingDelay = view.outcomes.length ? subsequentFilingDelayMs : firstFilingDelayMs;
    const filingElapsed = this.filingSince===undefined ? -Infinity : now-this.filingSince-filingDelay;
    if (filingElapsed>=0) {
      const first = (view.round+this.bots.size-1+Math.floor(filingElapsed/32_000))%this.bots.size;
      const filingOrder = (bot.index-first+this.bots.size)%this.bots.size;
      if (filingOrder===0) {
        this.file(bot,view,game,visible,now,act);
        return;
      }
      if (filingOrder<=2 && filingElapsed>=5_000) {
        this.meetAtSecretary(bot,now);
        return;
      }
    }
    bot.agenda.tick(player,view,game,gameplay,world,point=>this.go(bot,point,now),()=>this.stop(bot),act,
      ()=>match.roomActivity(player,'library',now,world.publish));
  }

  private workOnBill(bot:Bot,match:PlenaryMatch,view:PlenaryView,visible:Player[],now:number) {
    const {player} = bot.control;
    const infiltrator = view.role==='Infiltrado';
    const elapsed = projectRules.debateMs/1000-view.remaining;
    const desired = this.votePreference(bot,view).vote;
    if (infiltrator && view.canFraud && view.yes.budget<0 && (desired==='yes' || view.yes.budget<=-view.budget) && elapsed>=8 && elapsed<65) {
      if (canReachStation(player,'panel')) {
        this.stop(bot);
        if (!visible.some(peer=>canReachObject(player,peer,{radius:48}))) match.act(player,'fraud',now);
      } else this.go(bot,stations.panel,now);
      return true;
    }
    if (infiltrator && !bot.cutPower && view.canSabotagePower && elapsed>=22 && elapsed<85) {
      if (canOperatePanel(player,0)) {
        this.stop(bot);
        if (!visible.some(peer=>canReachObject(player,peer,{radius:48})) &&
            match.actOnPower(player,{kind:'sabotage',panel:0},now)) bot.cutPower = true;
      } else this.go(bot,powerPanels[0],now);
      return true;
    }
    if (view.audit==='fraud' && !view.reportedFraud && !infiltrator) {
      if (canReachStation(player,'panel')) {
        this.stop(bot);
        match.act(player,'panel',now);
      } else this.go(bot,stations.panel,now);
      return true;
    }
    if (view.audit===undefined && !view.reportedFraud && elapsed>=32+bot.index*7 && view.remaining>7) {
      if (canReachStation(player,'audit')) {
        this.stop(bot);
        const result = match.act(player,'audit',now);
        if (result?.critical) {
          bot.foundFraud = true;
          const seen = bot.seenAtPanel;
          if (seen && now-seen.at<35_000) bot.suspicion = seen.name;
        }
      } else this.go(bot,stations.audit,now);
      return true;
    }
    return false;
  }

  private file(bot:Bot,view:PlenaryView,game:GameplayView,visible:Player[],now:number,act:(action:GameplayAction)=>void) {
    const {player} = bot.control;
    const document = game.inventory.find(item=>item.document?.project!==undefined);
    if (!document?.document) {
      if (!game.locations.includes('secretary')) {
        this.go(bot,stations.secretary,now);
        return;
      }
      this.stop(bot);
      const used = new Set(view.outcomes.map(outcome=>outcome.project));
      const choices = bills.flatMap((bill,index)=>used.has(index) ? [] : [{bill,index}]);
      const project = choices.sort((a,b)=>
        Math.max(impactScore(b.bill.yes,view.budget),impactScore(b.bill.no,view.budget))-
        Math.max(impactScore(a.bill.yes,view.budget),impactScore(a.bill.no,view.budget)))[0]?.index;
      if (project!==undefined) act({kind:'supply',place:'secretary',target:`project-${project}`});
      return;
    }
    const {signatures,requiredSignatures} = document.document;
    if (signatures.length>=requiredSignatures) {
      if (!game.locations.includes('protocol')) {
        this.go(bot,terminals.protocol.point,now);
        return;
      }
      this.stop(bot);
      if (game.dialogue?.npc==='protocol') act({kind:'dialogue-choice',target:`file-${document.id}`,token:game.dialogue.token});
      else act({kind:'talk',target:'protocol'});
      return;
    }
    const last = bot.lastSignRequest;
    if (last && now-last.at<2_000 && !signatures.some(person=>person.id===last.id)) return;
    const candidates = visible.filter(other=>!other.npc && !other.knockedOut &&
      !signatures.some(person=>person.id===other.id) && !(last?.id===other.id && now-last.at<8_000));
    const peer = candidates.find(other=>canReachObject(player,other));
    if (peer) {
      this.stop(bot);
      bot.lastSignRequest = {id:peer.id,at:now};
      act({kind:'sign-request',target:peer.id,item:document.id});
    } else if (candidates.length) {
      if (now>=bot.retryRouteAt || !bot.control.route.length) this.go(bot,candidates[0],now);
    } else this.meetAtSecretary(bot,now);
  }

  private votePreference(bot:Bot,view:PlenaryView):{vote:Vote;reason:string} {
    const {budget,yes,no,stability,politics} = view;
    const yesStability = stability+yes.stability;
    const noStability = stability+no.stability;
    const difference = impactScore(yes,budget)-impactScore(no,budget);
    const threshold = stabilityRules.target;
    const decisive = (yesStability>=threshold)!==(noStability>=threshold) || (yesStability<=0)!==(noStability<=0);
    const infiltrator = view.role==='Infiltrado';
    if (decisive || Math.abs(difference)>safeDifference) {
      const safer = decisive ? yesStability>noStability : difference>0;
      const approve = safer!==infiltrator;
      const choice = approve ? yes : no;
      const other = approve ? no : yes;
      const reason = !infiltrator ? 'Os números que tenho favorecem essa opção para o Congresso.' :
        choice.budget>other.budget ? 'Quero preservar o orçamento.' :
        choice.stability>other.stability ? 'O efeito previsto na estabilidade pesa para mim.' :
        'O custo previsto não justifica mudar minha posição.';
      return {vote:approve?'yes':'no',reason};
    }
    const proposer = politics?.directory.find(person=>person.name===view.proposer);
    const diversion = [...(politics?.evidence ?? []),...(politics?.ledger ?? [])]
      .find(proof=>proof.kind==='diversion' && proof.from===proposer?.id && proof.from!==bot.control.player.id);
    if (diversion) return {vote:'no',reason:'O dossiê comprova um desvio de verba de quem protocolou. Isso pesou no meu voto.'};
    const mission = politics?.missions.active.find(mission=>mission.kind==='projetos' || mission.kind==='oposicao');
    const approve = mission ? mission.kind==='projetos' : difference===0 ? bot.index%2===0 : difference>0;
    return {vote:approve?'yes':'no',reason:'As opções têm consequências parecidas. Já tenho uma preferência.'};
  }

  private say(bot:Bot,text:string) {
    const name = bot.control.player.nick;
    this.messages = [...this.messages.filter(message=>message.name!==name),{name,text}];
  }

  private vote(bot:Bot,match:PlenaryMatch,view:PlenaryView,players:Player[],now:number,realNow:number) {
    if (!view.mandate || view.politics?.suspended) return;
    const {player} = bot.control;
    if (view.remaining>27-bot.index*2) return;
    const politics = view.politics;
    if (politics?.paymentsLeft && !bot.boughtEvidence) {
      const offer = politics.incoming.find(entry=>entry.price<=Math.min(2,politics.wallet) &&
        politics.contacts.some(contact=>contact.id===entry.from));
      if (offer) {
        match.politics(player,{kind:'accept',offer:offer.id},players,now);
        bot.boughtEvidence = true;
        return;
      }
    }
    const decision = this.votePreference(bot,view);
    if (view.vote===decision.vote && bot.voteReason===decision.reason) return;
    if (view.vote!==decision.vote) match.vote(player.id,decision.vote,realNow);
    bot.voteReason = decision.reason;
    const choice = decision.vote==='yes' ? 'a favor' : 'contra';
    const intro = view.vote===decision.vote ? `Mantenho meu voto ${choice}.` :
      view.vote ? `Mudei meu voto. Agora voto ${choice}.` : `Voto ${choice}.`;
    const proof = bot.foundFraud ? ' A auditoria encontrou fraude no painel.' : '';
    const suspicion = proof && bot.suspicion ? ` Vi ${bot.suspicion} perto do painel. É só um indício.` : '';
    this.say(bot,`${intro} ${decision.reason}${proof}${suspicion}`);
  }
}
