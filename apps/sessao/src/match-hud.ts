import { offices } from './elections';
import type { Player } from './map';
import { AGENDA_REWARD, agendas, money } from './politics';
import { stations as mapStations, type PlenaryView, type Station } from './plenary';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

export function createMatchHud(id:string, stationFeedback:(station:Station) => void) {
  const roleBadge = element<HTMLButtonElement>('profile-role');
  const roleIcon = roleBadge.querySelector('use')!;
  const agendaSummary = element('agenda-dock').querySelector('summary')!;
  const notices = element('hud-notices');
  const stations = element('stations');
  const shortcuts = element('station-shortcuts');
  const stationHeading = element('station-heading');
  const interviewHint = element('interview-hint');
  const quickActions = [
    {target:'grant',panel:'trade-dock',label:'Aplicar verba',station:'cabinet',icon:'wallet'},
    {target:'campaign',label:'Campanha · R$ 20 mil',station:'press',icon:'star'},
    {target:'hearing-target',panel:'trade-dock',label:'Convocar cassação',station:'panel',icon:'ballot'},
    {target:'publish',panel:'politics-dock',label:'Divulgar evidência',station:'press',icon:'document'},
  ].map(action => {
    const control = element<HTMLButtonElement>(action.target);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hud-button hud-button--secondary';
    button.dataset.station = action.station;
    const label = document.createElement('span');
    label.textContent = action.label;
    const icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
    icon.classList.add('hud-glyph');
    icon.setAttribute('aria-hidden','true');
    const glyph = document.createElementNS(icon.namespaceURI,'use');
    glyph.setAttribute('href','#icon-'+action.icon);
    icon.append(glyph);
    button.append(icon,label);
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
  const stationActions = [...stations.querySelectorAll<HTMLButtonElement>('button[data-station]')];
  function onStationClick(event:MouseEvent) {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-station]');
    if (!button || button.disabled || button.closest('[hidden]')) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      button.animate([
        {filter:'brightness(1.55)',transform:'translateY(4px)'},
        {filter:'brightness(1)',transform:'translateY(0)'},
      ],{duration:230,easing:'ease-out'});
    }
    stationFeedback(button.dataset.station as Station);
  }
  stations.addEventListener('click',onStationClick,true);
  const timers = new Map<HTMLElement,number>();
  let previous:PlenaryView | undefined;

  element<HTMLDetailsElement>('agenda-dock').open = false;
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
      button.hidden = !exploring || control.disabled || !!control.closest('[hidden]') ||
        (control.id==='publish' && !element('evidence').dataset.value);
    }
    const active = stationActions.find(button => !button.disabled && !button.closest('[hidden]:not(#stations)'));
    const station = (active?.dataset.station as Station | undefined) ?? (!interviewHint.hidden ? 'tv' : undefined);
    stations.hidden = !exploring || !station;
    if (station && stationHeading.textContent!==mapStations[station].label) {
      stationHeading.textContent = mapStations[station].label;
    }
  }

  return {
    notify,
    render(view:PlenaryView) {
      const infiltrator = view.role==='Infiltrado';
      roleBadge.hidden = !view.role;
      if (view.role) {
        roleBadge.dataset.role = view.role;
        roleBadge.dataset.help = infiltrator ? 'Infiltrado. Derrube a estabilidade.' : 'Parlamentar. Preserve a estabilidade.';
        roleBadge.setAttribute('aria-label',view.role);
        roleIcon.setAttribute('href',infiltrator ? '#icon-bug' : '#icon-star');
      }
      const politics = view.politics;
      if (politics) {
        const personal = view.election?.personal;
        const office = personal?.office;
        const power = office ? offices[office].power : 'Você pode acompanhar a pesquisa como assessor.';
        element('office-power').dataset.help = power;
        element('office-salary').textContent = personal ? money(personal.salary) : '—';
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
      }
      actions();
    },
    destroy() {
      for (const node of timers.keys()) remove(node);
      stations.removeEventListener('click',onStationClick,true);
      stations.hidden = true;
      shortcuts.replaceChildren();
    },
  };
}
