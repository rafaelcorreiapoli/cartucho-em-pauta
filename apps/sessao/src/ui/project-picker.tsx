import { DialogDismiss } from './dialog-dismiss';
import { documentRules } from '../internal-mail';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { bills } from '../plenary';
import './project-picker.css';

export function mountProjectPicker() {
  const dialog = document.querySelector<HTMLDialogElement>('#project-picker')!;
  const root = createRoot(dialog);
  return {
    open(title:string, select:(project:number)=>void, current?:number) {
      if (dialog.open) return;
      flushSync(()=>root.render(<>
        <header><h2 className="hud-title" id="project-picker-title">{title}</h2>
          <DialogDismiss label="Fechar"/>
        </header>
        <form className="project-picker-form" onSubmit={event=>{
          event.preventDefault();
          const project = new FormData(event.currentTarget).get('project');
          if (project===null) return;
          select(Number(project));
          dialog.close();
        }}>
          <div className="project-picker-list" role="radiogroup" aria-labelledby="project-picker-title">
            {bills.map((bill,index)=>index!==current && <label key={bill.id} className="project-picker-option">
              <img className="project-picker-art" src={import.meta.env.BASE_URL+'assets/documento-legislativo.webp'} alt=""/>
              <span className="project-picker-copy">
                <strong id={`project-picker-name-${index}`}>{bill.name}</strong>
                <span id={`project-picker-description-${index}`}>{bill.description}</span>
              </span>
              <input type="radio" name="project" value={index} required
                aria-labelledby={`project-picker-name-${index}`} aria-describedby={`project-picker-description-${index}`}/>
            </label>)}
          </div>
          <footer>
            <button type="submit" className="hud-button">Confirmar{current!==undefined && ` · ${documentRules.forgeryMs/1000} s`}</button>
          </footer>
        </form>
      </>));
      dialog.showModal();
    },
    destroy() { dialog.close(); root.unmount(); },
  };
}
