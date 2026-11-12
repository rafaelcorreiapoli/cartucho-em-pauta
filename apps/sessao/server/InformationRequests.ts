import { canReachObject } from '../src/gameplay';
import type { Player } from '../src/map';
import type { Contact } from '../src/politics';

type Mode = 'show'|'copy';
type Entry<Ref> = {id:number; info:Ref; from:Contact; mode:Mode; to:string; expires:number};

export class InformationRequests<Ref> {
  private pending = new Map<number,Entry<Ref>>();
  private serial = 0;

  constructor(private changed:()=>void) {}

  clear() { this.pending.clear(); }

  removeWhere(test:(entry:Entry<Ref>)=>boolean) {
    for (const [id,entry] of this.pending) {
      if (test(entry)) {
        this.pending.delete(id);
        this.changed();
      }
    }
  }

  incoming(player:string,now:number) {
    const entry = [...this.pending.values()].find(entry=>entry.to===player && entry.expires>now);
    return entry && {id:entry.id,info:entry.info,from:entry.from,mode:entry.mode};
  }

  send(from:Player,to:Player,info:Ref,mode:Mode,now:number) {
    if (!canReachObject(from,to)) return 'Aproxime-se do destinatário.';
    if ([...this.pending.values()].some(entry=>entry.from.id===from.id && entry.to===to.id && entry.expires>now)) {
      return 'Aguarde a resposta do jogador.';
    }
    const id = ++this.serial;
    this.pending.set(id,{id,info,from:{id:from.id,name:from.nick},to:to.id,mode,expires:now+25_000});
    this.changed();
    return 'Pedido enviado.';
  }

  respond(id:number,player:Player,players:Player[],now:number,accept:boolean) {
    const entry = this.pending.get(id);
    if (!entry || entry.to!==player.id || entry.expires<=now) return 'Pedido indisponível.';
    this.pending.delete(id);
    this.changed();
    if (!accept) return 'Pedido recusado.';
    const sender = players.find(person=>person.id===entry.from.id);
    if (!sender || !canReachObject(sender,player)) return 'A apresentação saiu de alcance.';
    return {entry,sender};
  }
}
