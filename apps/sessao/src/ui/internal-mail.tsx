import { useLayoutEffect, useRef } from 'react';
import type { Photo } from '../photography';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { internalMailRules, type InternalNotice, type AttachmentRef, type ForensicReport, type MailAttachment } from '../internal-mail';
import { money } from '../politics';

export type AttachmentChoice = AttachmentRef & {label:string};

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

export function mountInternalMail(publish:(message:{subject:string;body:string;attachment?:AttachmentRef})=>void,
  notify:(title:string,text:string)=>void,examine:(id:number)=>void,draw:(canvas:HTMLCanvasElement,photo:Photo)=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#internal-mail')!;
  const root = createRoot(dialog);
  let choices:readonly AttachmentChoice[] = [];
  let reports:readonly ForensicReport[] = [];
  let notices:readonly InternalNotice[] = [];
  let composing = false;
  let pending = false;
  let error:string|null = null;
  let reviewing:number|undefined;

  function render() {
    root.render(<>
      <header><h2 id="internal-mail-title">{composing ? 'Publicar comunicado' : 'Correio Interno'}</h2>
        <form method="dialog"><button className="hud-icon-button" aria-label="Fechar correio">×</button></form>
      </header>
      {composing ? <form className="grid gap-3" onSubmit={event=>{
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        pending = true;
        error = null;
        const choice = choices[Number(data.get('attachment'))-1];
        const attachment = choice && {kind:choice.kind,id:choice.id};
        publish({subject:String(data.get('subject')),body:String(data.get('body')),attachment});
        render();
      }}>
        <label>Assunto<input name="subject" required maxLength={internalMailRules.subjectLength}/></label>
        <label>Mensagem<textarea name="body" required rows={4} maxLength={internalMailRules.bodyLength}/></label>
        <label>Anexo <select name="attachment"><option value="">Sem anexo</option>
          {choices.map((choice,index)=><option key={choice.kind+'-'+choice.id} value={index+1}>{choice.label}</option>)}
        </select></label>
        <p role="status">{error}</p>
        <button className="hud-button" disabled={pending}>Publicar · {money(internalMailRules.fee)}</button>
      </form> : <div className="grid gap-3">
        {reports.map(report=><article className="mail-entry" key={'report-'+report.notice}>
          <h3>Perícia concluída</h3><Attachment draw={draw} attachment={{kind:'report',report}}/>
        </article>)}
        {notices.length===0 && <p>Nenhum comunicado publicado.</p>}
        {notices.map(notice=><article className="mail-entry" key={notice.id}>
          <h3>{notice.subject}</h3><small>{notice.author}</small><p>{notice.body}</p>
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
    open(compose=false,attachments:readonly AttachmentChoice[] = []) {
      if (dialog.open) return;
      composing = compose;
      choices = [...attachments,...reports.map(report=>({kind:'report' as const,id:report.notice,label:'Laudo · '+report.document.title}))];
      pending = false;
      reviewing = undefined;
      error = null;
      flushSync(render);
      dialog.showModal();
    },
    receive(next:readonly InternalNotice[]) {
      if (next[0] && next[0].id!==notices[0]?.id) notify('Correio Interno',next[0].subject);
      notices = next;
      if (dialog.open && !composing) render();
    },
    reports(next:readonly ForensicReport[]) {
      if (next[0] && next[0].notice!==reports[0]?.notice) notify('Perícia concluída',next[0].document.title);
      reports = next;
      if (dialog.open && !composing) render();
    },
    result(message:string|null) {
      if (!dialog.open || !composing) return;
      pending = false;
      error = message;
      if (!message) composing = false;
      render();
    },
    phase(exploring:boolean) { if (!exploring && composing && dialog.open) dialog.close(); },
    destroy() { dialog.close(); root.unmount(); },
  };
}
