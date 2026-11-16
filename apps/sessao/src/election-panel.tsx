import { DialogDismiss } from './ui/dialog-dismiss';
import { createRoot } from 'react-dom/client';
import type { CSSProperties, FormEvent } from 'react';
import { ELECTION_RULES, type ElectionView, type ElectionAction } from './elections';
import type { Player } from './map';
import { stations, canReachStation, type PlenaryView } from './plenary';
import { money } from './politics';

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const actionButtons = ['advertise','speech','interview','object'] as const;

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
  const candidates = election.offices.filter(candidate=>candidate.id!==id);
  const current = election.polls.find(candidate=>candidate.id===id)?.supports ?? '';
  const submit = (event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    onSupport(String(new FormData(event.currentTarget).get('candidate') ?? ''));
  };
  return <>
    <header>
      <h2 id="election-poll-title">Pesquisa eleitoral</h2>
      <DialogDismiss label="Fechar pesquisa eleitoral">×</DialogDismiss>
    </header>
    <div id="election-cycle"><ElectionCycle result={election.result}/></div>
    <section aria-label="Pesquisa eleitoral"><div id="election-polls">
      <section><h4>Classificação projetada</h4><ol role="list">
        {election.polls.map((candidate,index)=>{
          const tone = candidate.trend>0 ? 'gain' : candidate.trend<0 ? 'loss' : 'neutral';
          const portrait = {'--portrait-column':candidate.character%2,'--portrait-row':Math.floor(candidate.character/2)} as CSSProperties;
          return <li key={candidate.id}><div className="poll-card">
            <span className="poll-avatar"><span className="portrait" aria-hidden="true" style={portrait}/>
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
        <form id="support-form" onSubmit={submit}>
          <label>Apoio público <select id="endorsement" name="candidate" key={current} defaultValue={current}>
            <option value="">Sem apoio</option>
            {candidates.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}
          </select></label>
          <button className="hud-button hud-button--secondary">Declarar ou retirar apoio</button>
        </form>}
    </div>
  </>;
}

export function createElectionPanel(id:string, send:(action:ElectionAction) => void, hasVoice:()=>boolean) {
  const dock = el('election-dock');
  const openPolls = el<HTMLButtonElement>('open-election-polls');
  const polls = el<HTMLDialogElement>('election-poll-dialog');
  const summaryRoot = createRoot(openPolls);
  function showPolls() {
    if (dock.hidden) return false;
    if (!polls.open) polls.showModal();
    return true;
  }
  openPolls.onclick = showPolls;
  let summaryKey = '';
  let view:PlenaryView | undefined;
  let own:Player | undefined;
  let pollsKey = '';
  const pollsRoot = createRoot(polls);
  dock.hidden = true;
  for (const kind of actionButtons) el<HTMLButtonElement>(kind).onclick = () => send({kind});

  function controls() {
    const election = view?.election;
    const personal = election?.personal;
    el('station-election-actions').hidden = !election?.canCampaign || !election.remaining || !personal;
    el('interview-hint').hidden = true;
    if (!election?.canCampaign || !personal) {
      el<HTMLButtonElement>('advertise').disabled = true;
      return;
    }
    const at = (key:keyof typeof stations) => !!own && canReachStation(own,key);
    el<HTMLButtonElement>('advertise').disabled = !at('press') || !election.remaining || personal.advertised ||
      (view?.politics?.wallet ?? 0)<ELECTION_RULES.advertisementCost;
    el<HTMLButtonElement>('speech').disabled = !at('panel') || personal.spoke;
    el<HTMLButtonElement>('interview').disabled = !at('tv') || !election.canInterview || !hasVoice();
    el('interview-hint').hidden = !at('tv') || !election.canInterview || hasVoice();
    el('object').hidden = false;
    el<HTMLButtonElement>('object').disabled = !at('panel') || !election.canObject;
  }

  return {
    showPolls,
    render(next:PlenaryView) {
      view = next;
      const election = view.election;
      dock.hidden = !election;
      if (!election) {
        polls.close();
        controls();
        return;
      }
      const {remaining,result} = election;
      const race = election.polls;
      const rank = race?.findIndex(candidate => candidate.id===id) ?? -1;
      const candidate = rank>=0 ? race?.[rank] : undefined;
      const summary = {rank,candidate,atRisk:rank===race.length-1 && race.length>ELECTION_RULES.minimumMandates,
        remaining:view.phase==='finished' ? 0 : remaining};
      const nextSummaryKey = JSON.stringify(summary);
      if (nextSummaryKey!==summaryKey) {
        summaryKey = nextSummaryKey;
        summaryRoot.render(<ElectionSummary {...summary}/>);
      }
      dock.dataset.urgency = view.phase==='finished' ? '' : remaining<=30 ? 'high' : remaining<=60 ? 'soon' : '';
      const nextPollsKey = JSON.stringify([result,election.canCampaign,remaining>0,election.polls,election.offices]);
      if (pollsKey!==nextPollsKey) {
        pollsKey = nextPollsKey;
        pollsRoot.render(<ElectionPolls election={election} id={id} onSupport={to=>send({kind:'support',to})}/>);
      }
      controls();
    },
    destroy() {
      polls.close();
      openPolls.onclick = null;
      pollsRoot.unmount();
      summaryRoot.unmount();
      for (const kind of actionButtons) el<HTMLButtonElement>(kind).onclick = null;
    },
    players(players:Player[]) {
      own = players.find(player => player.id===id);
      controls();
    },

  };
}
