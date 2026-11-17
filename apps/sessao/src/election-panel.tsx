import {useDialogKeys} from './ui/use-dialog-keys';
import {DialogHeader} from './ui/dialog-header';
import { createRoot } from 'react-dom/client';
import {useRef,type Ref} from 'react';
import {CharacterPortrait} from './ui/character-portrait';
import { ELECTION_RULES, type ElectionView } from './elections';
import type { PlenaryView } from './plenary';
import { money } from './politics';

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

function pollStandings(polls:ElectionView['polls']) {
  const groups = new Map<number,{rank:number; count:number}>();
  for (const {estimate} of polls) {
    const group = groups.get(estimate);
    if (group) group.count++;
    else groups.set(estimate,{rank:groups.size+1,count:1});
  }
  return polls.map(candidate=>{
    const {rank,count} = groups.get(candidate.estimate)!;
    return {candidate,rank,tied:count>1};
  });
}

export function ElectionSummary({rank,candidate,atRisk,remaining,tied=false}:{
  rank:number; candidate?:ElectionView['polls'][number]; atRisk:boolean; remaining:number; tied?:boolean;
}) {
  const trend = candidate?.trend ?? 0;
  return <>
    <svg className="hud-glyph" aria-hidden="true"><use href="#icon-ballot"/></svg>
    <span className="election-summary"><span id="current-office">Renovação de Mandato</span>
      <strong id="election-position">{candidate && `${rank}º · ${candidate.estimate}%${tied ? ' · Empate' : ''}${atRisk ? ' · Em risco' : ''}${trend ? ` · ${trend>0 ? '+' : ''}${trend} pp` : ''}`}</strong>
    </span>
    <span className="election-clock" hidden={!remaining}><small className="sr-only">Renovação em</small>
      <strong id="election-timer">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong>
    </span>
  </>;
}

function ElectionCycle({result,details}:{result?:ElectionView['result'];details:Ref<HTMLDetailsElement>}) {
  const eliminated = result?.offices.find(person=>person.id===result.eliminated)?.name;
  return result ? <details ref={details} id="election-result" key={result.cycle}>
      <summary>Renovação {result.cycle}</summary>
      <p>{eliminated && `${eliminated} perdeu o mandato. `}
        {!!result.expectedSalary && `Salário: ${money(result.salary)} de ${money(result.expectedSalary)} (${Math.round(result.salary/result.expectedSalary*100)}%).`}
      </p>
    </details> : null;
}

export function ElectionPolls({election,id}:{election:ElectionView; id:string}) {
  const details = useRef<HTMLDetailsElement>(null);
  const cycle = election.result?.cycle;
  const toggleCycle = ()=>{if (details.current) details.current.open = !details.current.open;};
  const cycleAction = cycle===undefined ? undefined : {name:'Renovação '+cycle,activate:toggleCycle};
  const readOnly = useDialogKeys<HTMLDivElement>(()=>undefined,[
    {name:'Fechar pesquisa eleitoral',activate:()=>readOnly.current?.closest('dialog')?.close()},
    ...(cycleAction ? [cycleAction] : []),
  ]);
  return <>
    <DialogHeader id="election-poll-title" title="Pesquisa eleitoral" dismissLabel="Fechar pesquisa eleitoral"/>
    <div ref={readOnly} className="election-poll-content">
      <div id="election-cycle"><ElectionCycle result={election.result} details={details}/></div>
      <section aria-label="Pesquisa eleitoral"><div id="election-polls">
        <section><h4>Classificação projetada</h4>
          <p>Os percentuais são arredondados. A apuração pode mudar a ordem.</p>
          <ol role="list">
          {pollStandings(election.polls).map(({candidate,rank,tied})=>{
            const tone = candidate.trend>0 ? 'gain' : candidate.trend<0 ? 'loss' : 'neutral';
            return <li key={candidate.id}><div className="poll-card">
              <span className="poll-avatar"><CharacterPortrait character={candidate.character}/>
                <span className="poll-rank" data-rank={rank}>{rank}º</span></span>
              <div className="poll-details"><div className="poll-label">
                <span>{candidate.name}{candidate.id===id ? ' (você)' : ''}</span>
                <strong data-effect={tone}>{candidate.estimate}%</strong>
                {tied && <small>Empate</small>}
                {!!candidate.trend && <small data-effect={tone}>{candidate.trend>0 ? '+' : ''}{candidate.trend} pp</small>}
              </div><div className="react-meter" data-tone="budget" role="progressbar" aria-label={'Intenção de voto de '+candidate.name}
                aria-valuenow={candidate.estimate} aria-valuemin={0} aria-valuemax={100}>
                <span style={{transform:`scaleX(${candidate.estimate/100})`}}/></div>
              </div>
            </div></li>;
          })}
        </ol></section>
      </div></section>
    </div>
  </>;
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

export function createElectionPanel(id:string) {
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
      const standings = pollStandings(election.polls);
      const standing = standings.find(({candidate})=>candidate.id===id);
      const atRisk = !!standing && standing.rank===standings.at(-1)?.rank && standings.length>ELECTION_RULES.minimumMandates;
      const summary = {rank:standing?.rank ?? 0,candidate:standing?.candidate,tied:standing?.tied,atRisk,
        remaining:view.phase==='finished' ? 0 : remaining};
      const urgency = view.phase==='finished' ? undefined : remaining<=30 ? 'high' : remaining<=60 ? 'soon' : undefined;
      const nextSummaryKey = JSON.stringify([summary,urgency]);
      if (nextSummaryKey!==summaryKey) {
        summaryKey = nextSummaryKey;
        summaryRoot.render(<ElectionIndicator summary={summary} urgency={urgency} open={showPolls}/>);
      }
      const nextPollsKey = JSON.stringify([result,election.polls]);
      if (pollsKey!==nextPollsKey) {
        pollsKey = nextPollsKey;
        pollsRoot.render(<ElectionPolls election={election} id={id}/>);
      }
    },
    destroy() {
      polls.close();
      pollsRoot.unmount();
      summaryRoot.unmount();
    },
  };
}
