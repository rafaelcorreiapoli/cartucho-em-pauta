import { useState } from 'react';
import { DialogDismiss } from './dialog-dismiss';
import { documentRules } from '../internal-mail';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { bills, pingaProgram, type Impact } from '../plenary';
import { money } from '../politics';
import './project-picker.css';

type Project = (typeof bills)[number];

function budgetImpact(value:number) {
  return value<0 ? `−${money(-value)}` : money(0);
}

function stabilityImpact(value:number) {
  if (value<0) return `−${-value}`;
  return value>0 ? `+${value}` : '0';
}

function approvalBudget(bill:Project) {
  const effect = bill.effect;
  if (effect?.kind==='allowance') return `até ${budgetImpact(-effect.perMandate)} por mandato`;
  if (effect?.kind==='pinga-distribution') return `${budgetImpact(-pingaProgram.doseCost)} por mandato`;
  return budgetImpact(bill.yes.budget);
}

function extraEffect(bill:Project) {
  const effect = bill.effect;
  switch (effect?.kind) {
    case 'allowance': return `Pagamento único de até ${money(effect.perMandate)} por mandato, conforme o orçamento disponível.`;
    case 'pinga-distribution': return pingaProgram.detail;
    case 'policy': return effect.detail;
    case 'fire-safety': return 'Aumenta o intervalo entre incêndios até o fim da partida.';
    case 'treasury-reputation': return `Até +${effect.bonus} de popularidade por entrega à Tesouraria durante ${effect.duration/1000} s.`;
  }
}

function ImpactSummary({impact,budget}:{impact:Impact;budget:string}) {
  return <span className="project-picker-impact">
    <span>Orçamento <b>{budget}</b></span>
    <span>Estabilidade <b>{stabilityImpact(impact.stability)}</b></span>
  </span>;
}

function ProjectPicker({title,current,unavailable,confirm}:{
  title:string;current?:number;unavailable:ReadonlySet<number>;confirm:(project:number)=>void;
}) {
  const [selected,setSelected] = useState<number>();
  const bill = selected===undefined ? undefined : bills[selected];
  const effect = bill && extraEffect(bill);
  return <>
    <header><h2 className="hud-title" id="project-picker-title">{title}</h2>
      <DialogDismiss label="Fechar"/>
    </header>
    <form className="project-picker-form" onSubmit={event=>{
      event.preventDefault();
      if (selected!==undefined && !unavailable.has(selected)) confirm(selected);
    }}>
      <div className="project-picker-list" role="radiogroup" aria-labelledby="project-picker-title">
        {bills.map((project,index)=>index!==current && <label key={project.id} className="project-picker-option">
          <img className="project-picker-art" src={import.meta.env.BASE_URL+'assets/documento-legislativo.webp'} alt=""/>
          <span className="project-picker-copy">
            <strong id={`project-picker-name-${index}`}>{project.name}{unavailable.has(index) && ' · Já votado'}</strong>
            <span id={`project-picker-impact-${index}`}>Se aprovado <ImpactSummary impact={project.yes} budget={approvalBudget(project)}/></span>
          </span>
          <input type="radio" name="project" value={index} checked={selected===index}
            disabled={unavailable.has(index)} onChange={()=>setSelected(index)}
            aria-labelledby={`project-picker-name-${index}`} aria-describedby={`project-picker-impact-${index}`}/>
        </label>)}
      </div>
      <section className="project-picker-details" aria-label="Detalhes do projeto">
        <div className="project-picker-detail-content">
          {bill ? <>
            <h3>{bill.name}</h3>
            <p>{bill.description}</p>
            {effect && <div><h4>Efeito extra se aprovado</h4><p>{effect}</p></div>}
            <div><h4>Se rejeitado</h4><ImpactSummary impact={bill.no} budget={budgetImpact(bill.no.budget)}/></div>
          </> : <p>Selecione um projeto para ver os detalhes.</p>}
        </div>
        <footer>
          <button type="submit" className="hud-button" disabled={selected===undefined}>
            Confirmar{current!==undefined && ` · ${documentRules.forgeryMs/1000} s`}
          </button>
        </footer>
      </section>
    </form>
  </>;
}

export function mountProjectPicker() {
  const dialog = document.querySelector<HTMLDialogElement>('#project-picker')!;
  const root = createRoot(dialog);
  let opened = 0;
  return {
    open(title:string, select:(project:number)=>void, current?:number, unavailable:ReadonlySet<number> = new Set()) {
      if (dialog.open) return;
      flushSync(()=>root.render(<ProjectPicker key={++opened} title={title} current={current} unavailable={unavailable}
        confirm={project=>{select(project);dialog.close();}}/>));
      dialog.showModal();
    },
    destroy() { dialog.close(); root.unmount(); },
  };
}
