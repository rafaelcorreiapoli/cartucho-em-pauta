import {useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {automaticProjects,type AutomaticProjectsView} from '../automatic-projects';
import {publicBudgetLabel} from '../game-modes';
import type {HudModel} from './hud-model';

const clock = (seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;

export function AutomaticProjectHistory({state}:{state:AutomaticProjectsView}) {
  return <ol className="automatic-projects-history" aria-label={state.nextIn===undefined ? 'Projetos · Pauta encerrada' : 'Projetos'}>
    {Array.from({length:state.total},(_,index)=>{
      const approval = state.approved[index];
      const project = approval && automaticProjects[approval.project];
      const next = !approval && index===state.approved.length && state.nextIn!==undefined;
      return <li key={index} data-approved={!!approval} data-next={next}
        aria-label={`Projeto ${index+1}: ${project ? project.name : 'Não revelado'}`} title={project?.name ?? 'Não revelado'}>
        {project ? <img src={`/automatic-projects/${project.image}.webp`} alt={project.shortName} width="64" height="64"/> : <span aria-hidden="true">?</span>}
        {next && <strong data-urgent={state.nextIn!<=20} role="timer" aria-label="Tempo até o próximo projeto">{clock(state.nextIn!)}</strong>}
      </li>;
    })}
  </ol>;
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
