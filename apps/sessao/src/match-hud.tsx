import {mountRewardEffects} from './ui/reward-effects';
import {contextActionKeys} from './ui/context-action-keys';
import {mountStationShortcuts} from './ui/station-shortcuts';
import { equipmentControls, mountEquippedGear, weaponControl, type EquipmentAction } from './ui/equipped-gear';
import type {FireOption} from './fire';
import {powerOption,type PowerAction} from './power';
import { documentRules } from './internal-mail';
import { mountElectionStationActions } from './ui/election-station-actions';
import type { ElectionAction } from './elections';
import { mountLegislativeStationActions } from './ui/legislative-station-actions';
import { mountLegislativeBrief } from './ui/legislative-brief';
import { mountNotices } from './ui/notices';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { equippedWeapon, xray } from './equipment';
import { canReachDownedPlayer, doorDestination } from './interactions';
import { infirmary } from './medical';
import { npcs } from './npcs';
import { button as hudButton, glyph as hudGlyph, node } from './gameplay-ui';
import { hudConsumesKeys } from './game-keys';
import { treasuryDeliveries, objects, type GameplayAction, type GameplayView } from './gameplay';
import { PLENARY_DOORS, type Motion, type Player } from './map';
import { npcRules } from './parliamentarians';
import { money, type PoliticsAction } from './politics';
import { stations as stationPoints, canReachStation, stabilityRules, STATION_RADIUS, type Action, type PlenaryView, type Station } from './plenary';
import { roomActivities, type RoomActivity, type RoomActivityResult } from './room-activities';

import type { SpyOption } from "./surveillance";

type FieldAction = {kind:'power';option:PowerAction} | {kind:'fire'; option:FireOption} | {kind:"spy"; option:SpyOption} | {kind:'npc-deal'; command:'talk'|'rob'|'close'; target?:string} | GameplayAction | {kind:'cross-door';door:number} | {kind:'inspect-stash'} | {kind:'edit-document';item:number;project:number} | {kind:'request-document'} | {kind:'open-security'};

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

export function createMatchHud(id:string, stationFeedback:(station:Station) => void, sendActivity:(activity:RoomActivity) => void,
  renderNearby:(player:Motion | undefined,exploring:boolean) => void, sendField:(action:FieldAction)=>void, institutional:{openInstitutional:()=>void;openDossier:()=>void;sendInstitutional:(action:PoliticsAction)=>void},
  sendLegislative:(action:Action)=>void,election:{send:(action:ElectionAction)=>void;hasVoice:()=>boolean}) {
  const rewards = mountRewardEffects(element('wallet-effects'));
  const notices = mountNotices(element('hud-notices'));
  const {notify} = notices;
  const legislativeBrief = mountLegislativeBrief(element<HTMLDialogElement>('legislative-brief'));
  const stations = element('stations');
  const shortcuts = mountStationShortcuts(element('station-shortcuts'),kind=>{
    switch (kind) {
      case 'grant':
      case 'hearing': institutional.openInstitutional(); return;
      case 'cassation': institutional.sendInstitutional({kind:'call-cassation'}); return;
      case 'publish': institutional.openDossier(); return;
      default: sendActivity(kind);
    }
  });
  const fieldActions = element('field-actions');
  const progressRoot = createRoot(element('office-progress-mount'));
  let progressKey = '';
  const gear = mountEquippedGear(element('equipped-gear'),useEquipped);
  function useEquipped(kind:EquipmentAction) {
    const equipped = previous?.gameplay?.equipped;
    const voting = previous?.phase==='ballot' || !!previous?.cassation;
    if ((previous?.phase!=='negotiation' && !(voting && (kind==='attack' || kind==='toggle-modulator'))) || !own || own.knockedOut || own.carrying || own.carried) return false;
    if (kind==='attack' ? !equippedWeapon(equipped) :
        !equipped?.some(item=>equipmentControls[item.kind as keyof typeof equipmentControls]?.action===kind)) return false;
    sendField({kind});
    return true;
  }

  const fieldRoot = createRoot(fieldActions);
  let fieldKey = '';
  let roster:Player[] = [];
  let own:Player | undefined;
  function renderField(view:PlenaryView|undefined, player:Player|undefined) {
    const actions:{label:string; icon:string; action:FieldAction}[] = [];
    const state = view?.gameplay;
    if (state && player) {
      const extinguisher = state.nearby.find(item=>item.kind==='extinguisher');
      if (extinguisher && !player.knockedOut && !player.carrying) {
        actions.push({label:'Pegar extintor',icon:'alert',action:{kind:'collect',item:extinguisher.id}});
      }
      if (view?.ballotCountdown===undefined) {
        for (const panel of [0,1] as const) {
          const option = powerOption(player,panel,view?.outage,view?.canSabotagePower);
          if (option) actions.push({label:option.label,icon:'alert',action:{kind:'power',option}});
        }
      }
    }
    const fire = view?.fireInteraction;
    if (fire?.option) actions.push({label:fire.option.label,icon:'alert',action:{kind:'fire',option:fire.option}});
    const channel = state?.officeChannel;
    const breach = channel && channel.kind!=='office-cash' ? channel : undefined;
    const robbery = state?.robberyProgress;
    const spy = state?.surveillance;
    const meter = fire?.progress!==undefined ? {value:fire.progress,max:1,label:'Instalando dispositivo',detail:'Instalando dispositivo'} :
      state?.forgeryRemaining!==undefined ? {value:documentRules.forgeryMs-state.forgeryRemaining,max:documentRules.forgeryMs,label:'Adulterando documento',
      detail:`Adulterando documento · ${Math.ceil(state.forgeryRemaining/1000)} s`} : channel?.kind==='office-cash' ? {value:channel.elapsed,max:channel.duration,label:'Embolsando dinheiro'} : breach ? {value:breach.elapsed,max:breach.duration,label:breach.label,
      detail:`${breach.label} · ${Math.ceil((breach.duration-breach.elapsed)/1000)} s`} :
      robbery!==undefined ? {value:robbery,max:npcRules.robberyMs,label:'Roubando dinheiro'} :
      spy?.progress!==undefined ? {value:spy.progress,max:1,label:'Interação de espionagem em andamento'} : undefined;
    const meterKey = JSON.stringify(meter) ?? '';
    if (progressKey!==meterKey) {
      progressKey = meterKey;
      progressRoot.render(meter ? <>
        {meter.detail && <span id="office-progress-label">{meter.detail}</span>}
        <div id="office-progress" className="react-meter" data-tone="budget" role="progressbar"
          aria-label={meter.label} aria-valuenow={meter.value} aria-valuemin={0} aria-valuemax={meter.max}>
          <span style={{transform:`scaleX(${Math.max(0,Math.min(1,meter.value/meter.max))})`}}/>
        </div>
      </> : null);
    }
    for (const option of spy?.options ?? []) actions.push({
      label:option.label,icon:option.kind==='cancel' ? 'cross' : 'search',action:{kind:'spy',option},
    });
    if (robbery!==undefined) actions.push({label:'Cancelar roubo',icon:'cross',action:{kind:'npc-deal',command:'close'}});
    for (const {label,...action} of state?.officeOptions ?? []) {
      actions.push({label,icon:action.kind==='office-cancel' ? 'cross' : 'document',action});
    }
    if (state?.security) actions.push({label:'Consultar câmeras',icon:'camera',action:{kind:'open-security'}});
    if (state?.locations.includes('secretary')) actions.push({label:'Solicitar documento',icon:'document',action:{kind:'request-document'}});
    if (state?.locations.includes('reprography')) {
      for (const item of state.inventory) if (item.document?.project!==undefined && state.forgeryRemaining===undefined) {
        actions.push({label:'Adulterar · '+item.document.title,icon:'document',action:{kind:'edit-document',item:item.id,project:item.document.project}});
      }
    }
    if (state && player && channel?.kind!=='office-cash' && robbery===undefined) {
      for (const npc of state.parliamentarians ?? []) {
        actions.push({label:npc.down ? `Roubar dinheiro · ${npc.name}` : `Conversar · ${npc.name}`,icon:npc.down ? 'wallet' : 'document',
          action:{kind:'npc-deal',command:npc.down ? 'rob' : 'talk',target:npc.id}});
      }
      if (state.locations.includes('treasury')) {
        for (const delivery of treasuryDeliveries(state.inventory)) actions.push({...delivery,icon:'wallet'});
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
          actions.push({label:`Abrir loja · ${npcs[target].name}`,icon:'inventory',action:{kind:'open-shop',target}});
        }
        for (const target of roster) {
          if (canReachDownedPlayer(player,target)) {
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
    flushSync(()=>fieldRoot.render(actions.map(({label,icon,action})=>
      <button key={JSON.stringify(action)} type="button" className="hud-button hud-button--secondary" onClick={()=>sendField(action)}>
        <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+icon}/></svg>{label}
      </button>)));
  }
  const legislative = mountLegislativeStationActions(element('legislative-station-actions'),sendLegislative);
  const electoral = mountElectionStationActions(element('station-election-actions'),election.send);
  const actionButtons = () => [...stations.querySelectorAll<HTMLButtonElement>('.station-actions button')];
  const more = hudButton('Mais ações',()=>{
    const expanded = more.getAttribute('aria-expanded')!=='true';
    if (expanded && nearbyToggle.getAttribute('aria-expanded')==='true') nearbyToggle.click();
    more.setAttribute('aria-expanded',String(expanded));
    refreshActionKeys();
  });
  more.classList.add('hud-button','context-more');
  more.setAttribute('aria-expanded','false');
  const overflowBreak = node('span');
  overflowBreak.className = 'context-overflow-break';
  overflowBreak.setAttribute('aria-hidden','true');
  overflowBreak.hidden = true;
  stations.querySelector('.station-actions')!.append(overflowBreak,more);
  const unavailable = '[hidden]:not(#stations), [data-context-hidden="true"]';
  function refreshActionKeys() {
    const buttons = actionButtons();
    const model = contextActionKeys(buttons.map(button=>({
      kind:button===more ? 'more' : button===nearbyToggle ? 'nearby' : button.closest('#nearby-items') ? 'item' : 'action',
      visible:!button.closest(unavailable),enabled:!button.disabled,
    })),more.getAttribute('aria-expanded')==='true',nearbyToggle.getAttribute('aria-expanded')==='true');
    more.hidden = !model.hasMore;
    overflowBreak.hidden = !model.showOverflow;
    if (!model.hasMore) more.setAttribute('aria-expanded','false');
    for (const [index,button] of buttons.entries()) {
      const {placement,key:shortcut} = model.buttons[index];
      if (placement) button.dataset.contextOverflow = placement==='primary' ? 'false' : placement==='overflow' ? 'expanded' : 'true';
      else delete button.dataset.contextOverflow;
      const key = shortcut ?? null;
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
  function onContextClick(event:MouseEvent) {
    if (event.target instanceof Element && event.target.closest('#nearby-objects') &&
      nearbyToggle.getAttribute('aria-expanded')==='true') more.setAttribute('aria-expanded','false');
    refreshActionKeys();
  }
  stations.addEventListener('click',onContextClick);
  function onActionKey(event:KeyboardEvent) {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey ||
      event.metaKey || hudConsumesKeys(event.target)) return;
    const equipmentAction = event.code==='Space' ? weaponControl.action :
      Object.values(equipmentControls).find(control=>event.code===`Key${control.key}`)?.action;
    if (equipmentAction) {
      if (useEquipped(equipmentAction)) event.preventDefault();
      return;
    }
    if (event.key==='Escape') {
      if (!stations.hidden && nearbyToggle.getAttribute('aria-expanded')==='true') {
        event.preventDefault();
        nearbyToggle.click();
      } else if (!stations.hidden && more.getAttribute('aria-expanded')==='true') {
        event.preventDefault();
        more.click();
      }
      return;
    }
    if (stations.hidden || event.shiftKey || !/^[1-9]$/.test(event.key)) return;
    const key = event.key;
    const button = stations.querySelector<HTMLButtonElement>(`button[aria-keyshortcuts="${key}"]`);
    if (!button || button.disabled || button.closest(unavailable) || button.dataset.contextOverflow==='true') return;
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
        if (canReachStation(player,key,best)) {
          best = distance;
          context = key;
        }
      }
    }
    renderNearby(player,canInteract);
    const hasLegislativeAction = legislative.render(view,context);
    const hasElectionAction = electoral.render(view,context,election.hasVoice());
    const hasShortcut = shortcuts.render(view,player,context);
    const hasAction = hasLegislativeAction || hasElectionAction || hasShortcut;
    if (!exploring || !canInteract) more.setAttribute('aria-expanded','false');
    stations.hidden = !exploring || (nearbyToggle.hidden && !hasAction && view?.fireInteraction?.progress===undefined && !fieldActions.childElementCount);
    refreshActionKeys();
  }

  return {
    notify,
    showReward:rewards.show,
    activityResult({activity,text}:RoomActivityResult) {
      const info = roomActivities[activity];
      if ((activity==='secretary' || activity==='archive') && previous?.phase==='negotiation') {
        legislativeBrief.open(activity,previous);
      }
      if (text) notify(info.title,text);
    },
    render(view:PlenaryView) {
      if (view.phase!=='negotiation') legislativeBrief.close();
      const politics = view.politics;

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
        if (view.phase==='negotiation' && !view.cassationIn && view.remaining<=30 && previous.remaining>30) {
          notify('Votação de projeto',`Plenário em ${view.remaining} s.`);
        }
        if ((view.phase!==previous.phase || view.round!==previous.round) && (view.phase==='ballot' || view.phase==='hearing')) {
          notify(view.phase==='ballot' ? 'Projeto · votação aberta' : view.cassation ? 'Cassação · votação aberta' : 'Afastamento · votação aberta',
            view.phase==='ballot' ? 'Portas fechadas até a apuração. Voz geral no Plenário.' : view.cassation ? 'Vote em quem você suspeita ser infiltrado.' : view.hearing?.target ?? '',true);
        }
        if (view.isolationSeconds && !previous.isolationSeconds) notify('Afastamento aprovado',`Sala de Isolamento · ${view.isolationSeconds} s`,true);
        if (!view.isolationSeconds && previous.isolationSeconds && view.phase!=='finished') notify('Afastamento encerrado','Você já pode voltar à sessão.');
        if (view.stability<stabilityRules.target && previous.stability>=stabilityRules.target) notify('Estabilidade abaixo da meta',`${view.stability} de ${stabilityRules.maximum}`,true);
        if (view.reportedFraud && !previous.reportedFraud) notify('Fraude denunciada','O painel mostra os números reais.',true);
        if (politics && past && politics.wallet<past.wallet && politics.walletIncome>=past.walletIncome && previous.phase!=='finished') {
          notify('Carteira atualizada',`−${money(past.wallet-politics.wallet)}`);
        }

      }
      gear.render(view.gameplay);

      previous = view;
      actions(view);
    },
    players(players:Player[]) {
      roster = players;
      own = players.find(player => player.id===id);
      actions();
    },
    destroy() {
      gear.destroy();
      notices.destroy();
      legislativeBrief.destroy();
      legislative.destroy();
      electoral.destroy();
      rewards.destroy();
      document.removeEventListener('keydown',onActionKey);
      stations.removeEventListener('click',onContextClick);
      for (const button of actionButtons()) {
        button.removeAttribute('aria-keyshortcuts');
        button.querySelector('.station-key')?.remove();
      }
      stations.removeEventListener('click',onStationClick,true);
      stations.hidden = true;
      progressRoot.unmount();
      shortcuts.destroy();
      more.remove();
      overflowBreak.remove();
      fieldRoot.unmount();
    },
  };
}
