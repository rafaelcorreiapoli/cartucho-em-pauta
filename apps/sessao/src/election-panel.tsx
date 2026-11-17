import {useDialogKeys} from './ui/use-dialog-keys';
import {DialogHeader} from './ui/dialog-header';
import { createRoot } from 'react-dom/client';
import {useState} from 'react';
import {CharacterPortrait} from './ui/character-portrait';
import { ELECTION_RULES, type ElectionView, type ElectionAction } from './elections';
import type { PlenaryView } from './plenary';
import { money } from './politics';

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

export function ElectionSummary({rank,candidate,atRisk,remaining}:{
  rank:number; candidate?:ElectionView['polls'][number]; atRisk:boolean; remaining:number;
}) {
  const trend = candidate?.trend ?? 0;
  return <>
    <svg className="hud-glyph" aria-hidden="true"><use href="#icon-ballot"/></svg>
    <span className="election-summary"><span id="current-office">Renovação de Mandato</span>
      <strong id="election-position">{candidate && `${rank+1}º · ${candidate.estimate}%${atRisk ? ' · Em risco' : ''}${trend ? ` · ${trend>0 ? '+' : ''}${trend} pp` : ''}`}</strong>
    </span>
    <span className="election-clock" hidden={!remaining}><small className="sr-only">Renovação em</small>
      <strong id="election-timer">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong>
    </span>
  </>;
}

function ElectionCycle({result}:{result?:ElectionView['result']}) {
  const eliminated = result?.offices.find(person=>person.id===result.eliminated)?.name;
  return result ? <details id="election-result" key={result.cycle}>
      <summary>Renovação {result.cycle}</summary>
      <p>{eliminated && `${eliminated} perdeu o mandato. `}
        {!!result.expectedSalary && `Salário: ${money(result.salary)} de ${money(result.expectedSalary)} (${Math.round(result.salary/result.expectedSalary*100)}%).`}
      </p>
    </details> : null;
}

export function ElectionPolls({election,id,onSupport}:{election:ElectionView; id:string; onSupport:(candidate:string)=>void}) {
  const name = (candidateId:string)=>election.offices.find(person=>person.id===candidateId)?.name;
  const candidates = election.polls.filter(candidate=>candidate.id!==id)
    .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR') || a.id.localeCompare(b.id));
  const current = election.polls.find(candidate=>candidate.id===id)?.supports ?? '';
  return <>
    <DialogHeader id="election-poll-title" title="Pesquisa eleitoral" dismissLabel="Fechar pesquisa eleitoral"/>
    <div className="election-poll-content">
      <div id="election-cycle"><ElectionCycle result={election.result}/></div>
      <section aria-label="Pesquisa eleitoral"><div id="election-polls">
        <section><h4>Classificação projetada</h4><ol role="list">
          {election.polls.map((candidate,index)=>{
            const tone = candidate.trend>0 ? 'gain' : candidate.trend<0 ? 'loss' : 'neutral';
            return <li key={candidate.id}><div className="poll-card">
              <span className="poll-avatar"><CharacterPortrait character={candidate.character}/>
                <span className="poll-rank" data-rank={index+1}>{index+1}º</span></span>
              <div className="poll-details"><div className="poll-label">
                <span>{candidate.name}{candidate.id===id ? ' (você)' : ''}</span>
                <strong data-effect={tone}>{candidate.estimate}%</strong>
                {!!candidate.trend && <small data-effect={tone}>{candidate.trend>0 ? '+' : ''}{candidate.trend} pp</small>}
              </div><div className="react-meter" data-tone="budget" role="progressbar" aria-label={'Intenção de voto de '+candidate.name}
                aria-valuenow={candidate.estimate} aria-valuemin={0} aria-valuemax={100}>
                <span style={{transform:`scaleX(${candidate.estimate/100})`}}/></div>
              {candidate.supports && <small>Apoia {name(candidate.supports)}</small>}</div>
            </div></li>;
          })}
        </ol></section>
      </div></section>
      <div id="election-support">
        {election.canCampaign && election.remaining>0 && candidates.length>0 &&
          <ElectionSupport key={current} candidates={candidates} current={current} onSupport={onSupport}/>}
      </div>
    </div>
  </>;
}

function ElectionSupport({candidates,current,onSupport}:{
  candidates:ElectionView['polls']; current:string; onSupport:(candidate:string)=>void;
}) {
  const [choice,select] = useState(current);
  const selected = candidates.some(candidate=>candidate.id===choice) ? choice : '';
  const submit = () => {
    if (selected!==current) onSupport(selected);
  };
  const form = useDialogKeys<HTMLFormElement>(key=>{
    if (key==='0') return submit;
    if (key==='9') return ()=>select('');
    const candidate = /^[1-8]$/.test(key) ? candidates[Number(key)-1] : undefined;
    if (candidate) return ()=>select(candidate.id);
  });
  return <form ref={form} id="support-form" onSubmit={event=>{event.preventDefault();submit();}}>
    <strong id="support-label">Apoio público</strong>
    <div className="support-candidates" role="group" aria-labelledby="support-label">
      {candidates.map(({id,name,character},index)=>{
        const shortcut = index<8 ? String(index+1) : undefined;
        return <button key={id} type="button" className="hud-button hud-button--secondary"
          aria-pressed={selected===id} aria-keyshortcuts={shortcut} onClick={()=>select(id)}>
          <CharacterPortrait character={character}/>
          <span>{name}</span>
          {shortcut && <kbd className="action-key" aria-hidden="true">{shortcut}</kbd>}
        </button>;
      })}
      <button type="button" className="hud-button hud-button--secondary" aria-pressed={!selected}
        aria-keyshortcuts="9" onClick={()=>select('')}>Sem apoio<kbd className="action-key" aria-hidden="true">9</kbd></button>
    </div>
    <button type="submit" className="hud-button" aria-keyshortcuts="0" disabled={selected===current}>
      {selected ? 'Declarar apoio' : 'Retirar apoio'} <kbd className="action-key" aria-hidden="true">0</kbd>
    </button>
  </form>;
}

export function ElectionIndicator({summary,urgency,open}:{
  summary?:Parameters<typeof ElectionSummary>[0]; urgency?:'soon'|'high'; open:()=>boolean;
}) {
  return <div id="election-dock" className="hud-strip hud-module" hidden={!summary} data-urgency={urgency}>
    {summary && <button id="open-election-polls" aria-keyshortcuts="L" className="hud-option" type="button"
      aria-label="Pesquisa eleitoral" aria-haspopup="dialog" title="Pesquisa eleitoral (L)" onClick={open}>
      <ElectionSummary {...summary}/>
    </button>}
  </div>;
}

export function createElectionPanel(id:string, send:(action:ElectionAction) => void) {
  let available = false;
  const polls = el<HTMLDialogElement>('election-poll-dialog');
  const summaryRoot = createRoot(el('election-indicator-mount'));
  function showPolls() {
    if (!available) return false;
    if (!polls.open) polls.showModal();
    return true;
  }
  let summaryKey = '';
  let pollsKey = '';
  const pollsRoot = createRoot(polls);
  return {
    showPolls,
    render(view:PlenaryView) {
      const election = view.election;
      available = !!election;
      if (!election) {
        if (summaryKey) {
          summaryKey = '';
          summaryRoot.render(<ElectionIndicator open={showPolls}/>);
        }
        polls.close();
        return;
      }
      const {remaining,result} = election;
      const race = election.polls;
      const rank = race?.findIndex(candidate => candidate.id===id) ?? -1;
      const candidate = rank>=0 ? race?.[rank] : undefined;
      const summary = {rank,candidate,atRisk:rank===race.length-1 && race.length>ELECTION_RULES.minimumMandates,
        remaining:view.phase==='finished' ? 0 : remaining};
      const urgency = view.phase==='finished' ? undefined : remaining<=30 ? 'high' : remaining<=60 ? 'soon' : undefined;
      const nextSummaryKey = JSON.stringify([summary,urgency]);
      if (nextSummaryKey!==summaryKey) {
        summaryKey = nextSummaryKey;
        summaryRoot.render(<ElectionIndicator summary={summary} urgency={urgency} open={showPolls}/>);
      }
      const nextPollsKey = JSON.stringify([result,election.canCampaign,remaining>0,election.polls,election.offices]);
      if (pollsKey!==nextPollsKey) {
        pollsKey = nextPollsKey;
        pollsRoot.render(<ElectionPolls election={election} id={id} onSupport={to=>send({kind:'support',to})}/>);
      }
    },
    destroy() {
      polls.close();
      pollsRoot.unmount();
      summaryRoot.unmount();
    },
  };
}
