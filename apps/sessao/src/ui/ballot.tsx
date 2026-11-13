import type {CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';
import type {PlenaryView,Vote} from '../plenary';

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

export function mountBallot(host:HTMLElement,cast:(vote:Vote)=>void) {
  const root = createRoot(host);
  let key = '';
  return {
    render(view:PlenaryView) {
      const hearing = view.hearing;
      const visible = view.phase==='ballot' || !!hearing;
      host.hidden = !visible;
      const state:BallotState|null = visible ? {
        hearing:!!hearing, eligible:!!view.mandate && !view.politics?.suspended, mandate:!!view.mandate,
        voted:view.voted, electorate:view.electorate,
        quorum:hearing ? Math.floor(view.electorate/2)+1 : view.billQuorum,
        vote:hearing?.vote ?? view.vote,
      } : null;
      const next = JSON.stringify(state);
      if (next===key) return;
      key = next;
      root.render(state && <Ballot {...state} cast={cast}/>);
    },
    destroy() { root.unmount(); host.hidden = true; },
  };
}
