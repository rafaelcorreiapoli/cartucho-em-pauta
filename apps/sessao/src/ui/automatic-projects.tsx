import {useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {automaticProjects,type AutomaticProjectsView} from '../automatic-projects';
import {publicBudgetLabel} from '../game-modes';
import type {HudModel} from './hud-model';

const clock = (seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;

export function AutomaticProjectHistory({state}:{state:AutomaticProjectsView}) {
  return <details className="automatic-projects-history" open>
    <summary><span>Projetos · {state.approved.length}/{state.total}</span>
      <strong>{state.nextIn===undefined ? 'Pauta encerrada' : `Próximo em ${clock(state.nextIn)}`}</strong></summary>
    <ol>{Array.from({length:state.total},(_,index)=>{
      const approval = state.approved[index];
      return <li key={index} data-approved={!!approval}><span aria-hidden="true">{approval ? '☑' : '☐'}</span>
        Projeto {index+1} · {approval ? automaticProjects[approval.project].shortName : '?'}</li>;
    })}</ol>
  </details>;
}

export function AutomaticProjectAnnouncement({approval,onClose}:{approval:NonNullable<AutomaticProjectsView['announcement']>;onClose:()=>void}) {
  const project = automaticProjects[approval.project];
  return <section className="automatic-project-announcement" role="status" aria-live="polite" aria-label="Projeto aprovado automaticamente">
    <img src={`/automatic-projects/${project.image}.webp`} alt="" width="512" height="512"/>
    <div><span className="automatic-project-stamp">APROVADO SEM VOTAÇÃO</span>
      <h2>{project.name}</h2><p>{project.description}</p>
      <strong className="automatic-project-cost">−{publicBudgetLabel(approval.cost)} do orçamento</strong>
      <p className="automatic-project-effect">{project.effect}</p>
      <small>{approval.recipients} beneficiados · Itens excedentes vão ao armário ou ao chão do gabinete.</small>
    </div>
    <button type="button" onClick={onClose} aria-label="Fechar anúncio do projeto">×</button>
  </section>;
}

export function AutomaticProjectsHud({channel}:{channel:HudModel['automaticProjects']}) {
  const value = useSyncExternalStore(channel.subscribe,channel.get);
  const [dismissed,setDismissed] = useState<string>();
  if (!value) return null;
  const {state,matchId} = value;
  const identity = state.announcement && `${matchId}:${state.announcement.at}:${state.announcement.project}`;
  return <><AutomaticProjectHistory state={state}/>
    {state.announcement && identity!==dismissed && createPortal(<AutomaticProjectAnnouncement approval={state.announcement} onClose={()=>setDismissed(identity)}/>,document.body)}
  </>;
}
