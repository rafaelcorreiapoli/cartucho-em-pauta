import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { CSSProperties, FormEvent } from 'react';
import { ELECTION_RULES, type ElectionView, type ElectionAction } from './elections';
import type { Player } from './map';
import { stations, STATION_RADIUS, type PlenaryView } from './plenary';
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

function ElectionCycle({invested,result}:{invested?:number;result?:ElectionView['result']}) {
  const eliminated = result?.offices.find(person=>person.id===result.eliminated)?.name;
  return <>
    <div className="electoral-metrics">
      <div><span><button className="resource-help profile-help" type="button" aria-label="Investimento na campanha"
        data-help="Total que você já gastou na campanha deste ciclo."><svg className="hud-glyph" aria-hidden="true"><use href="#icon-chart"/></svg></button>Investido na campanha</span>
        <strong id="election-wallet">{invested===undefined ? '—' : money(invested)}</strong></div>
    </div>
    {result && <details id="election-result" key={result.cycle}>
      <summary>Renovação {result.cycle}</summary>
      <p>{eliminated && `${eliminated} perdeu o mandato. `}
        {!!result.expectedSalary && `Salário: ${money(result.salary)} de ${money(result.expectedSalary)} (${Math.round(result.salary/result.expectedSalary*100)}%).`}
      </p>
    </details>}
  </>;
}

export function createElectionPanel(id:string, send:(action:ElectionAction) => void, hasVoice:()=>boolean) {
  const dock = el<HTMLDetailsElement>('election-dock');
  const notice = el('electoral-notice');
  const summaryRoot = createRoot(dock.querySelector('summary')!);
  let summaryKey = '';
  const cycleRoot = createRoot(el('election-cycle'));
  let cycleKey = '';
  let view:PlenaryView | undefined;
  let own:Player | undefined;
  let lastResult = 0;
  let pollsKey = '';
  const pollsRoot = createRoot(el('election-polls'));
  let campaignKey = '';
  dock.hidden = notice.hidden = true;
  dock.open = false;
  const campaign = el<HTMLDialogElement>('campaign-dialog');
  const openCampaign = el<HTMLButtonElement>('election-actions');
  const campaignRoot = createRoot(campaign);
  openCampaign.onclick = () => { renderCampaign(); campaign.showModal(); };
  function renderCampaign() {
    const election = view?.election;
    const candidates = election?.offices.filter(candidate=>candidate.id!==id) ?? [];
    const max = Math.min(view?.politics?.wallet ?? 0,ELECTION_RULES.investmentCap-(election?.personal?.invested ?? 0));
    const key = JSON.stringify([max,candidates.map(({id,name})=>[id,name])]);
    if (key===campaignKey) return;
    campaignKey = key;
    const submit = (kind:'invest'|'support',event:FormEvent<HTMLFormElement>)=>{
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      if (kind==='invest') send({kind,amount:Number(data.get('amount'))});
      else send({kind,to:String(data.get('candidate') ?? '')});
    };
    flushSync(()=>campaignRoot.render(<>
      <header><h2 id="campaign-title">Minha campanha</h2><form method="dialog">
        <button className="hud-icon-button" aria-label="Fechar campanha">×</button>
      </form></header>
      <form id="invest-form" onSubmit={event=>submit('invest',event)}>
        <label>Investir em campanha (R$ 10 mil por unidade)
          <input id="investment" name="amount" type="number" defaultValue={1} min={1} max={max} step={1} required/>
        </label>
        <button id="invest" className="hud-button" disabled={max<1}>Investir</button>
      </form>
      <form id="support-form" onSubmit={event=>submit('support',event)}>
        <label>Apoio público <select id="endorsement" name="candidate"><option value="">Sem apoio</option>
          {candidates.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}
        </select></label>
        <button className="hud-button hud-button--secondary">Declarar ou retirar apoio</button>
      </form>
    </>));
  }
  for (const kind of actionButtons) el<HTMLButtonElement>(kind).onclick = () => send({kind});

  function controls() {
    const election = view?.election;
    const personal = election?.personal;
    el('station-election-actions').hidden = !election?.canCampaign || !personal;
    el('interview-hint').hidden = true;
    if (!election?.canCampaign || !personal) return;
    const at = (key:keyof typeof stations) => !!own && Math.hypot(own.x-stations[key].x,own.y-stations[key].y)<=STATION_RADIUS;
    el<HTMLButtonElement>('advertise').disabled = !at('press') || personal.advertised ||
      (view?.politics?.wallet ?? 0)<ELECTION_RULES.advertisementCost;
    el<HTMLButtonElement>('speech').disabled = !at('panel') || personal.spoke;
    el<HTMLButtonElement>('interview').disabled = !at('tv') || !election.canInterview || !hasVoice();
    el('interview-hint').hidden = !at('tv') || !election.canInterview || hasVoice();
    el('object').hidden = false;
    el<HTMLButtonElement>('object').disabled = !at('panel') || !election.canObject;
  }

  return {
    render(next:PlenaryView) {
      view = next;
      const election = view.election, personal = election?.personal;
      dock.hidden = !election;
      openCampaign.hidden = !election?.canCampaign;
      if (openCampaign.hidden && campaign.open) campaign.close();
      if (!election) return;
      const {remaining,broadcast,result} = election;
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
      const nextCycleKey = JSON.stringify([personal?.invested,result]);
      if (nextCycleKey!==cycleKey) {
        cycleKey = nextCycleKey;
        cycleRoot.render(<ElectionCycle invested={personal?.invested} result={result}/>);
      }
      if (result && result.cycle!==lastResult) {
        lastResult = result.cycle;
        if (!campaign.open) dock.open = false;
      }
      if (broadcast) {
        notice.hidden = false;
        const label = `TV ao vivo: ${broadcast.name} · ${broadcast.remaining}s`;
        if (notice.textContent!==label) notice.textContent = label;
      } else if (notice.textContent?.startsWith('TV ao vivo:')) {
        notice.hidden = true;
        notice.textContent = '';
      }
      if (campaign.open) renderCampaign();
      const nextPollsKey = JSON.stringify(election.polls);
      if (pollsKey!==nextPollsKey) {
        pollsKey = nextPollsKey;
        const name = (id:string)=>election.offices.find(person=>person.id===id)?.name;
        pollsRoot.render(<section><h4>Classificação projetada</h4><ol role="list">
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
        </ol></section>);
      }
      controls();
    },
    destroy() {
      campaign.close();
      campaignRoot.unmount();
      pollsRoot.unmount();
      summaryRoot.unmount();
      cycleRoot.unmount();
      openCampaign.onclick = null;
      for (const kind of actionButtons) el<HTMLButtonElement>(kind).onclick = null;
    },
    players(players:Player[]) {
      own = players.find(player => player.id===id);
      controls();
    },

  };
}
