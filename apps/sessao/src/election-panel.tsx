import {useDialogKeys} from './ui/use-dialog-keys';
import {DialogHeader} from './ui/dialog-header';
import { createRoot } from 'react-dom/client';
import {CharacterPortrait} from './ui/character-portrait';
import { ELECTION_RULES, type ElectionView } from './elections';
import type { PlenaryView } from './plenary';

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

export function ElectionSummary({rank,candidate,leaders,atRisk,remaining,tied=false}:{
  rank:number; candidate?:ElectionView['polls'][number]; leaders?:string; atRisk:boolean; remaining:number; tied?:boolean;
}) {
  const trend = candidate?.trend ?? 0;
  return <>
    <svg className="hud-glyph" aria-hidden="true"><use href="#icon-ballot"/></svg>
    <span className="election-summary">
      <span id="current-office" title={leaders}>{leaders ? `1º · ${leaders}` : 'Renovação de Mandato'}</span>
      <strong id="election-position">{candidate ? `Você · ${rank}º · ${candidate.estimate}%${tied ? ' · Empate' : ''}${atRisk ? ' · Em risco' : ''}${trend ? ` · ${trend>0 ? '+' : ''}${trend} pp` : ''}` : 'Sem mandato'}</strong>
    </span>
    <span className="election-clock" hidden={!remaining}><small className="sr-only">Renovação em</small>
      <strong id="election-timer">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong>
    </span>
  </>;
}

export function ElectionPolls({election,id}:{election:ElectionView; id:string}) {
  const readOnly = useDialogKeys<HTMLDivElement>(()=>undefined,[
    {name:'Fechar pesquisa eleitoral',activate:()=>readOnly.current?.closest('dialog')?.close()},
  ]);
  return <>
    <DialogHeader id="election-poll-title" title="Pesquisa eleitoral" dismissLabel="Fechar pesquisa eleitoral"/>
    <div ref={readOnly} className="election-poll-content">
      <section id="election-polls" aria-labelledby="election-standings-title">
        <h3 id="election-standings-title">Classificação projetada</h3>
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
        </ol>
      </section>
    </div>
  </>;
}

export function ElectionIndicator({summary,urgency,open}:{
  summary?:Parameters<typeof ElectionSummary>[0]; urgency?:'soon'|'high'; open:()=>boolean;
}) {
  return <div id="election-dock" className="hud-strip hud-module" hidden={!summary} data-urgency={urgency} data-at-risk={summary?.atRisk || undefined}>
    {summary && <button id="open-election-polls" aria-keyshortcuts="L" className="hud-option" type="button"
      aria-label="Pesquisa eleitoral" aria-describedby="current-office election-position" aria-haspopup="dialog" title="Abrir ranking eleitoral (L)" onClick={open}>
      <ElectionSummary {...summary}/>
      <kbd className="action-key" aria-hidden="true">L</kbd>
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
      const {remaining} = election;
      const standings = pollStandings(election.polls);
      const standing = standings.find(({candidate})=>candidate.id===id);
      const leaders = standings.filter(({rank})=>rank===1).map(({candidate})=>candidate.name).join(', ');
      const atRisk = view.phase!=='finished' && remaining>0 && !!standing && standing.rank===standings.at(-1)?.rank && standings.length>ELECTION_RULES.minimumMandates;
      const summary = {rank:standing?.rank ?? 0,candidate:standing?.candidate,tied:standing?.tied,leaders,atRisk,
        remaining:view.phase==='finished' ? 0 : remaining};
      const urgency = view.phase==='finished' ? undefined : remaining<=30 ? 'high' : remaining<=60 ? 'soon' : undefined;
      const nextSummaryKey = JSON.stringify([summary,urgency]);
      if (nextSummaryKey!==summaryKey) {
        summaryKey = nextSummaryKey;
        summaryRoot.render(<ElectionIndicator summary={summary} urgency={urgency} open={showPolls}/>);
      }
      const nextPollsKey = JSON.stringify(election.polls);
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
