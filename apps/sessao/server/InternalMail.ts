import { internalMailRules, type InternalNotice, type MailAttachment, type ForensicReport } from '../src/internal-mail';
import type { Player } from '../src/map';
import type { GameplayWorld } from './gameplay-world';

export class InternalMail {
  private readonly cooldowns = new Map<string,number>();
  private notices:InternalNotice[] = [];
  private authenticity = new Map<number,boolean>();
  private reports = new Map<string,ForensicReport[]>();

  reportsFor(id:string) { return this.reports.get(id) ?? []; }

  examine(id:string,noticeId:unknown,consume:()=>boolean) {
    const notice = this.notices.find(entry=>entry.id===noticeId);
    if (notice?.attachment?.kind!=='document') return 'Documento publicado indisponível.';
    const reports = this.reportsFor(id);
    if (reports.some(report=>report.notice===notice.id)) return 'Você já analisou este comunicado.';
    if (!consume()) return 'Compre um Kit de Perícia no Apoio Técnico.';
    const authentic = this.authenticity.get(notice.id);
    this.reports.set(id,[{notice:notice.id,document:notice.attachment.document,authentic:authentic===true},...reports].slice(0,24));
  }

  private sequence = 0;

  reset() {
    this.notices = [];
    this.cooldowns.clear();
    this.authenticity.clear();
    this.reports.clear();
  }

  view() { return this.notices; }

  publish(player:Player, raw:unknown, world:GameplayWorld,resolve?:(ref:unknown)=>{attachment:MailAttachment;authentic?:boolean}|undefined) {
    if ((this.cooldowns.get(player.id) ?? 0)>world.now) return 'Aguarde para publicar outro comunicado.';
    if (!raw || typeof raw!=='object' || !('subject' in raw) || !('body' in raw) ||
      typeof raw.subject!=='string' || typeof raw.body!=='string') return 'Preencha o assunto e a mensagem.';
    const subject = raw.subject.trim();
    const body = raw.body.trim();
    if (!subject || !body || subject.length>internalMailRules.subjectLength || body.length>internalMailRules.bodyLength) {
      return 'Confira o tamanho do assunto e da mensagem.';
    }
    const forward = 'forwardedFrom' in raw ? raw.forwardedFrom : undefined;
    const source = forward===undefined ? undefined : this.notices.find(notice=>notice.id===forward);
    if (forward!==undefined && !source) return 'Comunicado original indisponível.';
    const reference = 'attachment' in raw ? raw.attachment : undefined;
    if (source && reference!==undefined) return 'O encaminhamento preserva o anexo original.';
    const resolved = source ? source.attachment && {attachment:source.attachment,authentic:this.authenticity.get(source.id)} :
      reference===undefined ? undefined : resolve?.(reference);
    if (reference!==undefined && !resolved) return 'Anexo indisponível.';
    if (!world.spend?.(player.id,internalMailRules.fee)) return 'Saldo insuficiente para publicar.';
    this.cooldowns.set(player.id,world.now+internalMailRules.cooldownMs);
    const id = ++this.sequence;
    if (resolved?.authentic!==undefined) this.authenticity.set(id,resolved.authentic);
    const expired = this.notices[internalMailRules.history-1];
    if (expired) this.authenticity.delete(expired.id);
    this.notices = [{id,author:player.nick,subject,body,forwardedFrom:source?.id,attachment:resolved && structuredClone(resolved.attachment)},
      ...this.notices].slice(0,internalMailRules.history);
  }
}
