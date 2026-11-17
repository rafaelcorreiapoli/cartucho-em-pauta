import {createRoot} from 'react-dom/client';
import {memo} from 'react';
import {ProjectDetails,projectDetailsState} from './ui/project-intents';
import {ProjectHeading,projectHeading} from './ui/project-heading';
import {VoteBrief,VoteHistory} from './ui/vote-history';
import {ProjectImpact} from './ui/project-impact';
import {SessionBallot,ballotShortcut,sessionBallotState} from './ui/ballot';
import type {createRoomCommandSender} from './room-commands';
import {mountLobbyControls} from './ui/lobby-controls';
import type {Outcome,PlenaryView} from './plenary';

const element = (id:string) => document.getElementById(id)!;
const History = memo(VoteHistory);
const showProposal = (phase:PlenaryView['phase']) => phase==='negotiation' || phase==='ballot' || phase==='hearing';
const showImpact = (view:PlenaryView) => showProposal(view.phase) && view.project!==undefined &&
  view.phase!=='ballot' && !view.hearing && !view.cassation;

export function LegislativeDock({view,brief,outcomes,id,command,onExpansion}:{
  view:PlenaryView; brief?:Outcome; outcomes:readonly Outcome[];
  id:string; command:ReturnType<typeof createRoomCommandSender>; onExpansion?:(expanded:boolean)=>void;
}) {
  const matchId = view.politics?.progression.matchId;
  const ballot = sessionBallotState(view);
  const impact = showImpact(view);
  return <>
    <div id="project-outcome-brief" role="status" hidden={!brief} data-passed={brief ? String(brief.passed) : undefined}>
      {brief && <VoteBrief outcome={brief}/>}
    </div>
    <div id="proposal" hidden={!showProposal(view.phase)}>
      <div id="project-heading" className="deck-project-heading">
        {view.phase!=='ballot' && <ProjectHeading {...projectHeading(view)}/>}
      </div>
      <div className="deck-project-controls">
        <div id="impact" aria-label="Impacto de cada decisão" hidden={!impact}>
          {impact && <ProjectImpact yes={view.yes} no={view.no}/>}
        </div>
        <div id="ballot-host" hidden={!ballot}>
          {ballot && <SessionBallot key={matchId} state={ballot} ownId={id} onExpansion={onExpansion}
            cast={vote=>command('bill-vote',{vote})}
            castCassation={candidate=>command('cassation-vote',{candidate})}/>}
        </div>
      </div>
    </div>
    <div className="deck-project-links">
      <details id="project-details" name="game-panels">
        <summary><svg className="hud-glyph" aria-hidden="true"><use href="#icon-document"/></svg><span>Detalhes</span></summary>
        <div id="project-details-content" className="hud-panel deck-popover">
          <ProjectDetails view={view} id={id} declare={vote=>command('bill-intent',{vote})}/>
        </div>
      </details>
      <details id="vote-history" className="hud-module" name="game-panels" hidden={!outcomes.length} key={matchId}>
        {outcomes.length>0 && <History outcomes={outcomes}/>}
      </details>
    </div>
  </>;
}

export function createPlenaryPanel(id:string, command:ReturnType<typeof createRoomCommandSender>,assetsReady:()=>boolean,back:()=>void) {
  const lobby = mountLobbyControls(element('lobby-controls'),id,{
    changeNpcCount:count=>command('lobby-npc-count',{count}),
    start:infiltrators=>{ if (assetsReady()) command('start-match',{infiltrators}); },
    back,
  });
  const root = createRoot(element('legislative-dock'));
  const match = element('match');
  let view:PlenaryView|undefined;
  let outcomes:readonly Outcome[] = [];
  let brief:Outcome|undefined;
  let timer:number|undefined;
  let key = '';
  let expanded = true;
  const onExpansion = (next:boolean)=>{ expanded = next; };

  function clearBrief() {
    window.clearTimeout(timer);
    brief = undefined;
  }

  function renderDock(next:PlenaryView) {
    const nextKey = JSON.stringify([next.politics?.progression.matchId,brief?.round,outcomes.length,
      next.phase,projectHeading(next),projectDetailsState(next),next.mandate,next.politics?.suspended,next.voteIntents,
      next.project,next.cassationIn,showImpact(next) && [next.yes,next.no],sessionBallotState(next)]);
    if (nextKey===key) return;
    key = nextKey;
    root.render(<LegislativeDock view={next} brief={brief} outcomes={outcomes} id={id} command={command} onExpansion={onExpansion}/>);
  }

  return {
    voteByKey(key:string) {
      if (!view) return false;
      const action = ballotShortcut(view,id,key,expanded);
      if (!action) return false;
      if (action.kind==='bill') command('bill-vote',{vote:action.vote});
      else command('cassation-vote',{candidate:action.candidate});
      return true;
    },
    render(next:PlenaryView) {
      const sameMatch = next.politics?.progression.matchId===view?.politics?.progression.matchId;
      const historyChanged = !sameMatch || next.outcomes.length!==outcomes.length;
      if (!sameMatch || !next.outcomes.length || next.phase==='ballot' || next.phase==='hearing' && view?.phase!=='hearing') clearBrief();
      if (sameMatch && view && next.outcomes.length>outcomes.length && next.outcome &&
          (next.phase==='negotiation' || next.phase==='finished')) {
        clearBrief();
        brief = next.outcome;
        timer = window.setTimeout(()=>{
          clearBrief();
          if (view) renderDock(view);
        },8500);
      }
      if (!sameMatch || view?.phase!==next.phase || view.round!==next.round) expanded = true;
      if (historyChanged) outcomes = next.outcomes;
      view = next;
      lobby.render(next,assetsReady());
      match.hidden = next.phase==='lobby';
      renderDock(next);
    },
    destroy() { clearBrief(); lobby.destroy(); root.unmount(); },
  };
}
