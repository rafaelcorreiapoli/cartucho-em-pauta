import { canReachObject } from '../src/gameplay';
import { internalMailRules, type InternalNotice } from '../src/internal-mail';
import type { Player } from '../src/map';
import { stations } from '../src/plenary';
import type { GameplayWorld } from './gameplay-world';

export class InternalMail {
  private readonly cooldowns = new Map<string,number>();
  private notices:InternalNotice[] = [];
  private sequence = 0;

  reset() {
    this.notices = [];
    this.cooldowns.clear();
  }

  view() { return this.notices; }

  publish(player:Player, raw:unknown, world:GameplayWorld) {
    if (!canReachObject(player,stations.audit,{handsFree:true})) return 'Aproxime-se do balcão da Corregedoria.';
    if ((this.cooldowns.get(player.id) ?? 0)>world.now) return 'Aguarde para publicar outro comunicado.';
    if (!raw || typeof raw!=='object' || !('subject' in raw) || !('body' in raw) ||
      typeof raw.subject!=='string' || typeof raw.body!=='string') return 'Preencha o assunto e a mensagem.';
    const subject = raw.subject.trim();
    const body = raw.body.trim();
    if (!subject || !body || subject.length>internalMailRules.subjectLength || body.length>internalMailRules.bodyLength) {
      return 'Confira o tamanho do assunto e da mensagem.';
    }
    if (!world.spend?.(player.id,internalMailRules.fee)) return 'Saldo insuficiente para publicar.';
    this.cooldowns.set(player.id,world.now+internalMailRules.cooldownMs);
    this.notices = [{id:++this.sequence,author:player.nick,subject,body},...this.notices].slice(0,internalMailRules.history);
  }
}
