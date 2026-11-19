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

export type {AttachmentChoice} from './mail-attachment-picker';
import {MailAttachmentPicker,type AttachmentChoice,type AttachmentCategory} from './mail-attachment-picker';
import {PhoneBack} from './phone-back';
import {HudIcon} from './hud-icon';

type Draft = {subject:string;body:string;attachment?:AttachmentRef;forwardedFrom?:number};

export function MailComposer({choices,source,pending,error,fee,publish,back,close,draw,photosEnabled=true,documentsEnabled=true}:{photosEnabled?:boolean;documentsEnabled?:boolean;choices:readonly AttachmentChoice[];
  source?:InternalNotice;pending:boolean;error:string|null;fee:number;publish:(draft:Draft)=>void;back:()=>void;close:()=>void;
  draw:(canvas:HTMLCanvasElement,photo:Photo)=>void;
}) {
  const [open,setOpen] = useState(false);
  const [category,setCategory] = useState<AttachmentCategory>();
  const [selection,setSelection] = useState<AttachmentRef>();
  const subject = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);
  const selected = choices.find(choice=>(choice.kind==='photo' ? photosEnabled : documentsEnabled) && choice.kind===selection?.kind && choice.id===selection?.id);
  const cancel = ()=>{setOpen(false);setCategory(undefined);};
  const toggle = ()=>{setCategory(undefined);setOpen(!open);};
  const pick = (choice:AttachmentChoice)=>{setSelection({kind:choice.kind,id:choice.id});cancel();};
  const submit = ()=>form.current?.requestSubmit();
  const goBack = open ? category ? ()=>setCategory(undefined) : cancel : back;
  const backLabel = open ? category ? 'Voltar às categorias' : 'Voltar ao comunicado' : 'Voltar ao Correio';
  const entries:ShortcutEntry[] = [{name:'Fechar aplicativo',activate:close}];
  if (!pending) entries.push({name:backLabel,activate:goBack});
  if (open) {
    entries.push({name:'Cancelar anexo',activate:cancel});
    if (!category) entries.push({name:'Documentos',activate:()=>setCategory('document')},{name:'Fotografias',activate:()=>setCategory('photo')});
  } else {
    if (!pending) entries.push({name:'Publicar · '+money(fee),activate:submit});
    entries.push({name:'Assunto',activate:()=>subject.current?.focus()},{name:'Mensagem',activate:()=>body.current?.focus()});
    if (!source) entries.push({name:selected?.label ?? 'Selecionar anexo',activate:toggle});
  }
  const form = useDialogKeys<HTMLFormElement>(key=>key==='1' && !pending && !open ? submit : undefined,open ? undefined : entries);
  return <>
    <PhoneBack label={backLabel} onBack={goBack} disabled={pending}/>
    <form ref={form} className="mail-composer" inert={open} onSubmit={event=>{
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      publish({subject:String(data.get('subject')),body:String(data.get('body')),
        attachment:selected && {kind:selected.kind,id:selected.id},forwardedFrom:source?.id});
    }}>
      <h3>Publicar comunicado</h3>
      <label>Assunto<input ref={subject} name="subject" defaultValue={source ? ('Enc: '+source.subject).slice(0,internalMailRules.subjectLength) : undefined} required maxLength={internalMailRules.subjectLength}/></label>
      <label><span>Mensagem <small>(opcional)</small></span><textarea ref={body} name="body" aria-label="Mensagem" rows={4} maxLength={internalMailRules.bodyLength}/></label>
      {source ? <p>Comunicado original #{source.id} · {source.subject}</p> : (photosEnabled || documentsEnabled) ? <div className="mail-selected-attachment">
        <button type="button" className="hud-button hud-button--secondary" aria-haspopup="dialog" onClick={toggle}>
          <HudIcon name={selected?.kind==='photo' ? 'app-photos' : 'document'}/>{selected?.label ?? 'Selecionar anexo'}
        </button>
        {selected && <button type="button" className="mail-cancel" onClick={()=>setSelection(undefined)}>Remover anexo</button>}
      </div> : null}
      {error && <p role="status">{error}</p>}
      <footer><button className="hud-button" disabled={pending} aria-keyshortcuts="1">Publicar · {money(fee)} <kbd className="action-key" aria-hidden="true">1</kbd></button></footer>
    </form>
    {open && <MailAttachmentPicker photosEnabled={photosEnabled} documentsEnabled={documentsEnabled} choices={choices} category={category} setCategory={setCategory} pick={pick} cancel={cancel} draw={draw}/>}
  </>;
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

export function ComplaintDesk({view,submit,attachForm}:{view:ComplaintView;submit?:(id:number,photo?:number)=>void;attachForm?:(id:number,form:HTMLFormElement|null)=>void}) {
  if (!view.history.length && !submit) return null;
  return <section className="grid gap-2">
    <h3>Corregedoria</h3>
    {submit && !view.available.length && <p>Nenhuma infração que você presenciou está disponível para denúncia.</p>}
    {submit && view.available.map(entry=><form className="mail-entry" key={entry.id} ref={form=>attachForm?.(entry.id,form)} onSubmit={event=>{
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

function MailInbox({notices,reports,complaints,exploring,compose,examine,draw,submit,close}:{
  notices:readonly InternalNotice[];reports:readonly ForensicReport[];complaints:ComplaintView;exploring:boolean;
  compose:(notice?:InternalNotice)=>void;examine:(id:number)=>void;draw:(canvas:HTMLCanvasElement,photo:Photo)=>void;
  submit?:(id:number,photo?:number)=>void;close:()=>void;
}) {
  const [reviewing,setReviewing] = useState<number>();
  const forms = useRef(new Map<number,HTMLFormElement>());
  const start = ()=>compose();
  const entries:ShortcutEntry[] = [{name:'Fechar aplicativo',activate:close}];
  if (exploring) entries.push({name:'Novo comunicado',activate:start});
  if (submit) {
    for (const entry of complaints.available) {
      if (entry.photoIds?.length) entries.push({name:'Foto complementar · '+entry.accused,
        activate:()=>forms.current.get(entry.id)?.querySelector('select')?.focus()});
      entries.push({name:'Denunciar · '+entry.accused,activate:()=>forms.current.get(entry.id)?.requestSubmit()});
    }
  }
  const messages = notices.map(notice=>{
    const forward = ()=>compose(notice);
    const canExamine = exploring && notice.attachment?.kind==='document' && !reports.some(report=>report.notice===notice.id);
    const review = ()=>setReviewing(notice.id);
    const cancel = ()=>setReviewing(undefined);
    const consume = ()=>{cancel();examine(notice.id);};
    if (exploring) entries.push({name:'Encaminhar · '+notice.subject,activate:forward});
    if (canExamine && reviewing!==notice.id) entries.push({name:'Realizar perícia · '+notice.subject,activate:review});
    if (canExamine && reviewing===notice.id) entries.push(
      {name:'Consumir kit · '+notice.subject,activate:consume},{name:'Cancelar perícia',activate:cancel},
    );
    return <article className="mail-entry" key={notice.id}>
      <h3>{notice.subject}</h3><small>{notice.author}</small>{notice.body && <p>{notice.body}</p>}
      <ForwardedNotice notice={notice}/>
      <button type="button" className="hud-button hud-button--secondary" disabled={!exploring} onClick={forward}>Encaminhar</button>
      {notice.attachment && <Attachment draw={draw} attachment={notice.attachment}/>}
      {notice.attachment?.kind==='document' && <button type="button" className="hud-button"
        disabled={!canExamine || reviewing===notice.id} onClick={review}>Realizar perícia</button>}
      {canExamine && reviewing===notice.id && <div className="flex gap-2">
        <button type="button" className="hud-button" onClick={consume}>Consumir kit</button>
        <button type="button" className="hud-button hud-button--secondary" onClick={cancel}>Cancelar</button>
      </div>}
    </article>;
  });
  const inbox = useDialogKeys<HTMLDivElement>(key=>key==='1' && exploring ? start : undefined,entries);
  return <div ref={inbox} className="grid gap-3">
    <button type="button" className="hud-button" disabled={!exploring} aria-keyshortcuts="1" onClick={start}>
      Novo comunicado <kbd className="action-key" aria-hidden="true">1</kbd>
    </button>
    <ComplaintDesk view={complaints} submit={submit} attachForm={(id,form)=>{
      if (form) forms.current.set(id,form);
      else forms.current.delete(id);
    }}/>
    {reports.map(report=><article className="mail-entry" key={'report-'+report.notice}>
      <h3>Perícia concluída</h3><Attachment draw={draw} attachment={{kind:'report',report}}/>
    </article>)}
    {notices.length===0 && <p>Nenhum comunicado publicado.</p>}
    {messages}
  </div>;
}

export function mountInternalMail(publish:(message:Draft)=>void,
  notify:(title:string,text:string)=>void,examine:(id:number)=>void,draw:(canvas:HTMLCanvasElement,photo:Photo)=>void,submit:(id:number,photo?:number)=>void,close:()=>void) {
  const host = document.querySelector<HTMLElement>('#phone-mail')!;
  const root = createRoot(host);
  let choices:readonly AttachmentChoice[] = [];
  let photosEnabled = true;
  let documentsEnabled = true;
  let reports:readonly ForensicReport[] = [];
  let notices:readonly InternalNotice[] = [];
  let composing = false;
  let exploring = false;
  let fee:number = internalMailRules.fee;
  let complaints:ComplaintView = {available:[],history:[]};
  let source:InternalNotice|undefined;
  let pending = false;
  let error:string|null = null;
  let inboxRevision = 0;
  const visible = ()=>!host.hidden && !!host.closest('dialog[open]');

  function render() {
    const attachments = [...choices,...reports.map(report=>({kind:'report' as const,id:report.notice,label:'Laudo · '+report.document.title}))];
    root.render(<div className="mail-screen">
      {composing ? <MailComposer photosEnabled={photosEnabled} documentsEnabled={documentsEnabled} choices={attachments} source={source} pending={pending} error={error} fee={fee} close={close} draw={draw}
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
        }}/> : <MailInbox key={inboxRevision} notices={notices} reports={reports} complaints={complaints} exploring={exploring}
        close={close} draw={draw} examine={examine} submit={exploring && complaints.atDesk ? submit : undefined}
        compose={notice=>{source=notice;composing=true;error=null;render();}}/>}
    </div>);
  }

  return {
    price(next:number) {
      if (fee===next) return;
      fee = next;
      if (composing) render();
    },
    open(attachments:readonly AttachmentChoice[],options?:{photosEnabled?:boolean;documentsEnabled?:boolean}) {
      photosEnabled = options?.photosEnabled!==false;
      documentsEnabled = options?.documentsEnabled!==false;
      composing = false;
      source = undefined;
      choices = attachments;
      pending = false;
      inboxRevision++;
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
