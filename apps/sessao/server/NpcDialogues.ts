import { canReachObject } from '../src/gameplay';
import type { Player } from '../src/map';
import { dialogues, npcs, type DialogueNode, type DialogueOption, type DialogueView, type NpcId } from '../src/npcs';

type Session = {npc:NpcId; node:string; shop:boolean; token:number};

export class NpcDialogues {
  private sessions = new Map<string,Session>();
  private serial = 0;

  reset() { this.sessions.clear(); }
  close(id:string) { this.sessions.delete(id); }

  private node(session:Session):DialogueNode {
    return dialogues[npcs[session.npc].dialogue][session.node];
  }

  private options(session:Session, wallet:number):readonly DialogueOption[] {
    return this.node(session).options.filter(option => (option.requires?.wallet ?? 0)<=wallet);
  }

  private nearby(player:Player, key:NpcId) { return canReachObject(player,npcs[key]); }

  nearbyNpcs(player:Player) {
    return (Object.keys(npcs) as NpcId[]).filter(key=>this.nearby(player,key));
  }

  open(player:Player, target?:string) {
    if (!target || !Object.hasOwn(npcs,target) || !this.nearby(player,target as NpcId)) return 'Aproxime-se para conversar.';
    this.sessions.set(player.id,{npc:target as NpcId,node:'start',shop:false,token:++this.serial});
  }

  private active(player:Player) {
    const session = this.sessions.get(player.id);
    if (session && this.nearby(player,session.npc)) return session;
    this.close(player.id);
  }

  choose(player:Player, choice:string|undefined, token:number|undefined, wallet:number) {
    const session = this.active(player);
    if (!session || token!==session.token) return 'Esta conversa já mudou.';
    const option = this.options(session,wallet).find(entry=>entry.id===choice);
    if (!option) return 'Opção indisponível.';
    if (option.action==='close') {
      this.close(player.id);
      return;
    }
    if (option.next) session.node = option.next;
    session.shop = option.action==='shop';
    session.token = ++this.serial;
  }

  purchase(player:Player, token:number|undefined, buy:()=>string|undefined) {
    const session = this.active(player);
    if (!session?.shop || token!==session.token) return 'Abra o catálogo do vendedor.';
    const result = buy();
    if (!result) session.token = ++this.serial;
    return result;
  }

  view(player:Player,wallet:number):DialogueView|undefined {
    const session = this.active(player);
    if (!session) return;
    return {npc:session.npc,shop:session.shop,token:session.token,text:this.node(session).text,
      options:this.options(session,wallet).map(({id,label})=>({id,label}))};
  }
}
