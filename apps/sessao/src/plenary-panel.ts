import {mountProjectHeading} from './ui/project-heading';
import { mountVoteBrief, mountVoteHistory } from './ui/vote-history';
import {fireRules,fireSites} from './fire';
import {mountProjectImpact} from './ui/project-impact';
import { mountBallot } from './ui/ballot';
import type { createRoomCommandSender } from './room-commands';
import type { Player } from './map';
import { voteIntentSummary, agendaProject, MIN_PLAYERS, canReachStation, type Action, type PlenaryView, type Vote } from './plenary';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const start = element<HTMLButtonElement>('start-match');
const actions = [...document.querySelectorAll<HTMLButtonElement>('[data-action]')];
export function createPlenaryPanel(id:string, command:ReturnType<typeof createRoomCommandSender>) {
  let view: PlenaryView | undefined;
  let own: Player | undefined;
  function countPicker(id:string,initial:number) {
    let selected = initial;
    const buttons = [...element(id).querySelectorAll<HTMLButtonElement>('[data-count]')];
    for (const button of buttons) {
      button.setAttribute('aria-pressed',String(Number(button.dataset.count)===selected));
      button.onclick = ()=>{
        selected = Number(button.dataset.count);
        for (const option of buttons) option.setAttribute('aria-pressed',String(option===button));
      };
    }
    return ()=>selected;
  }
  const infiltrators = countPicker('infiltrator-count',1);
  const npcButtons = [...element('parliamentarian-count').querySelectorAll<HTMLButtonElement>('[data-count]')];
  for (const button of npcButtons) button.onclick = ()=>command('lobby-npc-count',{count:Number(button.dataset.count)});
  const brief = mountVoteBrief(element('project-outcome-brief'));
  start.onclick = () => command('start-match',{infiltrators:infiltrators()});
  for (const button of actions) button.onclick = () => command('plenary-action',{action:button.dataset.action as Action});
  const ballot = mountBallot(element('ballot-host'),vote=>command('bill-vote',{vote}));

  const intentButtons = [...element('intent-controls').querySelectorAll<HTMLButtonElement>('[data-intent]')];
  for (const button of intentButtons) {
    button.onclick = ()=>command('bill-intent',{vote:button.dataset.intent as Vote|'clear'});
  }

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

      if (next.phase!==view?.phase && (next.phase==='ballot' || next.phase==='hearing')) {
        brief.clear();
      }
      const matchId = next.politics?.progression.matchId;
      const sameMatch = matchId===view?.politics?.progression.matchId;
      const historyChanged = !sameMatch || next.outcomes.length!==view?.outcomes.length;
      if (!sameMatch || !next.outcomes.length) brief.clear();
      if (sameMatch && view && next.outcomes.length>view.outcomes.length && next.outcome && (next.phase==='negotiation' || next.phase==='finished' || next.phase==='ballot')) {
        brief.render(next.outcome);
      }
      view = next;
      const {phase,role,players,host} = view;
      const hearing = view.hearing;
      const running = phase==='negotiation' || phase==='ballot' || phase==='hearing';
      element('infiltrator-setup').hidden = running || host!==id || players<6;
      element('parliamentarian-setup').hidden = running;
      const npcCount = view.lobbyNpcCount ?? 2;
      for (const button of npcButtons) {
        button.disabled = running || host!==id;
        button.setAttribute('aria-pressed',String(Number(button.dataset.count)===npcCount));
      }
      start.hidden = running || host!==id;
      const minimum = view.minimumPlayers ?? MIN_PLAYERS;
      start.disabled = players<minimum;
      const startLabel = phase==='finished' ? 'Jogar de novo' : 'Iniciar sessão';
      if (start.firstChild?.textContent?.trim()!==startLabel && start.firstChild) start.firstChild.textContent = startLabel+' ';
      element('start-hint').textContent = running ? '' : players<minimum ? `${players}/${minimum} jogadores para iniciar` :
        host!==id ? 'Aguardando quem criou a sala iniciar a sessão.' : '';
      element('match').hidden = phase==='lobby';
      element('proposal').hidden = !running;
      const sessionResult = element('project-session-result');
      sessionResult.hidden = phase!=='finished';
      sessionResult.textContent = phase==='finished' ?
        [view.winner && (view.winner==='Parlamentar' ? 'Os parlamentares venceram.' : 'O infiltrado venceu.'),
          view.reason, view.infiltratorName && `Infiltração: ${view.infiltratorName}.`].filter(Boolean).join(' ') :
        '';
      const crisis = element('active-fire');
      crisis.hidden = !view.fire;
      crisis.textContent = view.fire ? `🔥 ${fireSites[view.fire.site].name} · ${view.fire.remaining} s · ${view.fire.paused ? 'Pausado' : `−${view.fire.damage} de estabilidade a cada ${fireRules.tick/1000} s`}` : '';
      if (running) heading.render(view);
      if (historyChanged) history.render(view.outcomes,matchId);
      const objection = view.election?.objection;
      element('bill-objection').hidden = !objection || !!hearing || !running;
      element('bill-objection').textContent = objection ? `${objection} contestou o projeto: aprovação exige ${view.billQuorum} votos.` : '';
      element('hearing-result').hidden = !view.hearingResult;
      if (element('hearing-result').textContent!==view.hearingResult) element('hearing-result').textContent = view.hearingResult ?? '';
      const intents = voteIntentSummary(view.voteIntents);
      const intentSummary = element('intent-summary');
      intentSummary.hidden = !intents || !!hearing;
      intentSummary.textContent = intents;
      element('intent-controls').hidden = phase!=='negotiation' || !view.mandate || !!view.politics?.suspended;
      const ownIntent = view.voteIntents?.find(intent=>intent.id===id)?.vote;
      for (const button of intentButtons) {
        button.setAttribute('aria-pressed',String(button.dataset.intent===ownIntent));
        if (button.dataset.intent==='clear') button.hidden = !ownIntent;
      }
      const title = hearing?.target ?? agendaProject(view).name;
      element('project-details-title').textContent = title;
      element('bill-description').textContent = hearing ? '' : agendaProject(view).description;
      impact.render(view.yes,view.no,running && !hearing);
      ballot.render(view);
      actions.find(button => button.dataset.action==='panel')!.hidden = view.audit!=='fraud' || view.reportedFraud;
      actions.find(button => button.dataset.action==='fraud')!.hidden = !view.canFraud;
      const clue = [view.auditNote ?? '', view.amended ? 'Emenda protocolada. Os efeitos já estão atualizados.' : '',
        view.reportedFraud ? 'Fraude denunciada. O painel mostra os números reais.' :
        view.audit==='fraud' ? 'Fraude encontrada. Vá ao Painel para corrigir os números.' :
        view.audit==='clean' ? 'A auditoria conferiu os valores do painel.' : '',
        role==='Infiltrado' && !view.canFraud && !view.reportedFraud ? 'Você alterou os números que os outros veem no painel.' : '',
      ].filter(Boolean).join(' ');
      element('clue').hidden = !clue || !!hearing;
      if (element('clue').textContent!==clue) element('clue').textContent = clue;
      updateActions();
    },
    destroy() { brief.destroy(); history.destroy(); ballot.destroy(); impact.destroy(); heading.destroy(); },
    players(players:Player[]) {
      own = players.find(player => player.id===id);
      updateActions();
    },
  };
}
