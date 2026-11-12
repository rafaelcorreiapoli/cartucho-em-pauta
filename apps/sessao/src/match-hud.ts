import { offices } from './elections';
import type { Player } from './map';
import { AGENDA_REWARD, missionTitle, money, type Mission, type PoliticsView } from './politics';
import { STATION_RADIUS, type PlenaryView, type Station } from './plenary';
import { roomActivities, type RoomActivity, type RoomActivityResult } from './room-activities';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

export function createMatchHud(id:string, stationFeedback:(station:Station) => void, sendActivity:(activity:RoomActivity) => void) {
  const roleBadge = element<HTMLButtonElement>('profile-role');
  const roleIcon = roleBadge.querySelector('use')!;
  const agendaDock = element<HTMLDetailsElement>('agenda-dock');
  const missionTemplate = element<HTMLTemplateElement>('agenda-mission');
  const activeMissions = element('missions-active');
  const completedMissions = element('missions-completed');
  const missionHistory = element('missions-history');
  const walletEffects = element('wallet-effects');
  const walletGain = element<HTMLTemplateElement>('wallet-gain');
  let incomeEffect:HTMLElement | undefined;
  let missionRenderKey = '';
  const notices = element('hud-notices');
  const stations = element('stations');
  const shortcuts = element('station-shortcuts');
  const interviewHint = element('interview-hint');
  function addStationButton(action:{station:Station; icon:string; label:string}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hud-button hud-button--secondary';
    button.dataset.station = action.station;
    button.hidden = true;
    const label = document.createElement('span');
    label.textContent = action.label;
    const icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
    icon.classList.add('hud-glyph');
    icon.setAttribute('aria-hidden','true');
    const glyph = document.createElementNS(icon.namespaceURI,'use');
    glyph.setAttribute('href','#icon-'+action.icon);
    icon.append(glyph);
    button.append(icon,label);
    shortcuts.append(button);
    return button;
  }

  const quickActions = ([
    {target:'grant',panel:'trade-dock',label:'Aplicar verba',station:'cabinet',icon:'wallet'},
    {target:'campaign',label:'Campanha · R$ 20 mil',station:'press',icon:'star'},
    {target:'hearing-target',panel:'trade-dock',label:'Convocar cassação',station:'panel',icon:'ballot'},
    {target:'publish',panel:'politics-dock',label:'Divulgar evidência',station:'press',icon:'document'},
  ] as const).map(action => {
    const control = element<HTMLButtonElement>(action.target);
    const button = addStationButton(action);
    button.onclick = () => {
      if ('panel' in action) {
        element<HTMLDetailsElement>(action.panel).open = true;
        const field = control.closest('form')?.querySelector<HTMLElement>('.game-choice');
        field?.focus();
      } else control.click();
    };
    return {button,control};
  });
  const activityButtons = (Object.keys(roomActivities) as RoomActivity[]).map(station => {
    const activity = roomActivities[station];
    const button = addStationButton({...activity,station});
    button.onclick = () => sendActivity(station);
    return {button,activity};
  });
  let own:Player | undefined;
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

  agendaDock.open = false;
  const showLatestMission = () => { missionHistory.scrollTop = missionHistory.scrollHeight; };
  agendaDock.addEventListener('toggle',showLatestMission);
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

  function renderMissions(missions:PoliticsView['missions']) {
    const key = JSON.stringify(missions);
    if (key===missionRenderKey) return;
    missionRenderKey = key;
    element('agenda-progress').textContent = `${missions.active.length} ativas`;
    missionHistory.hidden = !missions.completed.length;
    function row(mission:Mission, done:boolean) {
      const node = missionTemplate.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
      node.dataset.done = String(done);
      node.querySelector('strong')!.textContent = missionTitle(mission);
      const progress = mission.kind==='fortuna' ? `${money(mission.current)} / ${money(mission.target)}` :
        `${mission.current} / ${mission.target}`;
      node.querySelector('small')!.textContent = done ? missions.paid ? 'Prêmio recebido' : 'Prêmio no fim da sessão' : progress;
      node.querySelector('.mission-reward span')!.textContent = `+${money(AGENDA_REWARD)}`;
      return node;
    }
    activeMissions.replaceChildren(...missions.active.map(mission => row(mission,false)));
    if (completedMissions.children.length!==missions.completed.length || missions.paid) {
      completedMissions.replaceChildren(...missions.completed.map(mission => row(mission,true)));
      showLatestMission();
    }
  }

  function actions(view:PlenaryView | undefined = previous) {
    const exploring = view?.phase==='negotiation';
    for (const {button,control} of quickActions) {
      button.hidden = !exploring || control.disabled || !!control.closest('[hidden]') ||
        (control.id==='publish' && !element('evidence').dataset.value);
    }
    for (const {button,activity} of activityButtons) {
      button.hidden = !exploring || !own || Math.hypot(own.x-activity.x,own.y-activity.y)>STATION_RADIUS;
    }
    const hasAction = stationActions.some(button => !button.disabled && !button.closest('[hidden]:not(#stations)'));
    stations.hidden = !exploring || (!hasAction && interviewHint.hidden);
  }

  return {
    notify,
    showIncome(amount:number, headY:number | undefined) {
      const total = amount+Number(incomeEffect?.dataset.amount ?? 0);
      incomeEffect?.remove();
      const effect = walletGain.content.firstElementChild!.cloneNode(true) as HTMLElement;
      effect.dataset.amount = String(total);
      if (headY!==undefined) effect.style.top = `${headY}px`;
      effect.querySelector('strong')!.textContent = `+${money(total)}`;
      effect.addEventListener('animationend',() => {
        effect.remove();
        if (incomeEffect===effect) incomeEffect = undefined;
      },{once:true});
      incomeEffect = effect;
      walletEffects.append(effect);
    },
    activityResult({activity,text}:RoomActivityResult) {
      const info = roomActivities[activity];
      if (text) notify(info.title,text);
      if ('panel' in info) element<HTMLDetailsElement>(info.panel).open = true;
      if (activity==='archive') element<HTMLDetailsElement>('ledger').open = true;
    },
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
        renderMissions(politics.missions);
        if (view.phase==='negotiation' && (!previous?.politics || previous.phase==='finished')) agendaDock.open = true;
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
        if (politics && past && politics.wallet<past.wallet && politics.walletIncome>=past.walletIncome && previous.phase!=='finished') {
          notify('Carteira atualizada',`−${money(past.wallet-politics.wallet)}`);
        }
        const completed = politics && past ? politics.missions.completed.slice(past.missions.completed.length) : [];
        if (view.phase!=='finished' && completed.length) {
          const title = completed.length===1 ? 'Missão cumprida' : `${completed.length} missões cumpridas`;
          notify(title,completed.map(missionTitle).join(' · '));
        }
      }
      previous = view;
      actions(view);
    },
    players(players:Player[]) {
      own = players.find(player => player.id===id);
      if (own) {
        element('hud-nick').textContent = own.nick;
        element('hud-portrait').style.setProperty('--portrait-row',String(own.character*3));
      }
      actions();
    },
    destroy() {
      for (const node of timers.keys()) remove(node);
      agendaDock.removeEventListener('toggle',showLatestMission);
      incomeEffect?.remove();
      stations.removeEventListener('click',onStationClick,true);
      stations.hidden = true;
      shortcuts.replaceChildren();
    },
  };
}
