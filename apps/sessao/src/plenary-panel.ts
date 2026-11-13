import { money } from './politics';
import type { Player } from './map';
import { bills, MIN_PLAYERS, stations, STATION_RADIUS, type Action, type Impact, type PlenaryView, type Vote } from './plenary';

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

export function createPlenaryPanel(id:string, send:(type:string, data?:string|number|{infiltrators:number;npcs:number}) => void) {
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
  const npcs = countPicker('parliamentarian-count',2);
  const brief = element('project-outcome-brief');
  let briefTimer:number | undefined;
  function clearBrief() {
    window.clearTimeout(briefTimer);
    brief.hidden = true;
  }
  start.onclick = () => send('start-match',{infiltrators:infiltrators(),npcs:npcs()});
  for (const button of actions) button.onclick = () => send('plenary-action',button.dataset.action);
  for (const button of votes) button.onclick = () => send('bill-vote',button.dataset.vote);

  function updateActions() {
    for (const button of actions) {
      const action = button.dataset.action as Action;
      const station = stations[action==='fraud' ? 'panel' : action];
      const nearby = !!own && Math.hypot(own.x-station.x,own.y-station.y)<=STATION_RADIUS;
      button.disabled = !nearby || (action==='amendment' && !!view?.amended);
    }

  }

  const history = element<HTMLDetailsElement>('vote-history');
  const lastVote = element('last-vote');
  const previousVote = element<HTMLButtonElement>('vote-prev');
  const nextVote = element<HTMLButtonElement>('vote-next');
  let selected = 0;

  function renderHistory() {
    const outcomes = view?.outcomes ?? [];
    const outcome = outcomes[selected];
    history.hidden = !outcomes.length;
    if (!outcome) {
      history.open = false;
      return;
    }
    previousVote.disabled = selected===0;
    nextVote.disabled = selected===outcomes.length-1;
    element('vote-history-count').textContent = String(outcomes.length);
    const pages = element('vote-pages');
    pages.setAttribute('aria-label',`Votação ${selected+1} de ${outcomes.length}`);
    pages.replaceChildren(...outcomes.map((_,index) => {
      const dot = document.createElement('span');
      dot.setAttribute('aria-hidden','true');
      dot.dataset.current = String(index===selected);
      return dot;
    }));
    const bill = bills[outcome.round%bills.length].name;
    const verdict = outcome.passed ? 'Passou!' : 'Caiu!';
    lastVote.dataset.result = outcome.passed ? 'passed' : 'failed';
    element('outcome-summary').textContent = verdict;
    element('outcome-bill').textContent = bill;
    for (const side of ['yes','no'] as const) {
      element(`outcome-${side}`).textContent = String(outcome[side]);
    }
    const noVotes = outcome.yes+outcome.no===0;
    const threshold = outcome.needed===1 ? '1 voto a favor para passar' : `${outcome.needed} votos a favor para passar`;
    element('outcome-threshold').textContent = noVotes ? `Ninguém votou · ${threshold}` : threshold;
    const details = [
      `Estabilidade ${signed(outcome.applied.stability)} · Orçamento ${signed(outcome.applied.budget)}`,
      outcome.deficit ? `Déficit: −${outcome.deficit*2} de estabilidade` : '',
      outcome.fraud ? 'O painel foi fraudado' : '',
    ].filter(Boolean);
    element('outcome').textContent = details.join(' · ');
    element('outcome').hidden = !details.length;
  }
  history.open = false;
  previousVote.onclick = () => { selected--; renderHistory(); };
  nextVote.onclick = () => { selected++; renderHistory(); };

  return {
    render(next:PlenaryView) {

      if (next.phase!==view?.phase && (next.phase==='ballot' || next.phase==='hearing')) {
        clearBrief();
      }
      const historyChanged = next.outcomes.length!==view?.outcomes.length;
      if (!next.outcomes.length) clearBrief();
      if (historyChanged && view && next.outcome && (next.phase==='negotiation' || next.phase==='finished')) {
        clearBrief();
        const outcome = next.outcome;
        brief.dataset.passed = String(outcome.passed);
        element('brief-verdict').textContent = outcome.passed ? 'Projeto aprovado' : 'Projeto rejeitado';
        element('brief-project').textContent = bills[outcome.round%bills.length].name;
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
      element('parliamentarian-setup').hidden = running || host!==id;
      start.hidden = running || host!==id;
      const minimum = view.minimumPlayers ?? MIN_PLAYERS;
      start.disabled = players<minimum;
      const startLabel = phase==='finished' ? 'Jogar de novo' : 'Iniciar sessão';
      if (start.firstChild?.textContent?.trim()!==startLabel && start.firstChild) start.firstChild.textContent = startLabel+' ';
      element('start-hint').textContent = running ? '' : players<minimum ? `${players}/${minimum} jogadores para iniciar` :
        host!==id ? 'Aguardando quem criou a sala iniciar a sessão.' : '';
      element('briefing').hidden = phase!=='lobby';
      element('match').hidden = phase==='lobby';
      element('proposal').hidden = !running;
      const sessionResult = element('project-session-result');
      sessionResult.hidden = phase!=='finished';
      sessionResult.textContent = phase==='finished' ?
        [view.winner && (view.winner==='Parlamentar' ? 'Os parlamentares venceram.' : 'O infiltrado venceu.'),
          view.reason, view.infiltratorName && `Infiltração: ${view.infiltratorName}.`].filter(Boolean).join(' ') :
        '';
      element('phase').textContent = phase==='negotiation' ? 'Articulação' : hearing ? 'Afastamento' : 'Votação';
      element('clock').textContent = running ? `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}` : '';
      const clock = element('clock');
      element('clock-label').textContent = phase==='negotiation' ? 'Votação em' : 'Tempo de voto';
      const clockChip = clock.closest<HTMLElement>('.clock-chip')!;
      clockChip.hidden = !running;
      clockChip.dataset.urgent = String(remaining<=10);
      element('stability').textContent = String(view.stability);
      const stability = element<HTMLProgressElement>('stability-meter');
      stability.value = view.stability;
      stability.dataset.low = String(view.stability<45);
      element('budget').textContent = money(view.budget);
      const budgetMeter = element<HTMLProgressElement>('budget-meter');
      budgetMeter.max = Math.max(100,view.budget);
      budgetMeter.value = view.budget;
      if (historyChanged) {
        selected = Math.max(0,view.outcomes.length-1);
        renderHistory();
        const result = view.outcomes[selected];
        element('outcome-announcement').textContent = result ?
          `${bills[result.round%bills.length].name}: ${result.passed ? 'aprovado' : 'rejeitado'}. ${result.yes} a favor, ${result.no} contra.` : '';
      }
      const objection = view.election?.objection;
      element('bill-objection').hidden = !objection || !!hearing || !running;
      element('bill-objection').textContent = objection ? `${objection} contestou o projeto: aprovação exige ${view.billQuorum} votos.` : '';
      element('hearing-result').hidden = !view.hearingResult;
      if (element('hearing-result').textContent!==view.hearingResult) element('hearing-result').textContent = view.hearingResult ?? '';
      element('bill-round').textContent = hearing ? 'Votação de afastamento' : `Projeto ${round+1}`;
      const title = hearing ? hearing.target : bills[round%bills.length].name;
      element('bill').textContent = title;
      element('project-details-title').textContent = title;
      element('bill-description').textContent = hearing ? '' : bills[round%bills.length].description;
      element('impact').hidden = !!hearing;
      showImpact('yes',view.yes);
      showImpact('no',view.no);

      element('ballot').hidden = phase!=='ballot' && !hearing;
      const quorum = hearing ? Math.floor(view.electorate/2)+1 : view.billQuorum;
      element('quorum').textContent = `${view.voted}/${view.electorate} votaram · ${quorum} ${quorum===1 ? 'voto' : 'votos'} a favor para ${hearing ? 'afastar' : 'aprovar'}`;
      const progress = element<HTMLProgressElement>('vote-progress');
      progress.max = Math.max(1,view.electorate);
      progress.value = view.voted;
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
    destroy() { clearBrief(); },
    players(players:Player[]) {
      own = players.find(player => player.id===id);
      updateActions();
    },
  };
}
