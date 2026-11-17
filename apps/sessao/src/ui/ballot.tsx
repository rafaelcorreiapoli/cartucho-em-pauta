import {billVoteKeys,cassationChoices,hearingVoteLabels,projectVoteLabels} from './ballot-shortcuts';
import type {CSSProperties} from 'react';
import {PhoneContactFace} from './phone-call';
import {ProjectBallot} from './project-ballot';
import {majorityQuorum,type BillVote,type CassationView,type PlenaryView,type Vote} from '../plenary';

type BallotState = {
  hearing:boolean; eligible:boolean; mandate:boolean; voted:number;
  electorate:number; quorum:number; vote?:Vote;
};

export function Ballot({hearing,eligible,mandate,voted,electorate,quorum,vote,cast}:BallotState & {cast:(vote:Vote)=>void}) {
  const options = hearing ? hearingVoteLabels : {yes:'Aprovar',no:'Rejeitar'};
  const maximum = Math.max(1,electorate);
  return <div id="ballot">
    <div className="ballot-progress">
      <p id="quorum">{eligible
        ? `${voted}/${electorate} votaram · ${quorum} ${quorum===1 ? 'voto' : 'votos'} a favor para ${options.yes.toLowerCase()}`
        : mandate ? 'Você está afastado da votação.' : 'Ex-parlamentar · Sem direito a voto.'}</p>
      <p id="vote-state" role="status" hidden={!vote}>{vote && `Seu voto: ${options[vote].toLowerCase()}`}</p>
      <progress id="vote-progress" className="animated-progress" aria-label="Participação na votação" max={maximum} value={voted}
        style={{'--meter-ratio':Math.min(1,voted/maximum)} as CSSProperties}/>
    </div>
    <div className="station-grid">
      {(['yes','no'] as const).map(choice=><button key={choice} className={choice==='yes' ? 'hud-button' : 'hud-button hud-button--secondary'}
        data-vote={choice} aria-pressed={choice===vote} aria-keyshortcuts={billVoteKeys[choice]} type="button" disabled={!eligible} onClick={()=>cast(choice)}>
        <svg className="hud-glyph" aria-hidden="true"><use href={choice==='yes' ? '#icon-check' : '#icon-cross'}/></svg>
        <span>{options[choice]}</span>
      </button>)}
    </div>
  </div>;
}

export function CassationBallot({state,ownId,cast}:{
  state:CassationView; ownId:string; cast:(candidate:string|null)=>void;
}) {
  const {candidates,skipKey} = cassationChoices(state,ownId);
  return <section className="cassation-ballot" aria-label="Votação de cassação">
    <p>{state.voted}/{state.electorate} votaram · {state.quorum} votos para cassar</p>
    <div className="cassation-candidates">
      {candidates.map(({person,key})=><button key={person.id}
        type="button" className="hud-button hud-button--secondary" disabled={!state.eligible}
        aria-keyshortcuts={key} aria-pressed={state.choice===person.id} onClick={()=>cast(person.id)}>
        <PhoneContactFace person={person}/><span>{person.name}</span>{key && <kbd className="action-key" aria-hidden="true">{key}</kbd>}
      </button>)}
    </div>
    <button type="button" className="hud-button hud-button--secondary" disabled={!state.eligible}
      aria-keyshortcuts={skipKey} aria-pressed={state.choice===null} onClick={()=>cast(null)}>Pular voto <kbd className="action-key" aria-hidden="true">{skipKey}</kbd></button>
    {!state.eligible && <p>Você pode acompanhar a votação.</p>}
  </section>;
}

export function hearingBallotState(view:PlenaryView):BallotState|null {
  const {hearing,mandate,politics,electorate} = view;
  if (!hearing) return null;
  return {
    hearing:true, eligible:!!mandate && !politics?.suspended, mandate:!!mandate,
    electorate,voted:hearing.voted,quorum:hearing.quorum ?? majorityQuorum(electorate),vote:hearing.vote,
  };
}

export function sessionBallotState(view:PlenaryView) {
  if (view.phase==='ballot') {
    const {round,project,proposer,remaining,budget,yes,no,billQuorum,billVoters,vote,mandate,politics} = view;
    return {kind:'project' as const,state:{round,project,proposer,remaining,budget,yes,no,billQuorum,billVoters,vote,
      eligible:!!mandate && !politics?.suspended}};
  }
  if (view.cassation) return {kind:'cassation' as const,state:view.cassation};
  const hearing = hearingBallotState(view);
  return hearing && {kind:'hearing' as const,state:hearing};
}

export function SessionBallot({state,ownId,cast,castCassation,onExpansion}:{
  state:NonNullable<ReturnType<typeof sessionBallotState>>;
  ownId:string; onExpansion?:(expanded:boolean)=>void; cast:(vote:BillVote)=>void; castCassation:(candidate:string|null)=>void;
}) {
  if (state.kind==='project') return <ProjectBallot key={state.state.round} {...state.state} ownId={ownId} cast={cast} onExpansion={onExpansion}/>;
  if (state.kind==='cassation') return <CassationBallot state={state.state} ownId={ownId} cast={castCassation}/>;
  return <Ballot {...state.state} cast={cast}/>;
}

export function ballotShortcut(view:PlenaryView,ownId:string,key:string,expanded:boolean) {
  const ballot = sessionBallotState(view);
  if (!ballot?.state.eligible) return;
  if (ballot.kind==='cassation') {
    const {candidates,skipKey} = cassationChoices(ballot.state,ownId);
    if (key===skipKey) return {kind:'cassation',candidate:null} as const;
    const choice = candidates.find(candidate=>candidate.key===key);
    if (choice) return {kind:'cassation',candidate:choice.person.id} as const;
    return;
  }
  if (ballot.kind==='project' && !expanded) return;
  const vote = (Object.keys(billVoteKeys) as BillVote[]).find(vote=>billVoteKeys[vote]===key.toUpperCase());
  if (vote && (vote!=='abstain' || ballot.kind==='project')) return {kind:'bill',vote} as const;
}

export function ballotPalette(view:PlenaryView,ownId:string,expanded:boolean) {
  const ballot = sessionBallotState(view);
  if (!ballot?.state.eligible || ballot.kind==='project' && !expanded) return [];
  if (ballot.kind==='cassation') return [
    ...cassationChoices(ballot.state,ownId).candidates.map(({person})=>({name:person.name,candidate:person.id})),
    {name:'Pular voto',candidate:null},
  ];
  if (ballot.kind==='hearing') return (['yes','no'] as const).map(vote=>({name:hearingVoteLabels[vote],vote}));
  return (['yes','no','abstain'] as const).map(vote=>({name:projectVoteLabels[vote],vote}));
}
