import type {CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';
import {PhoneContactFace} from './phone-call';
import {ProjectBallot} from './project-ballot';
import type {BillVote,CassationView,PlenaryView,Vote} from '../plenary';

type BallotState = {
  hearing:boolean; eligible:boolean; mandate:boolean; voted:number;
  electorate:number; quorum:number; vote?:Vote;
};

export function Ballot({hearing,eligible,mandate,voted,electorate,quorum,vote,cast}:BallotState & {cast:(vote:Vote)=>void}) {
  const options = hearing ? {yes:'Afastar',no:'Não afastar'} : {yes:'Aprovar',no:'Rejeitar'};
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
        data-vote={choice} aria-pressed={choice===vote} aria-keyshortcuts={choice==='yes' ? 'Y' : 'R'} type="button" disabled={!eligible} onClick={()=>cast(choice)}>
        <svg className="hud-glyph" aria-hidden="true"><use href={choice==='yes' ? '#icon-check' : '#icon-cross'}/></svg>
        <span>{options[choice]}</span>
      </button>)}
    </div>
  </div>;
}

export function CassationBallot({state,ownId,cast}:{
  state:CassationView; ownId:string; cast:(candidate:string|null)=>void;
}) {
  const candidates = state.candidates.filter(person=>person.id!==ownId);
  const skipKey = candidates.length<9 ? String(candidates.length+1) : '0';
  return <section className="cassation-ballot" aria-label="Votação de cassação">
    <p>{state.voted}/{state.electorate} votaram · {state.quorum} votos para cassar</p>
    <div className="cassation-candidates">
      {candidates.map((person,index)=><button key={person.id}
        type="button" className="hud-button hud-button--secondary" disabled={!state.eligible}
        aria-keyshortcuts={index<9 ? String(index+1) : undefined} aria-pressed={state.choice===person.id} onClick={()=>cast(person.id)}>
        <PhoneContactFace person={person}/><span>{person.name}</span>{index<9 && <kbd>{index+1}</kbd>}
      </button>)}
    </div>
    <button type="button" className="hud-button hud-button--secondary" disabled={!state.eligible}
      aria-keyshortcuts={skipKey} aria-pressed={state.choice===null} onClick={()=>cast(null)}>Pular voto <kbd aria-hidden="true">{skipKey}</kbd></button>
    {!state.eligible && <p>Você pode acompanhar a votação.</p>}
  </section>;
}

export function mountBallot(host:HTMLElement,cast:(vote:BillVote)=>void,castCassation:(candidate:string|null)=>void,ownId:string) {
  const root = createRoot(host);
  let key = '';
  return {
    render(view:PlenaryView) {
      if (view.phase==='ballot') {
        host.hidden = false;
        const {round,project,proposer,remaining,yes,no,billQuorum,billVoters,vote,mandate,politics} = view;
        const state = {round,project,proposer,remaining,yes,no,billQuorum,billVoters,vote,eligible:!!mandate && !politics?.suspended};
        const next = JSON.stringify(state);
        if (next!==key) {
          key = next;
          root.render(<ProjectBallot key={round} {...state} ownId={ownId} cast={cast}/>);
        }
        return;
      }
      const cassation = view.cassation;
      if (cassation) {
        host.hidden = false;
        const next = JSON.stringify(cassation);
        if (next!==key) {
          key = next;
          root.render(<CassationBallot state={cassation} ownId={ownId} cast={castCassation}/>);
        }
        return;
      }
      const hearing = view.hearing;
      const visible = !!hearing;
      host.hidden = !visible;
      const state:BallotState|null = visible ? {
        hearing:!!hearing, eligible:!!view.mandate && !view.politics?.suspended, mandate:!!view.mandate,
        voted:view.voted, electorate:view.electorate,
        quorum:hearing ? Math.floor(view.electorate/2)+1 : view.billQuorum,
        vote:hearing?.vote,
      } : null;
      const next = JSON.stringify(state);
      if (next===key) return;
      key = next;
      root.render(state && <Ballot {...state} cast={cast}/>);
    },
    destroy() { root.unmount(); host.hidden = true; },
  };
}
