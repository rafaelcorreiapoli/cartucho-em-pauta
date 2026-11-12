import { offices } from './elections';
import { NAMES, type Player } from './map';
import { AGENDA_REWARD, agendas, money } from './politics';
import type { PlenaryView } from './plenary';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

export function createMatchHud(id:string) {
  const session = element('session');
  const agendaSummary = element('agenda-dock').querySelector('summary')!;
  const notices = element('hud-notices');
  const compact = element<HTMLButtonElement>('compact-hud');
  const stations = element('stations');
  const shortcuts = element('station-shortcuts');
  const stationActions = [...stations.querySelectorAll<HTMLButtonElement>('[data-action]')];
  const quickActions = [
    {target:'grant',panel:'trade-dock',label:'Verba do gabinete'},
    {target:'campaign',label:'Campanha · R$ 20 mil'},
    {target:'hearing-target',panel:'trade-dock',label:'Convocar cassação'},
    {target:'publish',panel:'politics-dock',label:'Divulgar evidência'},
    {target:'advertise',label:'Propaganda · R$ 20 mil'},
    {target:'speech',label:'Discursar'},
    {target:'interview',label:'Entrevista'},
    {target:'object',label:'Contestar projeto'},
  ].map(action => {
    const control = element<HTMLButtonElement>(action.target);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hud-button hud-button--secondary';
    button.textContent = action.label;
    button.onclick = () => {
      if (action.panel) {
        element<HTMLDetailsElement>(action.panel).open = true;
        const field = control.closest('form')?.querySelector<HTMLElement>('.game-choice');
        field?.focus();
      } else control.click();
    };
    shortcuts.append(button);
    return {button,control};
  });
  const timers = new Map<HTMLElement,number>();
  let previous:PlenaryView | undefined;

  element<HTMLDetailsElement>('profile-dock').open = false;
  element<HTMLDetailsElement>('agenda-dock').open = false;
  try { session.classList.toggle('compact-hud',localStorage.getItem('sessao-compact-hud')==='true'); } catch {}
  compact.setAttribute('aria-pressed',String(session.classList.contains('compact-hud')));
  compact.onclick = () => {
    const enabled = session.classList.toggle('compact-hud');
    compact.setAttribute('aria-pressed',String(enabled));
    try { localStorage.setItem('sessao-compact-hud',String(enabled)); } catch {}
  };

  function remove(node:HTMLElement) {
    window.clearTimeout(timers.get(node));
    timers.delete(node);
    node.remove();
  }

  function notify(title:string, text:string, critical=false) {
    const current = [...timers.keys()];
    if (current.length>=2) {
      const replaceable = current.find(node => node.dataset.critical==='false');
      if (!critical && !replaceable) return;
      remove(replaceable ?? current[0]);
    }
    const node = document.createElement('div');
    node.className = 'hud-module hud-notice';
    node.dataset.critical = String(critical);
    const heading = document.createElement('strong');
    heading.textContent = title;
    const description = document.createElement('span');
    description.textContent = text;
    node.append(heading,description);
    notices.append(node);
    timers.set(node,window.setTimeout(() => remove(node),critical ? 7000 : 4500));
  }

  function actions(view:PlenaryView | undefined = previous) {
    const exploring = view?.phase==='negotiation';
    for (const {button,control} of quickActions) {
      const electionAction = Boolean(control.closest('#election-dock'));
      button.hidden = !exploring || control.disabled || !!control.closest('[hidden]') ||
        (electionAction && !view.election?.canCampaign) ||
        (control.id==='publish' && !element('evidence').dataset.value);
    }
    stations.hidden = !exploring || ![...stationActions,...quickActions.map(action => action.button)]
      .some(button => !button.hidden && !button.disabled);
  }

  return {
    render(view:PlenaryView) {
      const politics = view.politics;
      if (politics) {
        const office = view.election?.personal?.office;
        const label = element('hud-office');
        label.textContent = office ? offices[office].name : 'Assessor';
        label.dataset.office = office ?? 'advisor';
        element('hud-wallet').textContent = money(politics.wallet);
        element('hud-popularity').textContent = String(politics.popularity);
        const {current,target} = politics.agendaProgress;
        const progress = politics.agenda==='fortuna' ? `${money(current)} / ${money(target)}` : `${current}/${target}`;
        const status = politics.goalMet ? 'Cumprida' : progress;
        element('agenda-progress').textContent = status;
        agendaSummary.setAttribute('aria-label',`Agenda pessoal · ${status}`);
        element('agenda').textContent = agendas[politics.agenda];
        element('agenda-mission').dataset.done = String(politics.goalMet);
        element('mission-progress').textContent = politics.agendaPaid ? 'Prêmio recebido' : politics.goalMet ? 'Meta atingida' : progress;
        element('mission-reward').textContent = `+${money(AGENDA_REWARD)}`;
        element('profile-agenda').textContent = `Agenda pessoal · ${agendas[politics.agenda]}`;
      }

      if (previous) {
        const past = previous.politics;
        const notice = view.election?.notice;
        if (notice && notice.seq!==previous.election?.notice?.seq && !view.election?.broadcast) {
          notify(view.election?.result?.cycle!==previous.election?.result?.cycle ? 'Resultado eleitoral' : 'Eleições',notice.text);
        }
        if (view.phase!==previous.phase && (view.phase==='ballot' || view.phase==='hearing')) {
          notify('Votação aberta',element('bill').textContent ?? '',true);
        }
        if (view.stability<45 && previous.stability>=45) notify('Estabilidade abaixo da meta',`${view.stability} de 100`,true);
        if (view.reportedFraud && !previous.reportedFraud) notify('Fraude denunciada','O painel mostra os números reais.',true);
        else if (view.audit==='fraud' && previous.audit!=='fraud') notify('Fraude encontrada','Vá ao Painel para corrigir os números.',true);
        if (politics && past && politics.wallet!==past.wallet) {
          const change = politics.wallet-past.wallet;
          notify('Carteira atualizada',`${change>0 ? '+' : '−'}${money(Math.abs(change))}`);
        }
        if (politics?.goalMet && past && !past.goalMet) notify('Agenda cumprida',agendas[politics.agenda]);
      }
      previous = view;
      actions(view);
    },
    players(players:Player[]) {
      const own = players.find(player => player.id===id);
      if (own) {
        element('hud-nick').textContent = own.nick;
        element('hud-portrait').style.setProperty('--portrait-row',String(own.character*3));
        element('hud-skin').textContent = `Skin · ${NAMES[own.character]}`;
      }
      actions();
    },
    destroy() {
      for (const node of timers.keys()) remove(node);
      shortcuts.replaceChildren();
    },
  };
}
