import {bills} from '../src/plenary';
import { canReachObject } from '../src/gameplay';
import type { Player } from '../src/map';
import { npcRules } from '../src/parliamentarians';
import { publishGameplay, type GameplayWorld } from './gameplay-world';
import type { Gameplay } from './Gameplay';
import type { Parliamentarians } from './Parliamentarians';
import type { PlenaryMatch } from './PlenaryMatch';

export class ParliamentarianTalk {
  private sessions = new Map<string,{id:number;target:string;until:number}>();
  private sequence = 0;
  private robberies = new Map<string,{target:string;until:number;x:number;y:number}>();

  constructor(private members:Parliamentarians,private gameplay:Gameplay,private match:PlenaryMatch) {}

  reset() { this.sessions.clear(); this.robberies.clear(); }
  leave(id:string) { this.sessions.delete(id); this.robberies.delete(id); }
  private target(id:string) { return this.members.players.find(player=>player.id===id); }

  nearby(player:Player) {
    return this.members.players.filter(npc=>canReachObject(player,npc,{radius:npcRules.robberyRange,handsFree:true,clearFloor:true}))
      .map(npc=>({id:npc.id,name:npc.nick,down:!!npc.knockedOut}));
  }

  private available(player:Player,npc:Player|undefined,down:boolean) {
    return npc && !!npc.knockedOut===down && this.nearby(player).some(entry=>entry.id===npc.id);
  }

  view(player:Player,world:GameplayWorld) {
    const session = this.sessions.get(player.id);
    const npc = session && this.target(session.target);
    if (!session || !npc || session.until<=world.now || !this.available(player,npc,false)) return;
    const projectIndex = this.match.negotiableProject(world.now);
    const minimum = (vote:'yes'|'no') => projectIndex===undefined ? 0 : this.members.minimum(npc.id,this.match.projectRound,vote,projectIndex,player.id);
    return {session:session.id,id:npc.id,name:npc.nick,project:projectIndex===undefined ? undefined : bills[projectIndex].name,projectIndex,wallet:world.wallet?.(player.id) ?? 0,
      paymentsLeft:world.paymentsLeft?.(player.id) ?? 0,
      expiresIn:Math.ceil((session.until-world.now)/1000),
      documents:this.gameplay.signableDocuments(player,npc,world).map(doc=>({...doc,price:this.members.signature(npc.id,player.id)})),
      minimum:{yes:minimum('yes'),no:minimum('no')}};
  }

  act(player:Player,raw:unknown,world:GameplayWorld) {
    if (!raw || typeof raw!=='object' || !('kind' in raw)) return;
    if (raw.kind==='close') {
      if ('session' in raw && raw.session===this.sessions.get(player.id)?.id) this.sessions.delete(player.id);
      return;
    }
    if (raw.kind==='cancel-robbery') {
      if (this.robberies.delete(player.id)) return 'Roubo interrompido.';
      return;
    }
    if (this.robberies.has(player.id)) return 'Roubo em andamento.';
    const target = 'target' in raw && typeof raw.target==='string' ? this.target(raw.target) : undefined;
    if (!target) return 'Parlamentar indisponível.';
    if (raw.kind==='rob') {
      if (!this.available(player,target,true)) return 'Aproxime-se do parlamentar nocauteado.';
      this.sessions.delete(player.id);
      this.robberies.set(player.id,{target:target.id,until:world.now+npcRules.robberyMs,x:player.x,y:player.y});
      return;
    }
    if (!this.available(player,target,false)) return 'Parlamentar fora de alcance.';
    if (raw.kind==='talk') {
      this.sessions.set(player.id,{id:++this.sequence,target:target.id,until:world.now+npcRules.dialogueMs});
      return;
    }
    const deal = this.view(player,world);
    if (deal?.id!==target.id) return 'Abra a negociação.';
    if (!('session' in raw) || raw.session!==deal.session) return 'A negociação mudou.';
    if (raw.kind==='sign' && 'item' in raw && typeof raw.item==='number' && 'amount' in raw) {
      const document = deal.documents.find(doc=>doc.id===raw.item);
      if (!document || document.price!==raw.amount) return 'A proposta de assinatura mudou.';
      const result = this.gameplay.signWithNpc(player,target,document.id,document.price,world);
      if (result==='Assinatura obtida.') this.members.rememberAgreement(target.id,player.id);
      return result;
    }
    if (raw.kind==='vote' && deal.projectIndex!==undefined && 'vote' in raw && (raw.vote==='yes' || raw.vote==='no') &&
        'amount' in raw && typeof raw.amount==='number' && Number.isSafeInteger(raw.amount) && raw.amount>=0 &&
        'round' in raw && raw.round===this.match.projectRound && 'project' in raw && raw.project===deal.projectIndex) {
      const minimum = deal.minimum[raw.vote];
      if (raw.amount<minimum) return 'Oferta recusada. O preço mudou.';
      if (minimum===0 && raw.amount>0) return 'Já aceita esse voto sem pagamento.';
      if (raw.amount && !world.payNpc?.(player.id,target.id,raw.amount)) return 'Pagamento indisponível.';
      this.members.commit(target.id,this.match.projectRound,raw.vote,raw.amount,deal.projectIndex,player.id);
      if (raw.amount) publishGameplay(world,player,'npc-vote-bought',{target:target.id,project:deal.projectIndex,amount:raw.amount});
      console.info(JSON.stringify({event:'npc-vote-deal',from:player.id,to:target.id,amount:raw.amount,round:raw.round}));
      return 'Voto comprometido.';
    }
  }

  tick(world:GameplayWorld,exploring:boolean) {
    if (!exploring) { this.reset(); return new Set<string>(); }
    const paused = new Set<string>();
    for (const [id,session] of this.sessions) {
      const actor = world.players.find(player=>player.id===id);
      if (session.until<=world.now || !actor || !this.available(actor,this.target(session.target),false)) this.sessions.delete(id);
      else paused.add(session.target);
    }
    for (const [id,robbery] of this.robberies) {
      const player = world.players.find(actor=>actor.id===id);
      const target = this.target(robbery.target);
      if (!player || !target || player.x!==robbery.x || player.y!==robbery.y || !this.available(player,target,true)) {
        this.robberies.delete(id);
        world.feedback?.(id,'Roubo interrompido.');
      } else if (world.now>=robbery.until) {
        this.robberies.delete(id);
        const result = this.gameplay.robNpc(player,target,world);
        world.feedback?.(id,result);
      }
    }
    return paused;
  }

  robberyProgress(id:string,now:number) {
    const robbery = this.robberies.get(id);
    return robbery ? Math.max(0,npcRules.robberyMs-(robbery.until-now)) : undefined;
  }
}
