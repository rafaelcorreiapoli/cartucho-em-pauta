import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { internalMailRules, type InternalNotice } from '../internal-mail';
import { money } from '../politics';

export function mountInternalMail(publish:(message:{subject:string;body:string})=>void,notify:(title:string,text:string)=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#internal-mail')!;
  const root = createRoot(dialog);
  let notices:readonly InternalNotice[] = [];
  let composing = false;
  let pending = false;
  let error:string|null = null;

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
        publish({subject:String(data.get('subject')),body:String(data.get('body'))});
        render();
      }}>
        <label>Assunto<input name="subject" required maxLength={internalMailRules.subjectLength}/></label>
        <label>Mensagem<textarea name="body" required rows={4} maxLength={internalMailRules.bodyLength}/></label>
        <p role="status">{error}</p>
        <button className="hud-button" disabled={pending}>Publicar · {money(internalMailRules.fee)}</button>
      </form> : <div className="grid gap-3">
        {notices.length===0 && <p>Nenhum comunicado publicado.</p>}
        {notices.map(notice=><article className="mail-entry" key={notice.id}>
          <h3>{notice.subject}</h3><small>{notice.author}</small><p>{notice.body}</p>
        </article>)}
      </div>}
    </>);
  }

  return {
    open(compose=false) {
      if (dialog.open) return;
      composing = compose;
      pending = false;
      error = null;
      flushSync(render);
      dialog.showModal();
    },
    receive(next:readonly InternalNotice[]) {
      if (next[0] && next[0].id!==notices[0]?.id) notify('Correio Interno',next[0].subject);
      notices = next;
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
