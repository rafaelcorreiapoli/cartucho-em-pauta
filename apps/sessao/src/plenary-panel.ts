import type { Player } from './map';
import { bills, MIN_PLAYERS, stations, STATION_RADIUS, type Action, type Impact, type PlenaryView, type Vote } from './plenary';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const start = element<HTMLButtonElement>('start-match');
const actions = [...document.querySelectorAll<HTMLButtonElement>('[data-action]')];
const votes = [...document.querySelectorAll<HTMLButtonElement>('[data-vote]')];
const signed = (value:number) => value>0 ? '+'+value : String(value);
const impact = (effect:Impact) => `${signed(effect.stability)} estabilidade, ${signed(effect.budget)} orçamento`;

export function createPlenaryPanel(id:string, send:(type:string, data?:string|number) => void) {
  let view: PlenaryView | undefined;
  let own: Player | undefined;
  const count = element<HTMLSelectElement>('infiltrator-count');
  count.value = '1';
  start.onclick = () => send('start-match',count.value==='2' ? 2 : 1);
  for (const button of actions) button.onclick = () => send('plenary-action',button.dataset.action);
  for (const button of votes) button.onclick = () => send('bill-vote',button.dataset.vote);

  function updateActions() {
    for (const button of actions) {
      const action = button.dataset.action as Action;
      const station = stations[action==='fraud' ? 'panel' : action];
      button.disabled = !own || Math.hypot(own.x-station.x,own.y-station.y)>STATION_RADIUS ||
        (action==='amendment' && !!view?.amended);
    }
  }


  return {
    render(next:PlenaryView) {
      view = next;
      const {phase,remaining,role,players,host,outcome,round} = view;
      const hearing = view.hearing;
      const running = phase==='negotiation' || phase==='ballot' || phase==='hearing';
      element('infiltrator-setup').hidden = running || host!==id || players<6;
      start.hidden = running || host!==id;
      start.disabled = players<MIN_PLAYERS;
      start.textContent = phase==='finished' ? 'Jogar de novo' : 'Iniciar sessão';
      element('start-hint').textContent = running ? '' : players<MIN_PLAYERS ? 'São necessários pelo menos 3 jogadores.' :
        host!==id ? 'Aguardando quem criou a sala iniciar a sessão.' : '';
      element('briefing').hidden = phase!=='lobby';
      element('match').hidden = phase==='lobby';
      element('proposal').hidden = !running;
      element('role').textContent = role ? `Seu papel: ${role}${running ? role==='Infiltrado' ? ' · Derrube a estabilidade' : ' · Preserve a estabilidade' : ''}` : '';
      element('phase').textContent = phase==='finished' ?
        [view.winner && (view.winner==='Parlamentar' ? 'Os parlamentares venceram.' : 'O infiltrado venceu.'),
          view.reason, view.infiltratorName && `Infiltração: ${view.infiltratorName}.`].filter(Boolean).join(' ') :
        phase==='negotiation' ? 'Articulação · voz por proximidade' : hearing ? 'Cassação · voz geral' : 'Votação · voz geral';
      element('clock').textContent = running ? `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}` : '';
      element('stability').textContent = `Estabilidade: ${view.stability}/100 · meta: 45`;
      element('budget').textContent = `Orçamento: ${view.budget}/100`;
      element('outcome').hidden = !outcome;
      const result = outcome ? `${bills[outcome.round].name}: ${outcome.passed ? 'aprovado' : 'rejeitado'} (${outcome.yes} a favor, ${outcome.no} contra; precisava de ${outcome.needed} a favor).${outcome.deficit ? ` Déficit de ${outcome.deficit}: −${outcome.deficit*2} de estabilidade.` : ''}${outcome.fraud ? ' O painel desse projeto foi fraudado.' : ''}` : '';
      if (element('outcome').textContent!==result) element('outcome').textContent = result;
      element('hearing-result').hidden = !view.hearingResult;
      if (element('hearing-result').textContent!==view.hearingResult) element('hearing-result').textContent = view.hearingResult ?? '';
      element('bill').textContent = hearing ? `Cassação: ${hearing.target}` : `${round+1}/${bills.length} · ${bills[round].name}`;
      element('impact').hidden = !!hearing;
      element('impact').textContent = `Aprovar: ${impact(view.yes)}. Rejeitar: ${impact(view.no)}.`;
      element('stations').hidden = phase!=='negotiation';
      element('ballot').hidden = phase!=='ballot' && !hearing;
      element('quorum').textContent = `${view.voted}/${view.electorate} votaram. ${hearing ? 'Para cassar' : 'Para aprovar'}, são necessários ${Math.floor(view.electorate/2)+1} votos a favor. Você pode mudar seu voto até o fim.`;
      if (view.politics?.suspended) element('quorum').textContent = 'Seu mandato foi cassado. Você pode conversar e agir como assessor.';
      for (const button of votes) {
        button.disabled = !!view.politics?.suspended;
        button.textContent = button.dataset.vote==='yes' ? hearing ? 'Cassar' : 'Aprovar' : hearing ? 'Manter mandato' : 'Rejeitar';
        button.setAttribute('aria-pressed',String((hearing?.vote ?? view.vote)===button.dataset.vote as Vote));
      }
      actions.find(button => button.dataset.action==='panel')!.hidden = view.audit!=='fraud' || view.reportedFraud;
      actions.find(button => button.dataset.action==='fraud')!.hidden = !view.canFraud;
      const clue = [view.auditNote ?? '', view.amended ? 'Emenda protocolada: economiza 16 e reduz o efeito na estabilidade em 8 se o projeto passar.' : '',
        view.reportedFraud ? 'Fraude denunciada. O painel mostra os números reais.' :
        view.audit==='fraud' ? 'Sua auditoria descobriu fraude. Estes são os valores reais. Volte ao painel para avisar todos.' :
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
