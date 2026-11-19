import {useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {automaticProjects,type AutomaticProjectsView} from '../automatic-projects';
import {publicBudgetLabel} from '../game-modes';
import {HudIcon} from './hud-icon';
import type {HudModel} from './hud-model';

const clock = (seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;

const compactHistoryQuery = '(max-height:600px)';
const subscribeHistorySize = (listener:()=>void)=>{
  const query = window.matchMedia(compactHistoryQuery);
  query.addEventListener('change',listener);
  return ()=>query.removeEventListener('change',listener);
};
const isHistoryCompact = ()=>window.matchMedia(compactHistoryQuery).matches;

export function AutomaticProjectHistory({state}:{state:AutomaticProjectsView}) {
  const compact = useSyncExternalStore(subscribeHistorySize,isHistoryCompact,()=>false);
  return <details className="automatic-projects-history" aria-labelledby="automatic-projects-title" open={!compact}>
    <summary aria-label="Histórico dos projetos">
    <header><h2 id="automatic-projects-title">Projetos</h2><span className="automatic-projects-count">{state.approved.length} de {state.total}<span className="automatic-projects-disclosure" aria-hidden="true">⌄</span></span></header>
    <div className="automatic-projects-next"><span>{state.nextIn===undefined ? 'Pauta encerrada' : 'Próxima aprovação'}</span>
      {state.nextIn!==undefined && <strong data-urgent={state.nextIn<=20} role="timer" aria-label="Tempo até o próximo projeto">{clock(state.nextIn)}</strong>}</div>
    </summary>
    <ol>{Array.from({length:state.total},(_,index)=>{
      const approval = state.approved[index];
      return <li key={index} data-approved={!!approval}>
        <span className="automatic-projects-status" aria-hidden="true">{approval ? <HudIcon name="check"/> : '–'}</span>
        <span className="automatic-projects-number">{index+1}</span>
        <span>{approval ? automaticProjects[approval.project].shortName : 'Não revelado'}</span>
      </li>;
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
