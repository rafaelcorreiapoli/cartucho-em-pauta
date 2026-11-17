import type { MissionSwapResult } from './PersonalAgenda';
import { canReachObject } from '../src/gameplay';
import type { Player } from '../src/map';
import { dialogues, npcs, type DialogueCondition, type DialogueNode, type DialogueOption, type DialogueView, type NpcId } from '../src/npcs';

type Eligibility = (condition:DialogueCondition)=>boolean;

type Session = {npc:NpcId; node:string; shop:boolean; direct?:boolean; token:number; feedback?:string};
type Document = {id:number; title:string};

export class NpcDialogues {
  private sessions = new Map<string,Session>();
  private serial = 0;

  reset() { this.sessions.clear(); }
  close(id:string) { this.sessions.delete(id); }

  private node(session:Session):DialogueNode {
    return dialogues[npcs[session.npc].dialogue][session.node];
  }

  private options(session:Session, eligible:Eligibility, documents:readonly Document[]):readonly DialogueOption[] {
    const options = this.node(session).options.filter(option => !option.requires || eligible(option.requires));
    if (session.npc!=='protocol') return options;
    return [...documents.map(({id,title})=>({id:`file-${id}`,label:`Protocolar · ${title}`,fileItem:id})),...options];
  }

  private nearby(player:Player, key:NpcId) {
    const npc = npcs[key];
    if ('interactionRadius' in npc) return canReachObject(player,npc,{radius:npc.interactionRadius});
    return canReachObject(player,'interaction' in npc ? npc.interaction : npc);
  }

  nearbyNpcs(player:Player) {
    return (Object.keys(npcs) as NpcId[]).filter(key=>this.nearby(player,key));
  }

  open(player:Player, target?:string, direct=false, missionSwapUsed=false) {
    if (!target || !Object.hasOwn(npcs,target) || !this.nearby(player,target as NpcId)) return 'Aproxime-se para conversar.';
    const npc = target as NpcId;
    if (direct && !npcs[npc].catalog) return 'Converse com o atendente.';
    const node = npc==='silvio' && missionSwapUsed ? 'used' : 'start';
    this.sessions.set(player.id,{npc,node,shop:direct,direct,token:++this.serial});
  }

  private active(player:Player) {
    const session = this.sessions.get(player.id);
    if (session && this.nearby(player,session.npc)) return session;
    this.close(player.id);
  }

  choose(player:Player, choice:string|undefined, token:number|undefined, eligible:Eligibility,
    documents:readonly Document[], effects:{file:(item:number)=>string;swapMissions:()=>MissionSwapResult}) {
    const session = this.active(player);
    if (!session || token!==session.token) return 'Esta conversa já mudou.';
    const option = this.options(session,eligible,documents).find(entry=>entry.id===choice);
    if (!option) return 'Opção indisponível.';
    if (option.fileItem!==undefined) {
      session.token = ++this.serial;
      session.feedback = effects.file(option.fileItem);
      return session.feedback;
    }
    if (option.action==='close') {
      this.close(player.id);
      return;
    }
    if (option.action==='swap-missions') session.node = effects.swapMissions();
    else if (option.next) session.node = option.next;
    session.shop = option.action==='shop';
    session.token = ++this.serial;
  }

  purchase(player:Player, token:number|undefined, buy:(npc:NpcId,direct:boolean)=>string|undefined) {
    const session = this.active(player);
    if (!session?.shop || token!==session.token) return 'Abra o catálogo do vendedor.';
    const result = buy(session.npc,!!session.direct);
    if (!result) session.token = ++this.serial;
    return result;
  }

  view(player:Player,eligible:Eligibility,documents:readonly Document[]):DialogueView|undefined {
    const session = this.active(player);
    if (!session) return;
    const text = session.npc==='protocol' && !documents.length && !session.feedback
      ? 'Você não tem documentos no inventário. Solicite um na Secretaria.'
      : this.node(session).text;
    return {npc:session.npc,shop:session.shop,direct:!!session.direct,token:session.token,text,feedback:session.feedback,
      options:this.options(session,eligible,documents).map(({id,label})=>({id,label}))};
  }
}
