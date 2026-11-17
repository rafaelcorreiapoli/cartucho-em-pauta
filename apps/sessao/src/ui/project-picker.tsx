import {formatImpact,impactTone} from './impact-value';
import {DialogHeader} from './dialog-header';
import {useDialogKeys} from './use-dialog-keys';
import { useRef, useState, type KeyboardEvent } from 'react';
import { documentRules } from '../internal-mail';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { bills, pingaProgram, type Impact } from '../plenary';
import { money } from '../politics';
import './project-picker.css';

type Project = (typeof bills)[number];

function budgetImpact(value:number) {
  const cost = Math.min(0,value);
  return {value:cost,label:formatImpact(cost,true)};
}

function approvalBudget(bill:Project) {
  const effect = bill.effect;
  if (effect?.kind==='allowance') return {value:-effect.perMandate,label:`até −${money(effect.perMandate)} por mandato`};
  if (effect?.kind==='pinga-distribution') return {value:-pingaProgram.doseCost,label:`−${money(pingaProgram.doseCost)} por mandato`};
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

function ImpactSummary({impact,budget}:{impact:Impact;budget:ReturnType<typeof budgetImpact>}) {
  return <span className="project-picker-impact">
    <span>Orçamento <b data-effect={impactTone(budget.value)}>{budget.label}</b></span>
    <span>Estabilidade <b data-effect={impactTone(impact.stability)}>{formatImpact(impact.stability)}</b></span>
  </span>;
}

function ProjectPicker({title,current,unavailable,confirm}:{
  title:string;current?:number;unavailable:ReadonlySet<number>;confirm:(project:number)=>void;
}) {
  const [selected,setSelected] = useState<number>();
  const list = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const choices = bills.flatMap((_,index)=>index!==current && !unavailable.has(index) ? [index] : []);
  function select(index:number) {
    setSelected(index);
    if (detail.current) detail.current.scrollTop = 0;
  }
  function selectAndReveal(index:number) {
    select(index);
    const radio = list.current?.querySelector<HTMLInputElement>(`input[value="${index}"]`);
    radio?.focus({preventScroll:true});
    radio?.closest('label')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function submit() {
    if (selected!==undefined && !unavailable.has(selected)) confirm(selected);
  }
  function onKeyDown(event:KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key==='PageDown' || event.key==='PageUp') {
      if (!detail.current) return;
      event.preventDefault();
      detail.current.scrollBy({top:detail.current.clientHeight*(event.key==='PageDown' ? 1 : -1)});
      return;
    }
    if (event.key==='Enter') {
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      if (!event.repeat) submit();
      return;
    }
    const position = selected===undefined ? -1 : choices.indexOf(selected);
    let index:number|undefined;
    if (/^[1-9]$/.test(event.key)) index = choices[Number(event.key)-1];
    else if (event.key==='ArrowDown') index = choices[Math.min(position+1,choices.length-1)];
    else if (event.key==='ArrowUp') index = choices[position<0 ? choices.length-1 : Math.max(position-1,0)];
    else return;
    event.preventDefault();
    if (index===undefined) return;
    selectAndReveal(index);
  }
  const picker = useDialogKeys<HTMLDivElement>(()=>undefined,[
    {name:'Fechar',activate:():void=>{picker.current?.closest('dialog')?.close();}},
    ...(selected===undefined ? [] : [{name:'Confirmar',activate:submit}]),
    ...choices.map(index=>({name:bills[index]!.name,activate:()=>selectAndReveal(index)})),
  ]);
  const bill = selected===undefined ? undefined : bills[selected];
  const effect = bill && extraEffect(bill);
  return <div ref={picker} className="project-picker-content" onKeyDown={onKeyDown}>
    <DialogHeader id="project-picker-title" title={title} dismissLabel="Fechar" titleClass="hud-title"/>
    <form className="project-picker-form" onSubmit={event=>{
      event.preventDefault();
      submit();
    }}>
      <div ref={list} className="project-picker-list" role="radiogroup" aria-labelledby="project-picker-title">
        {bills.map((project,index)=>{
          if (index===current) return null;
          const position = choices.indexOf(index);
          const shortcut = position>=0 && position<9 ? String(position+1) : undefined;
          return <label key={project.id} className="project-picker-option">
            <img className="project-picker-art" src={import.meta.env.BASE_URL+'assets/documento-legislativo.webp'} alt=""/>
            <span className="project-picker-copy">
              <strong id={`project-picker-name-${index}`}>{project.name}{unavailable.has(index) && ' · Já votado'}</strong>
              <span id={`project-picker-impact-${index}`}>Se aprovado <ImpactSummary impact={project.yes} budget={approvalBudget(project)}/></span>
            </span>
            <input type="radio" name="project" value={index} checked={selected===index}
              disabled={unavailable.has(index)} onChange={()=>select(index)} aria-keyshortcuts={shortcut}
              aria-labelledby={`project-picker-name-${index}`} aria-describedby={`project-picker-impact-${index}`}/>
            {shortcut && <kbd className="action-key" aria-hidden="true">{shortcut}</kbd>}
          </label>;
        })}
      </div>
      <section className="project-picker-details" aria-label="Detalhes do projeto">
        <div ref={detail} className="project-picker-detail-content">
          {bill ? <>
            <img className="project-picker-banner" src={import.meta.env.BASE_URL+'assets/'+(bill.banner ?? 'documento-legislativo.webp')} alt=""/>
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
  </div>;
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
      dialog.querySelector<HTMLInputElement>('input[name="project"]:enabled')?.focus({preventScroll:true});
    },
    destroy() { dialog.close(); root.unmount(); },
  };
}
