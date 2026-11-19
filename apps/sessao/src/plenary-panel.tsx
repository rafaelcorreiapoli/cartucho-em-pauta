import {HudHelp} from './ui/hud-help';
import {createRoot} from 'react-dom/client';
import {ProjectDetails,projectDetailsState} from './ui/project-intents';
import {ProjectHeading,projectHeading} from './ui/project-heading';
import {VoteBrief} from './ui/vote-brief';
import {ProjectImpact} from './ui/project-impact';
import {SessionBallot,ballotPalette,ballotShortcut,sessionBallotState} from './ui/ballot';
import type {createRoomCommandSender} from './room-commands';
import {mountLobbyControls} from './ui/lobby-controls';
import type {Outcome,PlenaryView} from './plenary';

const element = (id:string) => document.getElementById(id)!;
const showProposal = (phase:PlenaryView['phase']) => phase==='negotiation' || phase==='ballot' || phase==='hearing';
const showImpact = (view:PlenaryView) => showProposal(view.phase) && view.project!==undefined &&
  view.phase!=='ballot' && !view.hearing && !view.cassation;

export function LegislativeDock({view,brief,id,command,onExpansion}:{
  view:PlenaryView; brief?:Outcome;
  id:string; command:ReturnType<typeof createRoomCommandSender>; onExpansion?:(expanded:boolean)=>void;
}) {
  const matchId = view.politics?.progression.matchId;
  const ballot = sessionBallotState(view);
  if (view.projectVotingEnabled===false) return ballot ? <SessionBallot key={matchId} state={ballot} ownId={id} onExpansion={onExpansion}
    cast={vote=>command('bill-vote',{vote})} castCassation={candidate=>command('cassation-vote',{candidate})}/> : null;
  const impact = showImpact(view);
  return <>
    <HudHelp as="div" help="Resultado da última votação." id="project-outcome-brief" role="status" hidden={!brief} data-passed={brief ? String(brief.passed) : undefined}>
      {brief && <VoteBrief outcome={brief} stabilityEnabled={view.gameMode!=='calote'}/>}
    </HudHelp>
    <div id="proposal" hidden={!showProposal(view.phase)}>
      <HudHelp as="div" help="Projeto em pauta nesta sessão." id="project-heading" className="deck-project-heading">
        {view.phase!=='ballot' && !view.cassation && <ProjectHeading {...projectHeading(view)}/>}
      </HudHelp>
      <div className="deck-project-controls">
        <HudHelp as="div" help="Veja como aprovar ou rejeitar o projeto afeta o Congresso." id="impact" aria-label="Impacto de cada decisão" hidden={!impact}>
          {impact && <ProjectImpact stabilityEnabled={view.gameMode!=='calote'} yes={view.yes} no={view.no}/>}
        </HudHelp>
        <div id="ballot-host" hidden={!ballot}>
          {ballot && <SessionBallot key={matchId} state={ballot} ownId={id} onExpansion={onExpansion}
            cast={vote=>command('bill-vote',{vote})}
            castCassation={candidate=>command('cassation-vote',{candidate})}/>}
        </div>
      </div>
    </div>
    <div className="deck-project-links">
      <details id="project-details" name="game-panels">
        <HudHelp as="summary" help="Consulte o projeto e declare sua intenção de voto."><svg className="hud-glyph" aria-hidden="true"><use href="#icon-document"/></svg><span>Detalhes</span></HudHelp>
        <div id="project-details-content" className="hud-panel deck-popover">
          <ProjectDetails view={view} id={id} declare={vote=>command('bill-intent',{vote})}/>
        </div>
      </details>
    </div>
  </>;
}

export function createPlenaryPanel(id:string, command:ReturnType<typeof createRoomCommandSender>,assetsReady:()=>boolean,back:()=>void) {
  const lobby = mountLobbyControls(element('lobby-controls'),id,{
    changeInitialWallet:value=>command('lobby-initial-wallet',{value}),
    changeGrants:enabled=>command('lobby-grants',{enabled}),
    changeInitialBudget:value=>command('lobby-initial-budget',{value}),
    changeMatchMinutes:value=>command('lobby-match-minutes',{value}),
    changeAutomaticProjects:enabled=>command('lobby-automatic-projects',{enabled}),
    changeGameMode:mode=>command('lobby-game-mode',{mode}),
    changePortraitsAndVip:enabled=>command('lobby-portraits-vip',{enabled}),
    changeDecorations:enabled=>command('lobby-decorations',{enabled}),
    changeSurveillance:enabled=>command('lobby-surveillance',{enabled}),
    changePhotos:enabled=>command('lobby-photos',{enabled}),
    changeElections:enabled=>command('lobby-elections',{enabled}),
    changeProjectVoting:enabled=>command('lobby-project-voting',{enabled}),
    changePhoneGames:enabled=>command('lobby-phone-games',{enabled}),
    changeNpcCount:count=>command('lobby-npc-count',{count}),
    start:(infiltrators,asInfiltrator)=>{ if (assetsReady()) command('start-match',{infiltrators,asInfiltrator}); },
    back,
  });
  const root = createRoot(element('legislative-dock'));
  const match = element('match');
  let view:PlenaryView|undefined;
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
    const nextKey = JSON.stringify([next.politics?.progression.matchId,brief?.round,
      next.phase,next.gameMode,next.projectVotingEnabled,projectHeading(next),projectDetailsState(next),next.mandate,next.politics?.suspended,next.voteIntents,
      next.project,next.cassationIn,showImpact(next) && [next.yes,next.no],sessionBallotState(next)]);
    if (nextKey===key) return;
    key = nextKey;
    root.render(<LegislativeDock view={next} brief={brief} id={id} command={command} onExpansion={onExpansion}/>);
  }

  const ballotIdentity = (current:PlenaryView) => JSON.stringify([current.politics?.progression.matchId,
    current.phase,current.round,current.project,current.hearing?.target,current.cassation?.calledAt,!!current.cassation]);

  return {
    votingShortcuts(canVote:()=>boolean) {
      if (!view || !canVote()) return [];
      const identity = ballotIdentity(view);
      return ballotPalette(view,id,expanded).map(choice=>({name:choice.name,activate:()=>{
        if (!view || !canVote() || ballotIdentity(view)!==identity ||
            !ballotPalette(view,id,expanded).some(current=>JSON.stringify(current)===JSON.stringify(choice))) return;
        if ('vote' in choice) command('bill-vote',{vote:choice.vote});
        else command('cassation-vote',{candidate:choice.candidate});
      }}));
    },
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
      if (!sameMatch || !next.outcomes.length || next.phase==='ballot' || next.phase==='hearing' && view?.phase!=='hearing') clearBrief();
      if (sameMatch && view && next.outcomes.length>view.outcomes.length && next.outcome &&
          (next.phase==='negotiation' || next.phase==='finished')) {
        clearBrief();
        brief = next.outcome;
        timer = window.setTimeout(()=>{
          clearBrief();
          if (view) renderDock(view);
        },8500);
      }
      if (!sameMatch || view?.phase!==next.phase || view.round!==next.round) expanded = true;
      view = next;
      lobby.render(next,assetsReady());
      match.hidden = next.phase==='lobby';
      renderDock(next);
    },
    destroy() { clearBrief(); lobby.destroy(); root.unmount(); },
  };
}
