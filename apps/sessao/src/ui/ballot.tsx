import {HudHelp} from './hud-help';
import {billVoteKeys,cassationChoices,hearingVoteLabels,projectVoteLabels} from './ballot-shortcuts';
import type {CSSProperties} from 'react';
import {CassationBallot} from './cassation-ballot';
export {CassationBallot} from './cassation-ballot';
import {ProjectBallot} from './project-ballot';
import {majorityQuorum,type BillVote,type PlenaryView,type Vote} from '../plenary';

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
      {(['yes','no'] as const).map(choice=><HudHelp help={choice==="yes" ? "Registre seu voto a favor." : "Registre seu voto contra."} key={choice} className={choice==='yes' ? 'hud-button' : 'hud-button hud-button--secondary'}
        data-vote={choice} aria-pressed={choice===vote} aria-keyshortcuts={billVoteKeys[choice]} disabled={!eligible} onClick={()=>cast(choice)}>
        <svg className="hud-glyph" aria-hidden="true"><use href={choice==='yes' ? '#icon-check' : '#icon-cross'}/></svg>
        <span>{options[choice]}</span>
      </HudHelp>)}
    </div>
  </div>;
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
  if (view.cassation) return {kind:'cassation' as const,state:view.cassation,remaining:view.remaining};
  const hearing = hearingBallotState(view);
  return hearing && {kind:'hearing' as const,state:hearing};
}

export function SessionBallot({state,ownId,cast,castCassation,onExpansion}:{
  state:NonNullable<ReturnType<typeof sessionBallotState>>;
  ownId:string; onExpansion?:(expanded:boolean)=>void; cast:(vote:BillVote)=>void; castCassation:(candidate:string|null)=>void;
}) {
  if (state.kind==='project') return <ProjectBallot key={state.state.round} {...state.state} ownId={ownId} cast={cast} onExpansion={onExpansion}/>;
  if (state.kind==='cassation') return <CassationBallot state={state.state} ownId={ownId} remaining={state.remaining} cast={castCassation}/>;
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
