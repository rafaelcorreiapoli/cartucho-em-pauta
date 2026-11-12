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

export function createPlenaryPanel(id:string, send:(type:string, data?:string|number) => void) {
  let view: PlenaryView | undefined;
  let own: Player | undefined;
  const count = element<HTMLSelectElement>('infiltrator-count');
  count.value = '1';
  const projects = element<HTMLDetailsElement>('legislative-dock');
  projects.open = true;
  start.onclick = () => send('start-match',count.value==='2' ? 2 : 1);
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

  return {
    render(next:PlenaryView) {
      if (next.phase!==view?.phase && (next.phase==='ballot' || next.phase==='hearing' ||
        next.phase==='finished' || view?.phase==='finished')) projects.open = true;
      const newResult = next.outcome && next.outcome.round!==view?.outcome?.round;
      const lastVote = element('last-vote');
      view = next;
      const {phase,remaining,role,players,host,outcome,round} = view;
      const hearing = view.hearing;
      const running = phase==='negotiation' || phase==='ballot' || phase==='hearing';
      element('infiltrator-setup').hidden = running || host!==id || players<6;
      start.hidden = running || host!==id;
      start.disabled = players<MIN_PLAYERS;
      start.textContent = phase==='finished' ? 'Jogar de novo' : 'Iniciar sessão';
      element('start-hint').textContent = running ? '' : players===1 ? 'Teste solo disponível' :
        host!==id ? 'Aguardando quem criou a sala iniciar a sessão.' : '';
      element('briefing').hidden = phase!=='lobby';
      element('match').hidden = phase==='lobby';
      element('proposal').hidden = !running;
      element('role').textContent = role ?? '';
      element('role-goal').textContent = running ? role==='Infiltrado' ? 'Derrube a estabilidade' : 'Preserve a estabilidade' : '';
      element('role').parentElement!.dataset.role = role ?? '';
      const sessionResult = element('project-session-result');
      sessionResult.hidden = phase!=='finished';
      sessionResult.textContent = phase==='finished' ?
        [view.winner && (view.winner==='Parlamentar' ? 'Os parlamentares venceram.' : 'O infiltrado venceu.'),
          view.reason, view.infiltratorName && `Infiltração: ${view.infiltratorName}.`].filter(Boolean).join(' ') :
        '';
      element('phase').textContent = phase==='negotiation' ? 'Articulação' : hearing ? 'Cassação' : 'Votação';
      element('clock').textContent = running ? `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}` : '';
      const clock = element('clock');
      clock.parentElement!.hidden = !running;
      clock.parentElement!.dataset.urgent = String(remaining<=10);
      element('stability').textContent = String(view.stability);
      const stability = element<HTMLProgressElement>('stability-meter');
      stability.value = view.stability;
      stability.dataset.low = String(view.stability<45);
      element('budget').textContent = String(view.budget);
      element<HTMLProgressElement>('budget-meter').value = view.budget;
      lastVote.hidden = !outcome || phase==='ballot' || phase==='hearing';
      if (outcome && newResult) {
        const bill = bills[outcome.round].name;
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
          outcome.deficit ? `Déficit: −${outcome.deficit*2} de estabilidade` : '',
          outcome.fraud ? 'O painel foi fraudado' : '',
        ].filter(Boolean);
        element('outcome').textContent = details.join(' · ');
        element('outcome').hidden = !details.length;
        element('outcome-announcement').textContent = `${bill}: ${outcome.passed ? 'aprovado' : 'rejeitado'}. ${outcome.yes} a favor, ${outcome.no} contra.`;
      }
      const objection = view.election?.objection;
      element('bill-objection').hidden = !objection || !!hearing || !running;
      element('bill-objection').textContent = objection ? `${objection} contestou o projeto: aprovação exige ${view.billQuorum} votos.` : '';
      element('hearing-result').hidden = !view.hearingResult;
      if (element('hearing-result').textContent!==view.hearingResult) element('hearing-result').textContent = view.hearingResult ?? '';
      element('bill-round').textContent = hearing ? 'Votação de mandato' : `Projeto ${round+1} de ${bills.length}`;
      element('bill').textContent = hearing ? hearing.target : bills[round].name;
      element('impact').hidden = !!hearing;
      showImpact('yes',view.yes);
      showImpact('no',view.no);

      element('ballot').hidden = phase!=='ballot' && !hearing;
      const quorum = hearing ? Math.floor(view.electorate/2)+1 : view.billQuorum;
      element('quorum').textContent = `${view.voted}/${view.electorate} votaram · ${quorum} votos a favor para ${hearing ? 'cassar' : 'aprovar'}`;
      const progress = element<HTMLProgressElement>('vote-progress');
      progress.max = Math.max(1,view.electorate);
      progress.value = view.voted;
      if (view.politics?.suspended) element('quorum').textContent = 'Seu mandato foi cassado. Você pode conversar e agir como assessor.';
      for (const button of votes) {
        button.disabled = !!view.politics?.suspended;
        button.querySelector('span')!.textContent = button.dataset.vote==='yes' ? hearing ? 'Cassar' : 'Aprovar' : hearing ? 'Manter mandato' : 'Rejeitar';
        button.setAttribute('aria-pressed',String((hearing?.vote ?? view.vote)===button.dataset.vote as Vote));
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
    players(players:Player[]) {
      own = players.find(player => player.id===id);
      updateActions();
    },
  };
}
