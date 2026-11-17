import {useState} from 'react';
import {useDialogKeys} from './use-dialog-keys';
import type {ShortcutEntry} from '../action-shortcuts';
import {infractionLabels,type ComplaintView} from '../complaints';
import { useLayoutEffect, useRef } from 'react';
import type { Photo } from '../photography';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { internalMailRules, type InternalNotice, type AttachmentRef, type ForensicReport, type MailAttachment } from '../internal-mail';
import { money } from '../politics';

export type AttachmentChoice = AttachmentRef & {label:string};

type Draft = {subject:string;body:string;attachment?:AttachmentRef;forwardedFrom?:number};

function MailComposer({choices,source,pending,error,fee,publish,back,close}:{choices:readonly AttachmentChoice[];
  source?:InternalNotice;pending:boolean;error:string|null;fee:number;publish:(draft:Draft)=>void;back:()=>void;close:()=>void;
}) {
  const [open,setOpen] = useState(false);
  const [query,setQuery] = useState('');
  const [selection,setSelection] = useState<AttachmentRef>();
  const subject = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const selected = choices.find(choice=>choice.kind===selection?.kind && choice.id===selection?.id);
  const visible = open ? choices.filter(choice=>choice.label.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))) : [];
  const toggle = ()=>setOpen(!open);
  const pick = (choice?:AttachmentChoice)=>{
    setSelection(choice && {kind:choice.kind,id:choice.id});
    setOpen(false);
  };
  const submit = ()=>form.current?.requestSubmit();
  const entries:ShortcutEntry[] = [{name:'Fechar aplicativo',activate:close}];
  if (!pending) entries.push({name:'Voltar ao Correio',activate:back},{name:'Publicar · '+money(fee),activate:submit});
  entries.push({name:'Assunto',activate:()=>subject.current?.focus()},{name:'Mensagem',activate:()=>body.current?.focus()});
  if (!source) {
    entries.push({name:selected?.label ?? 'Selecionar anexo',activate:toggle});
    if (open) {
      entries.push({name:'Buscar anexo',activate:()=>search.current?.focus()},{name:'Sem anexo',activate:()=>pick()});
      entries.push(...visible.map(choice=>({name:choice.label,activate:()=>pick(choice)})));
    }
  }
  const form = useDialogKeys<HTMLFormElement>(key=>key==='1' && !pending ? submit : undefined,entries);
  return <form ref={form} className="grid gap-3" onSubmit={event=>{
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    publish({subject:String(data.get('subject')),body:String(data.get('body')),
      attachment:selected && {kind:selected.kind,id:selected.id},forwardedFrom:source?.id});
  }}>
    <label>Assunto<input ref={subject} name="subject" defaultValue={source ? ('Enc: '+source.subject).slice(0,internalMailRules.subjectLength) : undefined} required maxLength={internalMailRules.subjectLength}/></label>
    <label>Mensagem<textarea ref={body} name="body" required rows={4} maxLength={internalMailRules.bodyLength}/></label>
    {source ? <p>Comunicado original #{source.id} · {source.subject}</p> : <div className="mail-attachments">
      <button type="button" className="hud-button" aria-expanded={open} onClick={toggle}>{selected?.label ?? 'Selecionar anexo'}</button>
      {open && <section className="mail-entry" aria-label="Inventário de anexos">
        <input ref={search} aria-label="Buscar anexo" placeholder="Buscar pelo nome" value={query} onChange={event=>setQuery(event.target.value)}/>
        <div className="mail-attachment-grid">
          {visible.map(choice=><button type="button" className="hud-button hud-button--secondary" key={choice.kind+'-'+choice.id} onClick={()=>pick(choice)}>
            <svg className="hud-glyph" aria-hidden="true"><use href={choice.kind==='photo' ? '#icon-app-photos' : '#icon-document'}/></svg>{choice.label}
          </button>)}
        </div>
        <button type="button" className="hud-button hud-button--secondary" onClick={()=>pick()}>Sem anexo</button>
      </section>}
    </div>}
    <p role="status">{error}</p>
    <button className="hud-button" disabled={pending} aria-keyshortcuts="1">Publicar · {money(fee)} <kbd className="action-key" aria-hidden="true">1</kbd></button>
    <button type="button" className="hud-button hud-button--secondary" disabled={pending} onClick={back}>Voltar ao Correio</button>
  </form>;
}

function MailPhoto({photo,draw}:{photo:Photo;draw:(canvas:HTMLCanvasElement,photo:Photo)=>void}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(()=>{ if (canvas.current) draw(canvas.current,photo); },[draw,photo]);
  return <figure><canvas ref={canvas} style={{width:'100%',height:'auto'}}/><figcaption>Fotografia #{photo.id}</figcaption></figure>;
}

export function Attachment({attachment,draw}:{attachment:MailAttachment;draw:(canvas:HTMLCanvasElement,photo:Photo)=>void}) {
  if (attachment.kind==='photo') return <MailPhoto photo={attachment.photo} draw={draw}/>;
  const report = attachment.kind==='report' ? attachment.report : undefined;
  const document = attachment.kind==='document' ? attachment.document : attachment.report.document;
  return <section className="mail-entry">
    {report && <strong style={{color:report.authentic ? 'var(--color-hud-stability)' : 'var(--color-hud-danger)'}}>
      {report.authentic ? 'VERDADEIRO' : 'FALSO'} · Comunicado #{report.notice}
    </strong>}
    <h4>#{document.id} · {document.title}</h4><p>{document.description}</p>
    <p>Assinaturas: {document.signatures.join(', ') || 'nenhuma'}</p>
  </section>;
}

export function ForwardedNotice({notice}:{notice:InternalNotice}) {
  return notice.forwardedFrom===undefined ? null : <small>Encaminhado do comunicado #{notice.forwardedFrom}</small>;
}

export function ComplaintDesk({view,submit}:{view:ComplaintView;submit?:(id:number,photo?:number)=>void}) {
  if (!view.history.length && !submit) return null;
  return <section className="grid gap-2">
    <h3>Corregedoria</h3>
    {submit && !view.available.length && <p>Nenhuma infração que você presenciou está disponível para denúncia.</p>}
    {submit && view.available.map(entry=><form className="mail-entry" key={entry.id} onSubmit={event=>{
      event.preventDefault();
      const photo = Number(new FormData(event.currentTarget).get('photo'));
      submit(entry.id,photo || undefined);
    }}>
      <h4>{infractionLabels[entry.kind]} · {entry.accused}</h4>
      {!!entry.photoIds?.length && <label>Foto complementar <select name="photo">
        <option value="">Sem foto</option>
        {entry.photoIds.map(id=><option value={id} key={id}>Fotografia #{id}</option>)}
      </select></label>}
      <button type="submit" className="hud-button">Denunciar</button>
    </form>)}
    {!!view.history.length && <ul aria-label="Boletim oficial">
      {view.history.map(entry=><li key={entry.id}>{infractionLabels[entry.kind]} confirmada · {entry.accused}{entry.hasPhoto && ' · Com foto'}</li>)}
    </ul>}
  </section>;
}

export function mountInternalMail(publish:(message:Draft)=>void,
  notify:(title:string,text:string)=>void,examine:(id:number)=>void,draw:(canvas:HTMLCanvasElement,photo:Photo)=>void,submit:(id:number,photo?:number)=>void,close:()=>void) {
  const host = document.querySelector<HTMLElement>('#phone-mail')!;
  const root = createRoot(host);
  let choices:readonly AttachmentChoice[] = [];
  let reports:readonly ForensicReport[] = [];
  let notices:readonly InternalNotice[] = [];
  let composing = false;
  let exploring = false;
  let fee:number = internalMailRules.fee;
  let complaints:ComplaintView = {available:[],history:[]};
  let source:InternalNotice|undefined;
  let pending = false;
  let error:string|null = null;
  let reviewing:number|undefined;
  const visible = ()=>!host.hidden && !!host.closest('dialog[open]');

  function render() {
    const attachments = [...choices,...reports.map(report=>({kind:'report' as const,id:report.notice,label:'Laudo · '+report.document.title}))];
    root.render(<>
      {composing && <h3>Publicar comunicado</h3>}
      {composing ? <MailComposer choices={attachments} source={source} pending={pending} error={error} fee={fee} close={close}
        publish={draft=>{
          if (pending) return;
          pending = true;
          error = null;
          publish(draft);
          render();
        }}
        back={()=>{
          composing = false;
          source = undefined;
          render();
        }}/> : <div className="grid gap-3">
        <button type="button" className="hud-button" disabled={!exploring} onClick={()=>{
          composing = true;
          source = undefined;
          error = null;
          render();
        }}>Novo comunicado</button>
        <ComplaintDesk view={complaints} submit={exploring && complaints.atDesk ? submit : undefined}/>
        {reports.map(report=><article className="mail-entry" key={'report-'+report.notice}>
          <h3>Perícia concluída</h3><Attachment draw={draw} attachment={{kind:'report',report}}/>
        </article>)}
        {notices.length===0 && <p>Nenhum comunicado publicado.</p>}
        {notices.map(notice=><article className="mail-entry" key={notice.id}>
          <h3>{notice.subject}</h3><small>{notice.author}</small><p>{notice.body}</p>
          <ForwardedNotice notice={notice}/>
          <button type="button" className="hud-button hud-button--secondary" disabled={!exploring} onClick={()=>{source=notice;composing=true;error=null;render();}}>Encaminhar</button>
          {notice.attachment && <Attachment draw={draw} attachment={notice.attachment}/>}
          {notice.attachment?.kind==='document' && <button type="button" className="hud-button"
            disabled={reports.some(report=>report.notice===notice.id)} onClick={()=>{reviewing=notice.id;render();}}>Realizar perícia</button>}
          {reviewing===notice.id && <div className="flex gap-2">
            <button type="button" className="hud-button" onClick={()=>{ reviewing=undefined;examine(notice.id);render(); }}>Consumir kit</button>
            <button type="button" className="hud-button hud-button--secondary" onClick={()=>{reviewing=undefined;render();}}>Cancelar</button>
          </div>}
        </article>)}
      </div>}
    </>);
  }

  return {
    price(next:number) {
      if (fee===next) return;
      fee = next;
      if (composing) render();
    },
    open(attachments:readonly AttachmentChoice[]) {
      composing = false;
      source = undefined;
      choices = attachments;
      pending = false;
      reviewing = undefined;
      error = null;
      flushSync(render);
    },
    complaints(next?:ComplaintView) {
      const updated = next ?? {available:[],history:[]};
      if (JSON.stringify(updated)===JSON.stringify(complaints)) return;
      const latest = updated.history[0];
      if (latest && complaints.history[0]?.id!==latest.id) {
        notify('Boletim da Corregedoria',`${infractionLabels[latest.kind]} confirmada · ${latest.accused}`);
      }
      complaints = updated;
      if (visible() && !composing) render();
    },
    receive(next:readonly InternalNotice[]) {
      if (next[0] && next[0].id!==notices[0]?.id) notify('Correio Interno',next[0].subject);
      notices = next;
      if (visible() && !composing) render();
    },
    reports(next:readonly ForensicReport[]) {
      if (next[0] && next[0].notice!==reports[0]?.notice) notify('Perícia concluída',next[0].document.title);
      reports = next;
      if (visible()) render();
    },
    result(message:string|null) {
      if (!composing) return;
      pending = false;
      error = message;
      if (!message) composing = false;
      render();
    },
    phase(next:boolean) {
      if (exploring===next) return;
      exploring = next;
      if (!exploring) {
        composing = false;
        pending = false;
        source = undefined;
      }
      if (visible()) render();
    },
    destroy() { root.unmount(); },
  };
}
