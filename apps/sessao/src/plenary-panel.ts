import {mountProjectDetails} from './ui/project-intents';
import {mountProjectHeading} from './ui/project-heading';
import { mountVoteBrief, mountVoteHistory } from './ui/vote-history';
import {mountProjectImpact} from './ui/project-impact';
import { mountBallot } from './ui/ballot';
import type { createRoomCommandSender } from './room-commands';
import { mountLobbyControls } from './ui/lobby-controls';
import type { PlenaryView } from './plenary';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
export function createPlenaryPanel(id:string, command:ReturnType<typeof createRoomCommandSender>,assetsReady:()=>boolean,back:()=>void) {
  let view: PlenaryView | undefined;
  const lobby = mountLobbyControls(element('lobby-controls'),id,{
    changeNpcCount:count=>command('lobby-npc-count',{count}),
    start:infiltrators=>{ if (assetsReady()) command('start-match',{infiltrators}); },
    back,
  });
  const brief = mountVoteBrief(element('project-outcome-brief'));
  const ballot = mountBallot(element('ballot-host'),vote=>command('bill-vote',{vote}),
    candidate=>command('cassation-vote',{candidate}),id);

  const details = mountProjectDetails(element('project-details-content'),id,vote=>command('bill-intent',{vote}));

  const heading = mountProjectHeading(element('project-heading'));
  const impact = mountProjectImpact(element('impact'));
  const history = mountVoteHistory(element<HTMLDetailsElement>('vote-history'));

  return {
    render(next:PlenaryView) {

      if (next.phase==='ballot' || next.phase!==view?.phase && next.phase==='hearing') {
        brief.clear();
      }
      const matchId = next.politics?.progression.matchId;
      const sameMatch = matchId===view?.politics?.progression.matchId;
      const historyChanged = !sameMatch || next.outcomes.length!==view?.outcomes.length;
      if (!sameMatch || !next.outcomes.length) brief.clear();
      if (sameMatch && view && next.outcomes.length>view.outcomes.length && next.outcome && (next.phase==='negotiation' || next.phase==='finished')) {
        brief.render(next.outcome);
      }
      view = next;
      const {phase,hearing} = view;
      const running = phase==='negotiation' || phase==='ballot' || phase==='hearing';
      lobby.render(view,assetsReady());
      element('match').hidden = phase==='lobby';
      element('proposal').hidden = !running;
      if (running && phase!=='ballot') heading.render(view);
      if (historyChanged) history.render(view.outcomes,matchId);
      details.render(view);
      impact.render(view.yes,view.no,running && view.project!==undefined && phase!=='ballot' && !hearing && !view.cassation);
      ballot.render(view);
    },
    destroy() { lobby.destroy(); brief.destroy(); history.destroy(); ballot.destroy(); impact.destroy(); heading.destroy(); details.destroy(); },
  };
}
