import { mountVoteHistory } from './ui/vote-history';
import {fireRules,fireSites} from './fire';
import { updateProgress } from './progress-meter';
import type { createRoomCommandSender } from './room-commands';
import type { Player } from './map';
import { voteIntentSummary, agendaProject, MIN_PLAYERS, canReachStation, type Action, type Impact, type PlenaryView, type Vote } from './plenary';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const start = element<HTMLButtonElement>('start-match');
const actions = [...document.querySelectorAll<HTMLButtonElement>('[data-action]')];
const votes = [...document.querySelectorAll<HTMLButtonElement>('[data-vote]')];
const signed = (value:number) => value>0 ? '+'+value : String(value);
function showImpact(prefix:'yes' | 'no', effect:Impact) {
  for (const key of ['stability','budget'] as const) {
    const stat = element(`${prefix}-${key}`);
    stat.textContent = signed(effect[key]);
    stat.dataset.effect = effect[key]>0 ? 'gain' : effect[key]<0 ? 'loss' : 'neutral';
  }
}

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
  const brief = element('project-outcome-brief');
  let briefTimer:number | undefined;
  function clearBrief() {
    window.clearTimeout(briefTimer);
    brief.hidden = true;
  }
  start.onclick = () => command('start-match',{infiltrators:infiltrators()});
  for (const button of actions) button.onclick = () => command('plenary-action',{action:button.dataset.action as Action});
  for (const button of votes) button.onclick = () => command('bill-vote',{vote:button.dataset.vote as Vote});

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

  const history = mountVoteHistory(element<HTMLDetailsElement>('vote-history'));

  return {
    render(next:PlenaryView) {

      if (next.phase!==view?.phase && (next.phase==='ballot' || next.phase==='hearing')) {
        clearBrief();
      }
      const historyChanged = next.outcomes.length!==view?.outcomes.length;
      if (!next.outcomes.length) clearBrief();
      if (historyChanged && view && next.outcome && (next.phase==='negotiation' || next.phase==='finished' || next.phase==='ballot')) {
        clearBrief();
        const outcome = next.outcome;
        brief.dataset.passed = String(outcome.passed);
        element('brief-verdict').textContent = outcome.passed ? 'Projeto aprovado' : 'Projeto rejeitado';
        element('brief-project').textContent = agendaProject(outcome).name;
        element('brief-yes').textContent = String(outcome.yes);
        element('brief-no').textContent = String(outcome.no);
        for (const key of ['stability','budget'] as const) {
          const stat = element(`brief-${key}`);
          const value = outcome.applied[key];
          stat.textContent = signed(value);
          stat.dataset.effect = value>0 ? 'gain' : value<0 ? 'loss' : 'neutral';
        }
        brief.hidden = false;
        briefTimer = window.setTimeout(clearBrief,8500);
      }
      view = next;
      const {phase,remaining,role,players,host,round} = view;
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
      element('phase').textContent = phase==='negotiation' ? 'Articulação' : hearing ? 'Afastamento' : 'Votação';
      element('clock').textContent = running ? `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}` : '';
      const clock = element('clock');
      element('clock-label').textContent = phase==='negotiation' ? 'Votação em' : 'Tempo de voto';
      const clockChip = clock.closest<HTMLElement>('.clock-chip')!;
      clockChip.hidden = !running;
      clockChip.dataset.urgent = String(remaining<=10);
      if (historyChanged) history.render(view.outcomes);
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
      const queued = view.queuedProjects?.length ?? 0;
      element('bill-round').textContent = hearing ? 'Votação de afastamento' : `Projeto ${round+1}${queued ? ` · +${queued} na pauta` : ''}`;
      const title = hearing ? hearing.target : agendaProject(view).name;
      element('bill').textContent = title;
      element('project-details-title').textContent = title;
      element('bill-description').textContent = hearing ? '' : agendaProject(view).description;
      element('impact').hidden = !!hearing;
      showImpact('yes',view.yes);
      showImpact('no',view.no);

      element('ballot').hidden = phase!=='ballot' && !hearing;
      const quorum = hearing ? Math.floor(view.electorate/2)+1 : view.billQuorum;
      element('quorum').textContent = `${view.voted}/${view.electorate} votaram · ${quorum} ${quorum===1 ? 'voto' : 'votos'} a favor para ${hearing ? 'afastar' : 'aprovar'}`;
      const progress = element<HTMLProgressElement>('vote-progress');
      updateProgress(progress,view.voted,Math.max(1,view.electorate));
      if (view.isolationSeconds) {
        element('clock-label').textContent = 'Isolamento';
        const seconds = view.isolationSeconds;
        clock.textContent = `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
        clockChip.dataset.urgent = String(seconds<=10);
      }
      if (!view.mandate || view.politics?.suspended) element('quorum').textContent = view.mandate ? 'Você está afastado da votação.' : 'Ex-parlamentar · Sem direito a voto.';
      const castVote = hearing?.vote ?? view.vote;
      const state = element('vote-state');
      state.hidden = !castVote;
      state.textContent = castVote ? (hearing ?
        castVote==='yes' ? 'Seu voto: afastar' : 'Seu voto: não afastar' :
        castVote==='yes' ? 'Seu voto: aprovar' : 'Seu voto: rejeitar') : '';
      for (const button of votes) {
        button.disabled = !view.mandate || !!view.politics?.suspended;
        button.querySelector('span')!.textContent = button.dataset.vote==='yes' ? hearing ? 'Afastar' : 'Aprovar' : hearing ? 'Não afastar' : 'Rejeitar';
        button.setAttribute('aria-pressed',String(castVote===button.dataset.vote as Vote));
      }
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
    destroy() { clearBrief(); history.destroy(); },
    players(players:Player[]) {
      own = players.find(player => player.id===id);
      updateActions();
    },
  };
}
