import { mountNotices } from './ui/notices';
import { updateProgress } from './progress-meter';
import { equippedWeapon, xray } from './equipment';
import { doorDestination } from './interactions';
import { aidRadius, infirmary } from './medical';
import { npcs } from './npcs';
import { button as hudButton, glyph as hudGlyph, itemPortrait, node } from './gameplay-ui';
import { hudConsumesKeys } from './game-keys';
import { canReachObject, cashAmount, objects, type GameplayAction, type GameplayView } from './gameplay';
import { setCharacterPortrait } from './character-art';
import { PLENARY_DOORS, type Motion, type Player } from './map';
import { npcRules } from './parliamentarians';
import { money } from './politics';
import { stations as stationPoints, STATION_RADIUS, type PlenaryView, type Station } from './plenary';
import { roomActivities, type RoomActivity, type RoomActivityResult } from './room-activities';

import type { SpyOption } from "./surveillance";

type FieldAction = {kind:"spy"; option:SpyOption} | {kind:'npc-deal'; command:'talk'|'rob'|'close'; target?:string} | GameplayAction | {kind:'cross-door';door:number} | {kind:'inspect-stash'};

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

export function createMatchHud(id:string, stationFeedback:(station:Station) => void, sendActivity:(activity:RoomActivity) => void,
  renderNearby:(player:Motion | undefined,exploring:boolean) => void, sendField:(action:FieldAction)=>void) {
  const roleBadge = element<HTMLButtonElement>('profile-role');
  const walletEffects = element('wallet-effects');
  const walletGain = element<HTMLTemplateElement>('wallet-gain');
  let incomeEffect:HTMLElement | undefined;
  let xpEffect:HTMLElement | undefined;
  const notices = mountNotices(element('hud-notices'));
  const {notify} = notices;
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
    {target:'hearing-target',panel:'trade-dock',label:'Convocar afastamento',station:'panel',icon:'ballot'},
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
    return {button,control,station:action.station};
  });
  const activityButtons = (Object.keys(roomActivities) as RoomActivity[]).map(station => {
    const activity = roomActivities[station];
    const button = addStationButton({...activity,station});
    button.onclick = () => sendActivity(station);
    return {button,station};
  });
  const fieldActions = element('field-actions');
  const progress = element<HTMLProgressElement>('office-progress');
  const progressLabel = element('office-progress-label');
  const officeBadge = element('own-office');
  const gearStrip = element('equipped-gear');
  const gearTiles = new Map<number,{tile:HTMLElement; timer:HTMLElement}>();
  const secondsLabel = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
  const concealmentTimer = node('span');
  concealmentTimer.className = 'equipped-gear-tile';
  concealmentTimer.setAttribute('role','listitem');
  const concealmentLabel = node('span');
  concealmentLabel.className = 'equipped-gear-timer';
  const concealmentFooter = node('span');
  concealmentFooter.className = 'equipped-gear-footer';
  concealmentFooter.append(concealmentLabel);
  concealmentTimer.append(itemPortrait('mensalUnderwear'),concealmentFooter);
  function useEquipped(kind:'scan-xray'|'attack'|'use-binoculars'|'toggle-megaphone') {
    const equipped = previous?.gameplay?.equipped;
    if (previous?.phase!=='negotiation' || !own || own.knockedOut || own.carrying || own.carried) return false;
    if (kind==='attack' ? !equippedWeapon(equipped) : !equipped?.some(item=>item.kind===(kind==='scan-xray' ? 'xray' : kind==='toggle-megaphone' ? 'megaphone' : 'binoculars'))) return false;
    sendField({kind});
    return true;
  }

  function renderEquipped(state?:GameplayView) {
    const equipped = state?.equipped ?? [];
    for (const [id,{tile}] of gearTiles) {
      if (equipped.some(item=>item.id===id)) continue;
      tile.remove();
      gearTiles.delete(id);
    }
    for (const item of equipped) {
      const name = objects[item.kind].name;
      let entry = gearTiles.get(item.id);
      if (!entry) {
        const shortcut = item.kind==='xray' ? 'X' : item.kind==='binoculars' ? 'B' : item.kind==='megaphone' ? 'M' : equippedWeapon([item]) ? 'Space' : undefined;
        const tile = shortcut ? hudButton('',()=>useEquipped(shortcut==='X' ? 'scan-xray' : shortcut==='B' ? 'use-binoculars' : shortcut==='M' ? 'toggle-megaphone' : 'attack')) : node('span');
        tile.className = 'equipped-gear-tile';
        const footer = node('span');
        footer.className = 'equipped-gear-footer';
        const hint = shortcut ?? (item.kind==='runningShoes' ? 'Shift' : undefined);
        if (hint) {
          tile.setAttribute('aria-keyshortcuts',hint);
          const badge = node('kbd',hint==='Space' ? 'Espaço' : hint.toUpperCase());
          badge.className = 'equipped-gear-key';
          badge.setAttribute('aria-hidden','true');
          footer.append(badge);
        }
        if (!shortcut) tile.setAttribute('role','listitem');
        tile.dataset.kind = item.kind;
        const timer = node('span');
        timer.className = 'equipped-gear-timer';
        timer.setAttribute('aria-hidden','true');
        footer.prepend(timer);
        tile.append(itemPortrait(item.kind),footer);
        gearStrip.append(tile);
        entry = {tile,timer};
        gearTiles.set(item.id,entry);
      }
      const seconds = state?.equipmentCooldowns?.[item.id] ?? 0;
      const charges = item.kind==='xray' ? `${item.charges ?? 0}/${xray.capacity}` : '';
      const active = item.kind==='binoculars' ? state?.binocularSeconds : item.kind==='megaphone' ? state?.megaphoneSeconds : undefined;
      const time = active ? `${active} s` : item.kind==='xray' && state?.xrayVision ? `${state.xrayVision.remaining}s · ${charges}` : charges || (seconds ? `${secondsLabel.format(seconds)} s` : '');
      const label = active ? `${name} · Ativo: ${time}` : seconds ? `${name} · Recarga: ${time}` : charges ? `${name} · ${time}` : item.kind==='runningShoes' ? `${name} · Segure Shift para correr` : name;
      if (entry.tile.title===label) continue;
      entry.tile.dataset.active = String(!!active || item.kind==='xray' && !!state?.xrayVision);
      entry.timer.textContent = time;
      entry.timer.hidden = !time;
      entry.tile.title = label;
      entry.tile.setAttribute('aria-label',item.kind==='xray' ? `${state?.xrayVision ? 'Desativar' : 'Ativar'} ${label}` : label);
      if (item.kind==='xray') entry.tile.setAttribute('aria-pressed',String(!!state?.xrayVision));
    }
    const remaining = state?.concealmentSeconds;
    if (remaining) {
      concealmentLabel.textContent = `${remaining} s`;
      concealmentTimer.title = `Dinheiro oculto · ${remaining} s`;
      if (!concealmentTimer.isConnected) gearStrip.append(concealmentTimer);
    } else concealmentTimer.remove();
    gearStrip.hidden = equipped.length===0 && !remaining;
  }

  let fieldKey = '';
  let roster:Player[] = [];
  let own:Player | undefined;
  function renderField(view:PlenaryView|undefined, player:Player|undefined) {
    const actions:{label:string; icon:string; action:FieldAction}[] = [];
    const state = view?.gameplay;
    const channel = state?.officeChannel;
    const breach = channel && channel.kind!=='office-cash' ? channel : undefined;
    const robbery = state?.robberyProgress;
    const spy = state?.surveillance;
    progress.hidden = !breach && robbery===undefined && spy?.progress===undefined;
    if (spy?.progress!==undefined && !breach && robbery===undefined) {
      updateProgress(progress,spy.progress,1);
      progress.setAttribute('aria-label','Interação de espionagem em andamento');
    }
    for (const option of spy?.options ?? []) actions.push({
      label:option.label,icon:option.kind==='cancel' ? 'cross' : 'search',action:{kind:'spy',option},
    });
    if (robbery!==undefined) {
      updateProgress(progress,robbery,npcRules.robberyMs);
      progress.setAttribute('aria-label','Roubando dinheiro');
      actions.push({label:'Cancelar roubo',icon:'cross',action:{kind:'npc-deal',command:'close'}});
    }
    progressLabel.hidden = !breach;
    if (breach) {
      updateProgress(progress,breach.elapsed,breach.duration);
      progress.setAttribute('aria-label',breach.label);
      progressLabel.textContent = `${breach.label} · ${Math.ceil((breach.duration-breach.elapsed)/1000)} s`;
    }
    const ownOffice = state?.ownOffice;
    officeBadge.hidden = !ownOffice;
    if (ownOffice) officeBadge.textContent = `Gabinete ${ownOffice.padStart(2,'0')}`;
    for (const {label,...action} of state?.officeOptions ?? []) {
      actions.push({label,icon:action.kind==='office-cancel' ? 'cross' : 'document',action});
    }
    if (state && player && channel?.kind!=='office-cash' && robbery===undefined) {
      for (const npc of state.parliamentarians ?? []) {
        actions.push({label:npc.down ? `Roubar dinheiro · ${npc.name}` : `Conversar · ${npc.name}`,icon:npc.down ? 'wallet' : 'document',
          action:{kind:'npc-deal',command:npc.down ? 'rob' : 'talk',target:npc.id}});
      }
      if (state.locations.includes('treasury')) for (const item of state.inventory) {
        const amount = cashAmount(item);
        if (amount) actions.push({label:`Entregar ${money(amount)} ao tesoureiro`,icon:'wallet',
          action:{kind:'deliver',place:'treasury',item:item.id}});
      }
      if (state.npcNearby?.includes('vendor') && state.equipped?.some(item=>item.kind==='xray')) actions.push({
        label:`Recarregar Raio X · ${money(xray.rechargePrice)}`,icon:'wallet',action:{kind:'recharge-xray'},
      });
      if (state.officeStash) actions.push({label:'Abrir armário',icon:'inventory',action:{kind:'inspect-stash'}});
      const door = PLENARY_DOORS.findIndex((_,index)=>doorDestination(player,index,false)!==undefined);
      if (door>=0) actions.push({label:'Atravessar porta',icon:'map',action:{kind:'cross-door',door}});
      if (state.treatment) {
        actions.push({label:`${state.treatment.target ? 'Atender carregado' : 'Consultar '+infirmary.doctor.name} · ${money(infirmary.price)}`,
          icon:'shield',action:{kind:'treat'}});
      }
      if (player.carrying) {
        actions.push({label:'Soltar jogador',icon:'cross',action:{kind:'release'}});
      } else {
        for (const target of state.npcNearby ?? []) {
          actions.push({label:`Conversar · ${npcs[target].name}`,icon:'document',action:{kind:'talk',target}});
        }
        for (const target of roster) {
          if (target.id===id) continue;
          if (target.knockedOut && canReachObject(player,target,{radius:aidRadius,clearFloor:true})) {
            actions.push({label:`Socorrer ${target.nick}`,icon:'shield',action:{kind:'aid',target:target.id}});
            if (!target.carried) actions.push({label:`Carregar ${target.nick}`,icon:'handset',action:{kind:'carry',target:target.id}});
            actions.push({label:`Inspecionar ${target.nick}`,icon:'search',action:{kind:'inspect-down',target:target.id}});
          }
        }
      }
    }
    const key = JSON.stringify(actions);
    if (key===fieldKey) return;
    fieldKey = key;
    fieldActions.replaceChildren(...actions.map(({label,icon,action})=>{
      const control = hudButton(label,()=>sendField(action));
      control.prepend(hudGlyph(icon));
      return control;
    }));
  }
  const stationActions = [...stations.querySelectorAll<HTMLButtonElement>('button[data-station]')];
  const actionButtons = () => [...stations.querySelectorAll<HTMLButtonElement>('.station-actions button')];
  const unavailable = '[hidden], [data-context-hidden="true"]';
  function refreshActionKeys() {
    let index = 0;
    for (const button of actionButtons()) {
      const available = !button.disabled && !button.closest(unavailable);
      const key = available ? (++index<=9 ? String(index) : null) : null;
      if (button.getAttribute('aria-keyshortcuts')===key) continue;
      if (!key) {
        button.querySelector('.station-key')?.remove();
        button.removeAttribute('aria-keyshortcuts');
        continue;
      }
      let badge = button.querySelector('kbd');
      if (!badge) {
        badge = document.createElement('kbd');
        badge.className = 'station-key';
        badge.setAttribute('aria-hidden','true');
        button.append(badge);
      }
      badge.textContent = key;
      button.setAttribute('aria-keyshortcuts',key);
    }
  }
  const nearbyToggle = element('nearby-objects');
  stations.addEventListener('click',refreshActionKeys);
  function onActionKey(event:KeyboardEvent) {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey ||
      event.metaKey || hudConsumesKeys(event.target)) return;
    const equipmentAction = event.code==='Space' ? 'attack' : event.code==='KeyX' ? 'scan-xray' : event.code==='KeyB' ? 'use-binoculars' : event.code==='KeyM' ? 'toggle-megaphone' : undefined;
    if (equipmentAction) {
      if (useEquipped(equipmentAction)) event.preventDefault();
      return;
    }
    if (stations.hidden || event.shiftKey || !/^[1-9]$/.test(event.key)) return;
    const key = event.key;
    const button = stations.querySelector<HTMLButtonElement>(`button[aria-keyshortcuts="${key}"]`);
    if (!button || button.disabled || button.closest(unavailable)) return;
    event.preventDefault();
    button.click();
  }
  document.addEventListener('keydown',onActionKey);

  function onStationClick(event:MouseEvent) {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-station]');
    if (!button || button.disabled || button.closest(unavailable)) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      button.animate([
        {filter:'brightness(1.55)',transform:'translateY(4px)'},
        {filter:'brightness(1)',transform:'translateY(0)'},
      ],{duration:230,easing:'ease-out'});
    }
    stationFeedback(button.dataset.station as Station);
  }
  stations.addEventListener('click',onStationClick,true);
  let previous:PlenaryView | undefined;

  function actions(view:PlenaryView | undefined = previous) {
    const player = own;
    const exploring = view?.phase==='negotiation' && !player?.knockedOut;
    renderField(exploring ? view : undefined,player);
    const canInteract = exploring && !player?.carrying && view?.gameplay?.officeChannel?.kind!=='office-cash' && view?.gameplay?.robberyProgress===undefined;
    let context:Station | undefined;
    let best = STATION_RADIUS;
    if (canInteract && player) {
      for (const [key,point] of Object.entries(stationPoints) as [Station,Motion][]) {
        const distance = Math.hypot(player.x-point.x,player.y-point.y);
        if (canReachObject(player,point,{radius:best,handsFree:true})) {
          best = distance;
          context = key;
        }
      }
    }
    for (const {button,control,station} of quickActions) {
      button.hidden = context!==station || control.disabled || !!control.closest('[hidden]') ||
        (control.id==='publish' && !element('evidence').dataset.value);
    }
    for (const {button,station} of activityButtons) button.hidden = context!==station;
    for (const button of stationActions) {
      const hidden = String(button.dataset.station!==context);
      if (button.dataset.contextHidden!==hidden) button.dataset.contextHidden = hidden;
    }
    const hideInterview = String(context!=='tv');
    if (interviewHint.dataset.contextHidden!==hideInterview) interviewHint.dataset.contextHidden = hideInterview;
    renderNearby(player,canInteract);
    const hasAction = stationActions.some(button => !button.disabled &&
      !button.closest('[hidden]:not(#stations),[data-context-hidden="true"]'));
    const hint = !interviewHint.hidden && context==='tv';
    stations.hidden = !exploring || (nearbyToggle.hidden && !hasAction && !hint && !fieldActions.childElementCount);
    refreshActionKeys();
  }

  return {
    notify,
    showIncome(amount:number, head:{x:number;y:number} | undefined) {
      const total = amount+Number(incomeEffect?.dataset.amount ?? 0);
      incomeEffect?.remove();
      const effect = walletGain.content.firstElementChild!.cloneNode(true) as HTMLElement;
      effect.dataset.amount = String(total);
      if (head) {
        effect.style.left = `${head.x}px`;
        effect.style.top = `${head.y}px`;
      }
      effect.querySelector('strong')!.textContent = `+${money(total)}`;
      effect.addEventListener('animationend',() => {
        effect.remove();
        if (incomeEffect===effect) incomeEffect = undefined;
      },{once:true});
      incomeEffect = effect;
      walletEffects.append(effect);
    },
    showXp(amount:number, head:{x:number;y:number} | undefined) {
      if (!head) return;
      xpEffect?.remove();
      const effect = document.createElement('strong');
      effect.className = 'wallet-gain xp-gain';
      effect.setAttribute('aria-hidden','true');
      effect.textContent = `+${amount} XP`;
      effect.style.left = `${head.x}px`;
      effect.style.top = `${head.y}px`;
      effect.addEventListener('animationend',()=>{
        effect.remove();
        if (xpEffect===effect) xpEffect = undefined;
      },{once:true});
      xpEffect = effect;
      walletEffects.append(effect);
    },
    activityResult({activity,text}:RoomActivityResult) {
      const info = roomActivities[activity];
      if (text) notify(info.title,text);
      if ('panel' in info) element<HTMLDetailsElement>(info.panel).open = true;
      if (activity==='archive') element<HTMLDetailsElement>('ledger').open = true;
    },
    render(view:PlenaryView) {
      roleBadge.hidden = view.role!=='Infiltrado';
      element('hud-office').hidden = view.mandate!==false;
      const politics = view.politics;
      if (politics) {
        element('hud-wallet').textContent = money(politics.wallet);
        element('hud-popularity').textContent = String(politics.popularity);
      }

      if (previous) {
        const past = previous.politics;
        const payroll = view.election?.result;
        if (payroll?.expectedSalary && payroll.cycle!==previous.election?.result?.cycle) {
          const percent = Math.round(100*payroll.salary/payroll.expectedSalary);
          notify('Salário parlamentar',`${money(payroll.salary)} de ${money(payroll.expectedSalary)} · ${percent}%${percent<100 ? ' · Orçamento insuficiente' : ''}`);
        }
        const notice = view.election?.notice;
        if (notice && notice.seq!==previous.election?.notice?.seq && !view.election?.broadcast) {
          notify(view.election?.result?.cycle!==previous.election?.result?.cycle ? 'Renovação de Mandato' : 'Campanha',notice.text);
        }
        if (view.phase==='negotiation' && view.remaining<=30 && previous.remaining>30) {
          notify('Convocação',`Sessão no Plenário em ${view.remaining} s.`);
        }
        if (view.phase!==previous.phase && (view.phase==='ballot' || view.phase==='hearing')) {
          notify(view.phase==='ballot' ? 'Plenário · votação aberta' : 'Votação aberta',
            view.phase==='ballot' ? 'Portas fechadas até a apuração. Voz geral no Plenário.' : element('bill').textContent ?? '',true);
        }
        if (view.stability<45 && previous.stability>=45) notify('Estabilidade abaixo da meta',`${view.stability} de 100`,true);
        if (view.reportedFraud && !previous.reportedFraud) notify('Fraude denunciada','O painel mostra os números reais.',true);
        if (politics && past && politics.wallet<past.wallet && politics.walletIncome>=past.walletIncome && previous.phase!=='finished') {
          notify('Carteira atualizada',`−${money(past.wallet-politics.wallet)}`);
        }

      }
      renderEquipped(view.gameplay);

      previous = view;
      actions(view);
    },
    players(players:Player[]) {
      roster = players;
      own = players.find(player => player.id===id);
      if (own) {
        const nick = element('hud-nick');
        if (nick.textContent!==own.nick) nick.textContent = own.nick;
        setCharacterPortrait(element('hud-portrait'),own.character);
      }
      actions();
    },
    destroy() {
      renderEquipped();
      notices.destroy();
      incomeEffect?.remove();
      xpEffect?.remove();
      document.removeEventListener('keydown',onActionKey);
      stations.removeEventListener('click',refreshActionKeys);
      for (const button of actionButtons()) {
        button.removeAttribute('aria-keyshortcuts');
        button.querySelector('.station-key')?.remove();
      }
      stations.removeEventListener('click',onStationClick,true);
      stations.hidden = true;
      progress.hidden = officeBadge.hidden = true;
      shortcuts.replaceChildren();
      fieldActions.replaceChildren();
    },
  };
}
