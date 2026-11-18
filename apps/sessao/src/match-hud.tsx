import type {ShortcutEntry} from './action-shortcuts';
import {fieldActions,type FieldAction} from './ui/field-actions';
import {ContextActionButton} from './ui/context-action-button';
import {ContextProgress,contextProgress} from './ui/context-progress';
import {mountRewardEffects} from './ui/reward-effects';
import {ContextOverflow} from './ui/context-overflow';
import {NearbyActions,type NearbyItem} from './ui/nearby-items';
import {contextActionKeys,type ContextKey} from './ui/context-action-keys';
import {StationShortcuts,stationShortcuts,type Shortcut} from './ui/station-shortcuts';
import { equipmentControls, mountEquippedGear, weaponControl, type EquipmentAction } from './ui/equipped-gear';
import { ElectionStationActions,electionStationActions,electionButtons } from './ui/election-station-actions';
import {mountCampaignPicker} from './ui/campaign-picker';
import type { ElectionAction } from './elections';
import { LegislativeStationActions,legislativeStationActions,legislativeButtons } from './ui/legislative-station-actions';
import { mountNotices } from './ui/notices';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { equippedWeapon } from './equipment';
import { hudConsumesKeys } from './game-keys';
import type { Motion, Player } from './map';
import { money } from './politics';
import { stations as stationPoints, canReachStation, stabilityRules, STATION_RADIUS, type Action, type PlenaryView, type Station } from './plenary';
import { roomActivities, type RoomActivity, type RoomActivityResult } from './room-activities';


const noNearbyItems:readonly NearbyItem[] = [];
const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

export function createMatchHud(id:string, stationFeedback:(station:Station) => void, sendActivity:(activity:RoomActivity) => void,
  nearby:{render:(player:Motion | undefined,exploring:boolean,directCollections:readonly number[])=>void;get:()=>readonly NearbyItem[]}, sendField:(action:FieldAction)=>void, institutional:{openInstitutional:()=>void;openDossier:()=>void},
  sendLegislative:(action:Exclude<Action,'audit'> | 'denounce')=>void,election:{send:(action:ElectionAction)=>void;hasVoice:()=>boolean}) {
  const rewards = mountRewardEffects(element('wallet-effects'));
  const notices = mountNotices(element('hud-notices'));
  const {notify} = notices;
  const stations = element('stations');
  const campaign = mountCampaignPicker(advertisement=>election.send({kind:'advertise',advertisement}));
  function selectElection(kind:keyof typeof electionButtons) {
    if (kind==='advertise') campaign.open();
    else election.send({kind});
  }
  const contextRoot = createRoot(element('context-actions-mount'));
  let nearbyOpen = false;
  let overflowExpanded = false;
  let contextKey = '';
  let lastItems:readonly NearbyItem[] = [];
  const paletteActions = new Map<string,ShortcutEntry>();
  const keyboardActions = new Map<string,{activate:()=>void;station?:Station}>();

  function selectShortcut(kind:Shortcut['kind']) {
    switch (kind) {
      case 'grant': institutional.openInstitutional(); return;
      case 'publish': institutional.openDossier(); return;
      default: sendActivity(kind);
    }
  }
  function toggleOverflow() {
    overflowExpanded = !overflowExpanded;
    if (overflowExpanded) nearbyOpen = false;
    actions();
  }
  function toggleNearby() {
    nearbyOpen = !nearbyOpen;
    if (nearbyOpen) overflowExpanded = false;
    actions();
    if (nearbyOpen) element('nearby-items')?.scrollTo(0,0);
  }
  const gear = mountEquippedGear(element('equipped-gear'),useEquipped);
  function useEquipped(kind:EquipmentAction) {
    const equipped = previous?.gameplay?.equipped;
    if (previous?.phase!=='negotiation' || !own || own.knockedOut || own.carrying || own.carried) return false;
    if (kind==='attack' ? !equippedWeapon(equipped) :
        !equipped?.some(item=>equipmentControls[item.kind as keyof typeof equipmentControls]?.action===kind)) return false;
    sendField({kind});
    return true;
  }

  let roster:Player[] = [];
  let own:Player | undefined;

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
      if (!stations.hidden && (nearbyOpen || overflowExpanded)) {
        event.preventDefault();
        nearbyOpen = overflowExpanded = false;
        actions();
      }
      return;
    }
    if (stations.hidden || event.shiftKey) return;
    const command = keyboardActions.get(event.key);
    if (!command) return;
    event.preventDefault();
    if (command.station) {
      const button = stations.querySelector<HTMLButtonElement>(`button[aria-keyshortcuts="${event.key}"]`);
      if (button) animateStation(button);
      stationFeedback(command.station);
    }
    command.activate();
  }
  document.addEventListener('keydown',onActionKey);

  function onStationClick(event:MouseEvent) {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-station]');
    if (!button || button.disabled) return;
    animateStation(button);
    stationFeedback(button.dataset.station as Station);
  }

  function animateStation(button:HTMLButtonElement) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      button.animate([
        {filter:'brightness(1.55)',transform:'translateY(4px)'},
        {filter:'brightness(1)',transform:'translateY(0)'},
      ],{duration:230,easing:'ease-out'});
    }
  }
  stations.addEventListener('click',onStationClick,true);
  let previous:PlenaryView | undefined;

  function actions(view:PlenaryView | undefined = previous) {
    const player = own;
    const exploring = view?.phase==='negotiation' && !player?.knockedOut;
    const interactionView = exploring ? view : undefined;
    const installing = !!interactionView?.gameplay?.installationProgress;
    const field = fieldActions(installing ? undefined : interactionView,player,roster);
    const meter = contextProgress(interactionView);
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
    const directCollections = field.flatMap(({action})=>action.kind==='collect' && action.item!==undefined ? [action.item] : []);
    nearby.render(player,canInteract,directCollections);
    const items = canInteract ? nearby.get() : noNearbyItems;
    if (!items.length || (nearbyOpen && document.querySelector('dialog:modal:not(#action-shortcuts)'))) nearbyOpen = false;
    if (!exploring || !canInteract) overflowExpanded = false;
    const legislative = legislativeStationActions(view,context);
    const electoral = electionStationActions(view,context,election.hasVoice());
    campaign.update(electoral.actions.includes('advertise') ? view?.politics?.wallet : undefined);
    const shortcuts = stationShortcuts(view,player,context);
    const key = JSON.stringify([legislative,electoral,shortcuts,field,meter,nearbyOpen,overflowExpanded]);
    stations.hidden = !exploring || !(items.length || legislative.length || electoral.actions.length || electoral.voiceHint ||
      shortcuts.length || meter || field.length);
    if (key===contextKey && items===lastItems) return;
    contextKey = key;
    lastItems = items;

    const groups = [
      legislative.map(action=>({...legislativeButtons[action],action,activate:()=>sendLegislative(action)})),
      electoral.actions.map(kind=>({...electionButtons[kind],id:kind,activate:()=>selectElection(kind)})),
      shortcuts.map(({kind,...button})=>({...button,activate:()=>selectShortcut(kind)})),
      field.map(({action,...button})=>({...button,activate:()=>sendField(action)})),
    ] as const;
    const targetActions = new Map<string,number[]>();
    for (const [index,button] of groups[3].entries()) {
      if (!button.target) continue;
      const members = targetActions.get(button.target.id) ?? [];
      members.push(index);
      targetActions.set(button.target.id,members);
    }
    const groupIds = [legislative,electoral.actions,shortcuts.map(action=>action.kind),field.map(({action})=>JSON.stringify(action))];
    const normal = groups.map((group,groupIndex)=>group.map((button,index)=>({
      id:groupIndex+':'+groupIds[groupIndex][index], name:button.label,
      group:'target' in button ? button.target?.id : undefined,
      kind:'action' as const,visible:true,enabled:!('blocked' in button && button.blocked) && !('disabled' in button && button.disabled),
      activate:button.activate,station:'station' in button ? button.station : undefined,
    })));
    const trigger = {id:'nearby',name:'Objetos próximos',kind:'nearby' as const,visible:items.length>0,enabled:true,activate:toggleNearby,station:undefined};
    const tiles = items.map(item=>({id:'item:'+item.key,name:item.verb+' '+item.name,kind:'item' as const,visible:nearbyOpen,enabled:true,activate:item.activate,station:undefined}));
    const more = {id:'more',name:'Mais ações',kind:'more' as const,visible:false,enabled:true,activate:toggleOverflow,station:undefined};
    const controls = [...normal[0],...normal[1],trigger,...tiles,...normal[2],...normal[3],more];
    const model = contextActionKeys(controls,overflowExpanded,nearbyOpen);
    if (!model.hasMore) overflowExpanded = false;
    keyboardActions.clear();
    paletteActions.clear();
    const presentation = new Map<typeof controls[number],ContextKey>();
    for (const [index,control] of controls.entries()) {
      const {key,placement} = model.buttons[index];
      if (key) keyboardActions.set(key,control);
      if (control.enabled && (placement==='primary' || placement==='overflow' ||
          control.kind==='item' && control.visible || control.kind==='more' && model.hasMore)) {
        paletteActions.set(control.id,{name:control.name,activate:()=>{
          if (control.station) stationFeedback(control.station);
          control.activate();
        }});
      }
      presentation.set(control,{key,overflow:placement==='primary'?'false':placement==='overflow'?'expanded':placement==='hidden'?'true':undefined});
    }
    const keysFor = (index:number)=>normal[index].map(control=>presentation.get(control)!);

    const fieldButton = (index:number,shortLabel?:string)=>{
      const {target,...button} = groups[3][index];
      return <ContextActionButton key={groupIds[3][index]} {...button}
        label={shortLabel ?? button.label} accessibleLabel={shortLabel ? button.label : undefined}
        presentation={presentation.get(normal[3][index])}/>;
    };

    flushSync(()=>contextRoot.render(<>
      <div id="legislative-station-actions" className="station-grid"><LegislativeStationActions actions={legislative} send={sendLegislative} keys={keysFor(0)}/></div>
      <div id="station-election-actions" className="station-grid">
        <ElectionStationActions {...electoral} send={selectElection} keys={keysFor(1)}/>
      </div>
      <div id="office-progress-mount">{meter && <ContextProgress meter={meter}/>}</div>
      <div id="nearby-actions" className="context-nearby"><NearbyActions items={items} expanded={nearbyOpen}
        trigger={presentation.get(trigger)} keys={tiles.map(tile=>presentation.get(tile)!)} toggle={toggleNearby}/></div>
      <div id="station-shortcuts"><StationShortcuts actions={shortcuts} select={selectShortcut} keys={keysFor(2)}/></div>
      <div id="field-actions">{groups[3].map(({target},index)=>{
        const members = target && targetActions.get(target.id);
        if (!target || !members || members.length===1) return fieldButton(index);
        if (members[0]!==index) return null;
        const overflow = presentation.get(normal[3][index])?.overflow;
        return <div key={target.id} className="context-target" role="group" aria-label={target.name} data-context-overflow={overflow}>
          <span className="context-target-name">{target.name}</span>
          <div className="context-target-buttons">
            {members.map(member=>fieldButton(member,groups[3][member].target?.verb))}
          </div>
        </div>;
      })}</div>
      <div id="context-overflow"><ContextOverflow visible={model.hasMore} expanded={model.showOverflow}
        shortcut={presentation.get(more)?.key} toggle={toggleOverflow}/></div>
    </>));
  }

  return {
    notify,
    showReward:rewards.show,
    refreshActions:()=>actions(),
    equippedShortcuts:gear.shortcuts,
    contextualShortcuts:()=>stations.hidden ? [] : [...paletteActions].map(([id,{name}])=>({
      name,activate:()=>{ if (!stations.hidden) paletteActions.get(id)?.activate(); },
    })),
    activityResult({activity,text}:RoomActivityResult) {
      const info = roomActivities[activity];
      if (text) notify(info.title,text);
    },
    render(view:PlenaryView) {
      const politics = view.politics;

      if (previous) {
        const past = previous.politics;
        const payment = view.payroll?.last;
        if (payment?.received && payment.at!==previous.payroll?.last?.at) {
          notify('Salário parlamentar',`${money(payment.received)} recebidos.`);
        }
        const notice = view.election?.notice;
        if (notice && notice.seq!==previous.election?.notice?.seq && !view.election?.broadcast) {
          notify(view.election?.result?.cycle!==previous.election?.result?.cycle ? 'Renovação de Mandato' : 'Campanha',notice.text);
        }
        if (view.projectWarning && !previous.projectWarning) {
          notify('Votação de projeto',`Plenário em ${view.projectWarning} s.`);
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
      rewards.destroy();
      campaign.destroy();
      document.removeEventListener('keydown',onActionKey);
      stations.removeEventListener('click',onStationClick,true);
      stations.hidden = true;
      contextRoot.unmount();
    },
  };
}
