import { DialogDismiss } from './dialog-dismiss';
import { documentRules } from '../internal-mail';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { bills } from '../plenary';

export function mountProjectPicker() {
  const dialog = document.querySelector<HTMLDialogElement>('#project-picker')!;
  const root = createRoot(dialog);
  return {
    open(title:string, select:(project:number)=>void, current?:number) {
      if (dialog.open) return;
      flushSync(()=>root.render(<>
        <header><h2 id="project-picker-title">{title}</h2>
          <DialogDismiss label="Fechar">×</DialogDismiss>
        </header>
        <form className="grid gap-2" onSubmit={event=>{
          event.preventDefault();
          const project = new FormData(event.currentTarget).get('project');
          if (project===null) return;
          select(Number(project));
          dialog.close();
        }}>
          {bills.map((bill,index)=>index!==current && <label key={bill.name} className="mail-entry">
            <input type="radio" name="project" value={index} required/> <strong>{bill.name}</strong>
            <p>{bill.description}</p>
          </label>)}
          <button className="hud-button">Confirmar{current!==undefined && ` · ${documentRules.forgeryMs/1000} s`}</button>
        </form>
      </>));
      dialog.showModal();
    },
    destroy() { dialog.close(); root.unmount(); },
  };
}
