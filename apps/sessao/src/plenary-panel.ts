import {mountProjectDetails} from './ui/project-intents';
import {mountProjectHeading} from './ui/project-heading';
import { mountVoteBrief, mountVoteHistory } from './ui/vote-history';
import {mountProjectImpact} from './ui/project-impact';
import { mountBallot } from './ui/ballot';
import type { createRoomCommandSender } from './room-commands';
import type { Player } from './map';
import { mountLobbyControls } from './ui/lobby-controls';
import { canReachStation, type Action, type PlenaryView } from './plenary';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const actions = [...document.querySelectorAll<HTMLButtonElement>('[data-action]')];
export function createPlenaryPanel(id:string, command:ReturnType<typeof createRoomCommandSender>,assetsReady:()=>boolean,back:()=>void) {
  let view: PlenaryView | undefined;
  let own: Player | undefined;
  const lobby = mountLobbyControls(element('lobby-controls'),id,{
    changeNpcCount:count=>command('lobby-npc-count',{count}),
    start:infiltrators=>{ if (assetsReady()) command('start-match',{infiltrators}); },
    back,
  });
  const brief = mountVoteBrief(element('project-outcome-brief'));
  for (const button of actions) button.onclick = () => command('plenary-action',{action:button.dataset.action as Action});
  const ballot = mountBallot(element('ballot-host'),vote=>command('bill-vote',{vote}),
    candidate=>command('cassation-vote',{candidate}),id);

  const details = mountProjectDetails(element('project-details-content'),id,vote=>command('bill-intent',{vote}));

  function updateActions() {
    for (const button of actions) {
      const action = button.dataset.action as Action;
      const nearby = !!own && canReachStation(own,action==='fraud' ? 'panel' : action);
      button.disabled = !nearby || (action==='amendment' && !!view?.amended);
    }

  }

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
      impact.render(view.yes,view.no,running && phase!=='ballot' && !hearing && !view.cassation);
      ballot.render(view);
      actions.find(button => button.dataset.action==='panel')!.hidden = view.audit!=='fraud' || view.reportedFraud;
      actions.find(button => button.dataset.action==='fraud')!.hidden = !view.canFraud;
      updateActions();
    },
    destroy() { lobby.destroy(); brief.destroy(); history.destroy(); ballot.destroy(); impact.destroy(); heading.destroy(); details.destroy(); },
    players(players:Player[]) {
      own = players.find(player => player.id===id);
      updateActions();
    },
  };
}
