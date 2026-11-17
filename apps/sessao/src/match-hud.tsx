import {fieldActions,type FieldAction} from './ui/field-actions';
import {ContextActionButton} from './ui/context-action-button';
import {ContextProgress,contextProgress} from './ui/context-progress';
import {mountRewardEffects} from './ui/reward-effects';
import {ContextOverflow} from './ui/context-overflow';
import {contextActionKeys} from './ui/context-action-keys';
import {mountStationShortcuts} from './ui/station-shortcuts';
import { equipmentControls, mountEquippedGear, weaponControl, type EquipmentAction } from './ui/equipped-gear';
import { mountElectionStationActions } from './ui/election-station-actions';
import type { ElectionAction } from './elections';
import { mountLegislativeStationActions } from './ui/legislative-station-actions';
import { mountNotices } from './ui/notices';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { equippedWeapon } from './equipment';
import { hudConsumesKeys } from './game-keys';
import type { Motion, Player } from './map';
import { money, type PoliticsAction } from './politics';
import { projectRules, stations as stationPoints, canReachStation, stabilityRules, STATION_RADIUS, type Action, type PlenaryView, type Station } from './plenary';
import { roomActivities, type RoomActivity, type RoomActivityResult } from './room-activities';


const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

export function createMatchHud(id:string, stationFeedback:(station:Station) => void, sendActivity:(activity:RoomActivity) => void,
  nearby:{render:(player:Motion | undefined,exploring:boolean)=>void;expanded:()=>boolean;visible:()=>boolean;close:()=>void}, sendField:(action:FieldAction)=>void, institutional:{openInstitutional:()=>void;openDossier:()=>void;sendInstitutional:(action:PoliticsAction)=>void},
  sendLegislative:(action:Exclude<Action,'audit'> | 'denounce')=>void,election:{send:(action:ElectionAction)=>void;hasVoice:()=>boolean}) {
  const rewards = mountRewardEffects(element('wallet-effects'));
  const notices = mountNotices(element('hud-notices'));
  const {notify} = notices;
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
  const fieldHost = element('field-actions');
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

  const fieldRoot = createRoot(fieldHost);
  let fieldKey = '';
  let roster:Player[] = [];
  let own:Player | undefined;
  function renderField(view:PlenaryView|undefined, player:Player|undefined) {
    const actions = fieldActions(view,player,roster);
    const key = JSON.stringify(actions);
    if (key===fieldKey) return actions.length>0;
    fieldKey = key;
    flushSync(()=>fieldRoot.render(actions.map(({action,...button})=>
      <ContextActionButton key={JSON.stringify(action)} {...button} activate={()=>sendField(action)}/>)));
    return actions.length>0;
  }
  const legislative = mountLegislativeStationActions(element('legislative-station-actions'),sendLegislative);
  const electoral = mountElectionStationActions(element('station-election-actions'),election.send);
  const overflowHost = element('context-overflow');
  const overflowRoot = createRoot(overflowHost);
  let overflowExpanded = false;
  let overflowKey = '';
  const actionButtons = () => [...stations.querySelectorAll<HTMLButtonElement>('.station-actions button:not(.context-more)')];
  function toggleOverflow() {
    overflowExpanded = !overflowExpanded;
    if (overflowExpanded) nearby.close();
    refreshActionKeys();
  }
  const unavailable = '[hidden]:not(#stations), [data-context-hidden="true"]';
  function refreshActionKeys() {
    const buttons = actionButtons();
    const controls = buttons.map(button=>({
      kind:button.id==='nearby-objects' ? 'nearby' as const : button.closest('#nearby-items') ? 'item' as const : 'action' as const,
      visible:!button.closest(unavailable),enabled:!button.disabled,
    }));
    const model = contextActionKeys([...controls,{kind:'more',visible:false,enabled:true}],overflowExpanded,nearby.expanded());
    if (!model.hasMore) overflowExpanded = false;
    const overflow = {visible:model.hasMore,expanded:model.showOverflow,shortcut:model.buttons.at(-1)?.key};
    const nextOverflowKey = JSON.stringify(overflow);
    if (nextOverflowKey!==overflowKey) {
      overflowKey = nextOverflowKey;
      flushSync(()=>overflowRoot.render(<ContextOverflow {...overflow} toggle={toggleOverflow}/>));
    }
    for (const [index,button] of buttons.entries()) {
      const {placement,key:shortcut} = model.buttons[index];
      if (placement) button.dataset.contextOverflow = placement==='primary' ? 'false' : placement==='overflow' ? 'expanded' : 'true';
      else delete button.dataset.contextOverflow;
      if (button.getAttribute('aria-keyshortcuts')===(shortcut ?? null)) continue;
      if (shortcut) button.setAttribute('aria-keyshortcuts',shortcut);
      else button.removeAttribute('aria-keyshortcuts');
    }
  }
  function onContextClick(event:MouseEvent) {
    if (event.target instanceof Element && event.target.closest('#nearby-objects') &&
      nearby.expanded()) overflowExpanded = false;
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
      if (!stations.hidden && nearby.expanded()) {
        event.preventDefault();
        nearby.close();
        refreshActionKeys();
      } else if (!stations.hidden && overflowExpanded) {
        event.preventDefault();
        toggleOverflow();
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
    const interactionView = exploring ? view : undefined;
    const installing = !!interactionView?.gameplay?.installationProgress;
    const hasFieldAction = renderField(installing ? undefined : interactionView,player);
    const meter = contextProgress(interactionView);
    const meterKey = JSON.stringify(meter) ?? '';
    if (progressKey!==meterKey) {
      progressKey = meterKey;
      progressRoot.render(meter ? <ContextProgress meter={meter}/> : null);
    }
    const canInteract = exploring && !installing && !player?.carrying && view?.gameplay?.officeChannel?.kind!=='office-cash' && view?.gameplay?.robberyProgress===undefined;
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
    nearby.render(player,canInteract);
    const hasLegislativeAction = legislative.render(view,context);
    const hasElectionAction = electoral.render(view,context,election.hasVoice());
    const hasShortcut = shortcuts.render(view,player,context);
    const hasAction = hasLegislativeAction || hasElectionAction || hasShortcut;
    if (!exploring || !canInteract) overflowExpanded = false;
    stations.hidden = !exploring || (!nearby.visible() && !hasAction && !meter && !hasFieldAction);
    refreshActionKeys();
  }

  return {
    notify,
    showReward:rewards.show,
    activityResult({activity,text}:RoomActivityResult) {
      const info = roomActivities[activity];
      if (text) notify(info.title,text);
    },
    render(view:PlenaryView) {
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
        if (view.phase==='negotiation' && view.project!==undefined && !view.cassationIn && view.remaining<=projectRules.warningSeconds && previous.remaining>projectRules.warningSeconds) {
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
      legislative.destroy();
      electoral.destroy();
      rewards.destroy();
      document.removeEventListener('keydown',onActionKey);
      stations.removeEventListener('click',onContextClick);
      for (const button of actionButtons()) {
        button.removeAttribute('aria-keyshortcuts');
      }
      stations.removeEventListener('click',onStationClick,true);
      stations.hidden = true;
      progressRoot.unmount();
      shortcuts.destroy();
      overflowRoot.unmount();
      fieldRoot.unmount();
    },
  };
}
