import {HudHelp} from './ui/hud-help';
import {useDialogKeys} from './ui/use-dialog-keys';
import {DialogHeader} from './ui/dialog-header';
import { createRoot } from 'react-dom/client';
import {ElectionCandidateCard,RankedPortrait} from './ui/election-candidate-card';
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

type RankedCandidate = {name:string;character:number;rank:number};

function ElectionStanding({candidate,personal=false,atRisk=false}:{
  candidate:RankedCandidate; personal?:boolean; atRisk?:boolean;
}) {
  return <span className={personal ? 'election-standing election-personal' : 'election-standing election-leader'}>
    <RankedPortrait character={candidate.character} rank={candidate.rank}/>
    <span className="election-standing-label">
      <bdi className="election-name" title={candidate.name}>{candidate.name}</bdi>
      {atRisk && <small>Em risco</small>}
    </span>
  </span>;
}

export function ElectionSummary({leader,personal,atRisk,remaining}:{
  leader?:RankedCandidate; personal?:RankedCandidate; atRisk:boolean; remaining:number;
}) {
  return <>
    <span className="election-heading">
      <span dir="ltr">Pesquisa Eleitoral</span>
      <span className="election-clock" dir="ltr" hidden={!remaining}><small className="sr-only">Renovação em</small>
        <strong id="election-timer">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</strong>
      </span>
    </span>
    <span id="election-summary">
      {leader && <ElectionStanding candidate={leader} atRisk={atRisk && !personal}/>}
      {personal && <ElectionStanding candidate={personal} personal atRisk={atRisk}/>}
    </span>
  </>;
}

export function ElectionPolls({election,id}:{election:ElectionView; id:string}) {
  const readOnly = useDialogKeys<HTMLDivElement>(key=>key.toLowerCase()==='l' ? ()=>readOnly.current?.closest('dialog')?.close() : undefined,[
    {name:'Fechar pesquisa eleitoral',activate:()=>readOnly.current?.closest('dialog')?.close()},
  ]);
  const standings = pollStandings(election.polls);
  const risk = election.remaining>0 && standings.length>ELECTION_RULES.minimumMandates;
  return <>
    <DialogHeader id="election-poll-title" title="Pesquisa Eleitoral" dismissLabel="Fechar pesquisa eleitoral"/>
    <div ref={readOnly} className="election-poll-content">
      <section id="election-polls" aria-labelledby="election-poll-title">
        <p>{risk ? 'A menor intenção de voto indica risco de perder o mandato. Empatados na última posição compartilham esse risco.' : standings.length<=ELECTION_RULES.minimumMandates ? 'Ninguém corre risco: o Congresso já está no mínimo de mandatos.' : 'Não há renovação de mandatos pendente.'}</p>
        <ol className="election-candidates" role="list">
          {standings.map(({candidate,rank,tied})=><li key={candidate.id}>
            <ElectionCandidateCard character={candidate.character} rank={rank}
              name={candidate.name+(candidate.id===id ? ' (você)' : '')} percentage={candidate.estimate}
              trend={candidate.trend} note={<>{tied && <small className="poll-tie"> (Empate)</small>}{risk && rank===standings.at(-1)?.rank && <small className="poll-lost"> · Em risco de perder o mandato</small>}</>}/>
          </li>)}
        </ol>
      </section>
    </div>
  </>;
}

export function ElectionIndicator({summary,urgency,open}:{
  summary?:Parameters<typeof ElectionSummary>[0]; urgency?:'soon'|'high'; open:()=>boolean;
}) {
  return <div id="election-dock" className="hud-strip hud-module" hidden={!summary} data-urgency={urgency} data-at-risk={summary?.atRisk || undefined}>
    {summary && <HudHelp id="open-election-polls" help="Veja a intenção de voto e quem corre risco de perder o mandato. (L)" aria-keyshortcuts="L" className="hud-option"
      dir="rtl" aria-label="Pesquisa eleitoral" aria-describedby="election-summary" aria-haspopup="dialog" onClick={open}>
      <ElectionSummary {...summary}/>
    </HudHelp>}
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
      const leader = standing?.rank===1 ? standing : standings[0];
      const personal = standing && standing.rank!==1 ? standing : undefined;
      const toRankedCandidate = (entry:typeof standing):RankedCandidate|undefined => entry &&
        {name:entry.candidate.name,character:entry.candidate.character,rank:entry.rank};
      const atRisk = view.phase!=='finished' && remaining>0 && !!standing && standing.rank===standings.at(-1)?.rank && standings.length>ELECTION_RULES.minimumMandates;
      const summary = {leader:toRankedCandidate(leader),personal:toRankedCandidate(personal),atRisk,
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
