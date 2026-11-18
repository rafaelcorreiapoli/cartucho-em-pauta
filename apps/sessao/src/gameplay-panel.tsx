import {HudHelp} from './ui/hud-help';
import type {ComplaintProof} from './complaints';
import {createNearbyActions,type NearbyItem} from './ui/nearby-items';
import { DecorationCard, GameplayDialogHeader } from './ui/gameplay-dialog';
import { PhonePix } from './ui/phone-pix';
import type { PoliticsAction } from './politics';
import { PhoneCamera } from './ui/phone-camera';
import { PhoneSnake } from './ui/phone-snake';
import { PhoneCalls } from './ui/phone-call';
import {ProjectCatalog} from './ui/project-catalog';
import { PhoneApps, type PhoneApp } from './ui/phone-apps';
import { Backpack, Coffee, Grid2X2, Shirt, Download } from 'lucide';
import {HOTBAR_SLOTS, assignHotbarSlot, canPinToHotbar, emptyHotbar, pinPurchasedConsumable, reconcileHotbar} from './hotbar';
import type { ReactNode } from 'react';
import type {ShortcutEntry} from './action-shortcuts';
import {useDialogKeys} from './ui/use-dialog-keys';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { OfficeStash } from './ui/office-stash';
import { EquipmentPanel } from './ui/equipment-panel';
import { describeFood, foodDefinition, isFood } from './food';
import { isGear } from './equipment';
import { paintSnake } from './phone-snake';
import { hudConsumesKeys, isEditingText } from './game-keys';
import { installationSites } from './installations';
import { decorationLabel } from './photo-renderer';
import type { PhotoAccessView, PhotoScene } from './photography';
import { money, type Contact } from './politics';
import { createPhonePhotos } from './phone-photos';
import { canReachObject, canVerifyDocumentAt, cashAmount, itemQuantity, selectedItemQuantity, consumableAction, hasInventorySpace, occupiesInventorySlot, INVENTORY_SLOTS, objects, terminals, type GameplayAction, type ObjectKind, type WorldItem } from './gameplay';
import type { Motion } from './map';
import type { PlenaryView } from './plenary';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
type InteractionArea = (player:Motion) => boolean;

const bagIcons = {bag:Backpack,food:Coffee,gear:Shirt,grid:Grid2X2,drop:Download};

function BagIcon({name}:{name:keyof typeof bagIcons}) {
  return <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true">
    {bagIcons[name].map(([tag,attrs],index)=>{
      const Tag = tag as 'path'|'rect'|'line'|'circle';
      return <Tag key={index} {...attrs}/>;
    })}
  </svg>;
}

function itemName(item:Pick<WorldItem,'kind'|'document'|'quantity'>) {
  const name = item.document?.title ?? objects[item.kind].name;
  return itemQuantity(item)>1 ? `${name} ×${itemQuantity(item)}` : name;
}

import type { SpyOption } from "./surveillance";

function InventoryShortcuts({entries,numberActions,children,bag}:{
  entries:readonly ShortcutEntry[];numberActions:ReadonlyMap<string,()=>void>;children:ReactNode;bag?:boolean;
}) {
  const panel = useDialogKeys<HTMLDivElement>(key=>numberActions.get(key),entries);
  return <div ref={panel} className={bag ? "bag-layout" : undefined}>{children}</div>;
}

export function createGameplayPanel(send:(action:GameplayAction)=>void, ownId:string, notify:(text:string)=>void, drawPhoto:(canvas:HTMLCanvasElement,photo?:PhotoScene)=>void, sendSpy:(option:SpyOption)=>void, sendPolitics:(action:PoliticsAction)=>void, resetMail:()=>void, setPhoneInset:(width:number)=>void, submitComplaint:(proof:ComplaintProof)=>void) {
  const dialog = element<HTMLDialogElement>('gameplay-dialog');
  const body = element('gameplay-body');
  const headerRoot = createRoot(dialog.querySelector('header')!);
  const navigation = element('phone-apps');
  const navigationRoot = createRoot(navigation);
  const bodyRoot = createRoot(body);
  const mailHost = element('phone-mail');

  const slots = element('item-slots');
  const slotsRoot = createRoot(slots);
  const requestBox = element('object-request');
  const requestRoot = createRoot(requestBox);
  let requestEntries:ShortcutEntry[] = [];
  const nearbyActions = createNearbyActions();
  let selection: {id:number; source:'inventory'|'filed'} | undefined;
  let nearbyKey = '';
  let inventoryKey = '';
  let inventoryItems:WorldItem[] = [];
  let hotbar:readonly (number|undefined)[] = emptyHotbar();
  const purchases = new Set<number>();
  let assigningSlot:number|undefined;
  let pendingPickup:InteractionArea | undefined;
  let collectedArea:InteractionArea | undefined;
  let app:PhoneApp|'Denunciar'|undefined;
  let decorationId:number | undefined;
  let equipmentOpen = false;
  let stashOpen = false;
  let bagOpen = false;
  let offerTarget:Contact|undefined;
  const bagFilters = ['Todos','Equipamentos','Consumíveis'] as const;
  let bagFilter:typeof bagFilters[number] = 'Todos';
  let snakeBoard:HTMLCanvasElement|null = null;
  const setSnakeBoard = (board:HTMLCanvasElement|null) => { snakeBoard = board; };
  const photos = createPhonePhotos(send,drawPhoto,render);
  let previous:PlenaryView | undefined;
  let renderKey = '';
  let phoneOpen = false;
  function refreshPhoneInset() {
    setPhoneInset(phoneOpen ? dialog.offsetLeft+dialog.offsetWidth : 0);
  }
  const phoneResize = new ResizeObserver(refreshPhoneInset);
  phoneResize.observe(dialog);
  function syncPhoneOpen() {
    const open = dialog.open && dialog.dataset.mode==='phone';
    if (open===phoneOpen) return;
    phoneOpen = open;
    send({kind:open ? 'phone-open' : 'phone-close'});
    refreshPhoneInset();
  }
  let recipient = '';
  let quantity = 1;

  function objectCard(item:WorldItem, actions:readonly ObjectAction[] = [], chooseQuantity=false,
    shortcuts?:{entries:ShortcutEntry[];numberActions?:Map<string,()=>void>}) {
    const definition = objects[item.kind];
    const doc = item.document;
    const cash = cashAmount(item);
    const food = isFood(item.kind) ? foodDefinition(item.kind) : undefined;
    const isBag = bagOpen && chooseQuantity;
    const useLabel = consumableAction(item)?.label;
    const controls = isBag ? [...actions].sort((first,second)=>{
      const rank = (action:ObjectAction) => action.label==='Equipar' || action.label===useLabel ? 0 : action.label==='Largar no chão' ? 1 : 2;
      return rank(first)-rank(second);
    }) : actions;
    let detail:HTMLDetailsElement|null = null;
    let recipientSelect:HTMLSelectElement|null = null;
    const entries = shortcuts?.entries;
    const detailLabel = isBag ? 'Mais detalhes' : 'Inspecionar';
    entries?.push({name:detailLabel,activate:()=>{if (detail) detail.open = !detail.open;}});
    if (chooseQuantity && !offerTarget && previous?.gameplay?.contacts.length) {
      entries?.push({name:'Selecionar jogador',activate:()=>recipientSelect?.focus()});
    }
    if (chooseQuantity && itemQuantity(item)>1) {
      if (selectedItemQuantity(item,quantity)>1) entries?.push({name:'Diminuir quantidade',activate:()=>changeQuantity(item,-1)});
      if (selectedItemQuantity(item,quantity)<itemQuantity(item)) entries?.push({name:'Aumentar quantidade',activate:()=>changeQuantity(item,1)});
    }
    const focusHotbar = ()=>body.querySelector<HTMLButtonElement>('.bag-preview button:not(:disabled)')?.focus();
    if (chooseQuantity && bagOpen && !offerTarget && canPinToHotbar(item)) entries?.push({name:'Adicionar à hotbar',activate:focusHotbar});
    const canPin = chooseQuantity && !bagOpen && canPinToHotbar(item);
    const pinned = canPin && hotbar.includes(item.id);
    const updateHotbar = (slots:typeof hotbar) => {
      hotbar = slots;
      highlightSlot();
      renderKey = '';
      render();
    };
    const removeShortcut = ()=>updateHotbar(hotbar.map(id=>id===item.id ? undefined : id));
    if (pinned) entries?.push({name:'Remover atalho',activate:removeShortcut});
    let shortcut = 0;
    return <article className="object-card" key={item.id}>
      <div className={isBag ? "bag-item-info" : "object-card-content"}>
        <h3><img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+definition.portrait} alt="" draggable={false}/>{itemName(item)}{doc?.project!==undefined && <small> #{item.id}</small>}</h3>
        {bagOpen && chooseQuantity && <>
          <span className="bag-item-type">{isGear(item.kind) ? 'Equipamento' : consumableAction(item) ? 'Consumível' : doc ? 'Documento' : 'Objeto'}</span>
          <p className="bag-description">{doc?.description ?? definition.description}</p>
        </>}
        <details ref={node=>{detail=node;}}><summary>{detailLabel}</summary>
          {!(bagOpen && chooseQuantity) && <p>{doc?.description ?? definition.description}</p>}
          {doc && <>
            <p>Assinaturas {doc.signatures.length}/{doc.requiredSignatures} · {doc.signatures.map(person=>person.name).join(', ') || 'nenhuma'}</p>
            {doc.project===undefined && <p>Carimbos {doc.stamps.length}/{doc.requiredStamps.length} · {doc.requiredStamps.map(stamp=>doc.stamps.includes(stamp) ? '✓ '+stamp : stamp).join(', ')}</p>}
            {doc.requiredOffice && <p>Assinatura exigida: Parlamentar</p>}
          </>}
          {food && <p>{itemQuantity(item)} un. · {food.category} · {describeFood(food.effect)}</p>}
          {!!cash && <p>{money(cash)}</p>}
        </details>
        {chooseQuantity && !offerTarget && !!previous?.gameplay?.contacts.length && <label className={isBag ? 'bag-recipient' : 'object-recipient'}>Jogador
          <select ref={node=>{recipientSelect=node;}} value={recipient} onChange={event=>{recipient = event.currentTarget.value; render();}}>
            <option value="">Escolha…</option>
            {previous.gameplay.contacts.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>}
        {chooseQuantity && itemQuantity(item)>1 && <div role="group" aria-label={offerTarget ? 'Quantidade para oferecer' : 'Quantidade para oferecer ou largar'}>
          <button type="button" className="hud-button hud-button--secondary" aria-label="Diminuir quantidade" aria-keyshortcuts="ArrowLeft"
            disabled={selectedItemQuantity(item,quantity)===1} onClick={()=>changeQuantity(item,-1)}>− <kbd className="action-key" aria-hidden="true">←</kbd></button>
          <output aria-label="Quantidade selecionada"> {selectedItemQuantity(item,quantity)} / {itemQuantity(item)} </output>
          <button type="button" className="hud-button hud-button--secondary" aria-label="Aumentar quantidade" aria-keyshortcuts="ArrowRight"
            disabled={selectedItemQuantity(item,quantity)===itemQuantity(item)} onClick={()=>changeQuantity(item,1)}>+ <kbd className="action-key" aria-hidden="true">→</kbd></button>
        </div>}
      </div>
      <div className={isBag ? "bag-item-actions" : "object-card-content"}>
        {chooseQuantity && bagOpen && !offerTarget && <button type="button" className="bag-pin hud-button"
          disabled={!canPinToHotbar(item)} onClick={focusHotbar}>
          <span><BagIcon name="grid"/>Adicionar à hotbar</span><kbd className="action-key" aria-hidden="true">⇧1–6</kbd>
        </button>}
        {chooseQuantity && !bagOpen && <div className="bag-hotbar" role="group" aria-label="Adicionar à hotbar">
          <span><BagIcon name="grid"/>Adicionar à hotbar</span>
          {hotbar.map((id,index)=>{
            const label = `Vincular ao slot ${index+1}`;
            const key = `Shift+${index+1}`;
            const assign = ()=>updateHotbar(assignHotbarSlot(hotbar,index,item.id));
            if (canPin) {
              entries?.push({name:label,activate:assign});
              shortcuts?.numberActions?.set(key,assign);
            }
            return <button key={index} type="button" className="hud-button hud-button--secondary"
              disabled={!canPin} aria-label={label} aria-pressed={id===item.id}
              aria-keyshortcuts={canPin ? key : undefined} onClick={assign}><kbd aria-hidden="true">⇧ {index+1}</kbd></button>;
          })}
          {pinned && <button type="button" className="hud-button hud-button--secondary"
            onClick={removeShortcut}>Remover atalho</button>}
        </div>}
        {controls.map(({label,run,disabled})=>{
          const key = !disabled && shortcut<9 ? String(++shortcut) : undefined;
          if (!disabled) entries?.push({name:label,activate:run});
          if (key) shortcuts?.numberActions?.set(key,run);
          return <button type="button" key={label} className="hud-button hud-button--secondary"
            aria-keyshortcuts={key} disabled={disabled} onClick={run}><span>{isBag && (label==='Equipar' || label==='Largar no chão') && <BagIcon name={label==='Equipar' ? 'gear' : 'drop'}/>} {label}</span>{key && <kbd className="action-key" aria-hidden="true">{key}</kbd>}</button>;
        })}
      </div>
    </article>;
  }
  function changeQuantity(item:WorldItem,delta:number) {
    const next = selectedItemQuantity(item,selectedItemQuantity(item,quantity)+delta);
    if (next===quantity) return;
    quantity = next;
    render();
  }

  type ObjectAction = {label:string;run:()=>void;disabled?:boolean};

  function renderHeader() {
    const mode = dialog.dataset.mode;
    const title = mode==='phone' ? app ?? 'Celular' : mode==='bag' ? offerTarget ? `Oferecer item a ${offerTarget.name}` : 'Inventário' :
      stashOpen ? 'Armário particular' : mode==='equipment' ? 'Equipamentos' : 'Objeto';
    flushSync(()=>headerRoot.render(<GameplayDialogHeader title={title} bag={mode==='bag'}
      back={mode==='phone' && app && app!=='Denunciar' ? ()=>selectApp() : undefined}/>));
  }

  function open(item?:typeof selection, decoration?:number, equipment=false, stash=false, bag=false, target?:Contact) {
    selection = item;
    quantity = 1;
    decorationId = decoration;
    equipmentOpen = equipment;
    stashOpen = stash;
    bagOpen = bag;
    offerTarget = target;
    if (bag) bagFilter = 'Todos';
    if (!bag) assigningSlot = undefined;
    const object = !!item || decoration!==undefined;
    highlightSlot();
    photos.clearRecipient();
    renderKey = '';
    navigation.hidden = true;
    dialog.dataset.mode = bag ? 'bag' : equipment || stash ? 'equipment' : object ? 'item' : 'phone';
    renderHeader();
    if (!dialog.open) dialog.showModal();
    syncPhoneOpen();
    render();
  }

  function openPersonalAlbum() {
    app = 'Álbum';
    photos.resetSelection();
    open();
  }

  let navigationMounted = false;
  function selectApp(next?:PhoneApp) {
    if (app==='Joguinhos' && next!=='Joguinhos') {
      send({kind:'game-stop'});
    }
    photos.closePresentation();
    if (next==='Correio' && app!=='Correio') resetMail();
    app = next;
    renderHeader();
    photos.resetSelection();
    render();
  }

  const closePhoneApp = ()=>selectApp();

  function render() {
    const view = previous;
    const state = view?.gameplay;
    if (dialog.open && state?.vitality?.recovery) dialog.close();
    if (!dialog.open || !state || !view) return;
    const stash = stashOpen ? state.officeStash : undefined;
    if (stashOpen && !stash) { dialog.close(); return; }
    const phone = !selection && decorationId===undefined && !equipmentOpen && !stash && !bagOpen;
    const selected = selection;
    const item = selected && state[selected.source].find(item=>item.id===selected.id);
    const decoration = state.decorations.find(item=>item.id===decorationId);
    if (bagOpen && selection && !item) selection = undefined;
    if ((selection && !item) || (decorationId!==undefined && !decoration)) {
      dialog.close();
      return;
    }
    const directory = view.politics?.directory ?? [];
    const contacts = state.contacts;
    const canOffer = !!offerTarget && !!view.gameplay && contacts.some(person=>!person.bot && person.id===offerTarget?.id);
    if (!phone && !contacts.some(person=>person.id===recipient)) recipient = '';
    navigation.hidden = !phone || !!app;
    const showNavigation = phone && !app;
    if (showNavigation!==navigationMounted) {
      navigationMounted = showNavigation;
      flushSync(()=>navigationRoot.render(showNavigation ? <PhoneApps select={selectApp} close={()=>dialog.close()}/> : null));
    }
    const phase = view.phase;
    const canRemoveDecoration = !!decoration && state.interactive.some(item=>item.id===decoration.id) && hasInventorySpace(state.inventory.filter(occupiesInventorySlot).length);
    const visible = stash ? [stash,state.inventory] : equipmentOpen ? [state.equipped,state.modulator,state.megaphoneSeconds,state.equipmentCooldowns] : selection ? [item,state.locations,contacts,state.installable,state.officeStash?.id,state.officeDecor,state.surveillance?.options] : decoration ? [decoration,canRemoveDecoration] :
      app==='Denunciar' ? photos.complaintKey(view.complaints) :
      app==='Álbum' ? photos.albumKey(contacts,state.locations.includes('press')) :
      app==='Câmera' ? photos.count :
      app==='Projetos' ? [view.project,view.outcomes,view.projectFilingClosed,view.projectVoteExpired] :
      app==='Pix' ? [view.politics?.contacts,view.politics?.wallet,view.politics?.paymentsLeft,view.politics?.directory] :
      app==='Telefone' ? [state.call,directory.map(({id,name,character})=>({id,name,character}))] :
      [state.game?.status,state.game?.score,state.candy,state.bets,view.politics?.wallet];
    if (phone && app==='Joguinhos' && state.game && snakeBoard) paintSnake(snakeBoard,state.game);
    const nextKey = JSON.stringify([selection,recipient,canOffer,quantity,decorationId,equipmentOpen,stashOpen,bagOpen,bagFilter,assigningSlot,app,phase,visible,bagOpen ? state.inventory : undefined]);
    if (nextKey===renderKey) return;
    renderKey = nextKey;
    const previouslyFocused = document.activeElement;
    const focused = body.contains(previouslyFocused);
    let content:ReactNode;
    const inventoryShortcuts = {
      entries:[{name:'Fechar',activate:()=>dialog.close()}] as ShortcutEntry[],
      numberActions:new Map<string,()=>void>(),
    };
    if (stash) {
      content = <OfficeStash stash={stash} inventory={state.inventory} send={send} close={()=>dialog.close()}/>;
    }
    function renderBag(detail?:ReturnType<typeof objectCard>) {
      const inventory = state!.inventory.filter(occupiesInventorySlot);
      const filtered = inventory.filter(entry=>bagFilter==='Todos' ||
        (bagFilter==='Equipamentos' ? isGear(entry.kind) : !!consumableAction(entry)));
      const chooseFilter = (filter:typeof bagFilter)=>{bagFilter = filter;selection = undefined;render();};
      const chooseItem = (entry:WorldItem)=>{
        if (assigningSlot!==undefined) {
          hotbar = assignHotbarSlot(hotbar,assigningSlot,entry.id);
          dialog.close();
        } else {
          selection = {id:entry.id,source:'inventory'};
          quantity = 1;
          render();
        }
      };
      const entries = inventoryShortcuts.entries;
      for (const filter of bagFilters) entries.push({name:filter,activate:()=>chooseFilter(filter)});
      return <InventoryShortcuts {...inventoryShortcuts} bag>
        <div className="bag-filters flex gap-2" role="group" aria-label="Categoria de itens">
          {bagFilters.map(filter=><button key={filter} type="button" aria-pressed={bagFilter===filter}
            onClick={()=>chooseFilter(filter)}><BagIcon name={filter==='Todos' ? 'bag' : filter==='Equipamentos' ? 'gear' : 'food'}/>{filter}</button>)}
        </div>
        <div className="bag-storage">
          <div className="congress-bag">
            {Array.from({length:INVENTORY_SLOTS},(_,index)=>{
              const entry = filtered[index];
              const disabled = !!(entry && assigningSlot!==undefined && !canPinToHotbar(entry));
              if (entry && !disabled) entries.push({name:itemName(entry),activate:()=>chooseItem(entry)});
              return entry ? <button key={entry.id} type="button" className="item-tile" title={itemName(entry)}
                aria-label={itemName(entry)} aria-pressed={selection?.id===entry.id}
                disabled={disabled} onClick={()=>chooseItem(entry)}>
                <img className="item-portrait" alt="" src={import.meta.env.BASE_URL+'assets/'+objects[entry.kind].portrait}/>
                {itemQuantity(entry)>1 && <span className="slot-count">×{itemQuantity(entry)}</span>}
              </button> : <span className="item-tile item-tile-empty" aria-hidden="true" key={`empty-${index}`}>+</span>;
            })}
          </div>
          {offerTarget && bagFilter==='Todos' && state!.inventory.filter(entry=>entry.kind==='briefcase').map(entry=>{
            const label = `${itemName(entry)} · ${money(cashAmount(entry) ?? 0)}`;
            entries.push({name:label,activate:()=>chooseItem(entry)});
            return <button key={entry.id} type="button" className="hud-button hud-button--secondary"
              aria-pressed={selection?.id===entry.id} onClick={()=>chooseItem(entry)}>{label}</button>;
          })}
        </div>
        <div className="bag-detail">{offerTarget && !canOffer && <p role="status">Aproxime-se de {offerTarget.name} para oferecer um item.</p>}{detail ?? <p>{assigningSlot===undefined ? 'Selecione um item.' : `Escolha um item para o slot ${assigningSlot+1}.`}</p>}</div>
        {!offerTarget && <footer className="bag-preview">
          <strong>Hotbar <span>(atalhos rápidos)</span></strong>
          <div className="bag-preview-slots">
            {hotbar.map((id,index)=>{
              const pinned = inventory.find(entry=>entry.id===id);
              const pin = ()=>{if (item) pinBagItem(item,index);};
              const canPin = !!item && canPinToHotbar(item);
              const label = `Vincular ao slot ${index+1}`;
              if (canPin) entries.push({name:label,activate:pin});
              return <button type="button" key={index} className="item-tile"
                disabled={!canPin} aria-pressed={!!item && item.id===id}
                aria-label={label} aria-keyshortcuts={canPin ? `Shift+${index+1}` : undefined} onClick={pin}>
                <kbd className="slot-key" aria-hidden="true">⇧ {index+1}</kbd>
                {pinned ? <img alt={itemName(pinned)} src={import.meta.env.BASE_URL+'assets/'+objects[pinned.kind].portrait}/> : <span aria-hidden="true">+</span>}
              </button>;
            })}
          </div>
        </footer>}
      </InventoryShortcuts>;
    }
    if (bagOpen && !item) {
      content = renderBag();
    }
    if (equipmentOpen) {
      content = <EquipmentPanel state={state} available={!!previous?.gameplay && !state.vitality?.recovery}
        send={send} close={()=>dialog.close()}/>;
    }

    if (item) {
      const actions:ObjectAction[] = [];
      const act = (label:string,kind:GameplayAction['kind'],place?:string) => {
        const transferQuantity = (kind==='offer' || kind==='drop') && itemQuantity(item)>1
          ? {quantity:selectedItemQuantity(item,quantity)} : {};
        actions.push({label,run:()=>send({kind,item:item.id,target:recipient,place,...transferQuantity})});
      };
      if (offerTarget) {
        const target = offerTarget.id;
        actions.push({label:'Oferecer',disabled:!canOffer,run:()=>{
          send({kind:'offer',item:item.id,target,quantity:selectedItemQuantity(item,quantity)});
          dialog.close();
        }});
      } else if (selection?.source==='inventory') {
        const definition = objects[item.kind];
        if (cashAmount(item) && state.locations.includes('treasury')) act('Entregar ao tesoureiro','deliver','treasury');
        const spyOptions = state.surveillance?.options.filter(option=>option.item===item.id) ?? [];
        spyOptions.forEach(option=>{
          actions.push({label:option.label,run:()=>{ sendSpy(option); dialog.close(); }});
        });
        if (state.officeStash) act('Guardar no armário particular','office-stash',state.officeStash.id);
        const decorSlot = state.officeDecor?.find(slot=>slot.kind===item.kind);
        if (decorSlot) act('Instalar no gabinete','office-install',decorSlot.id);
        if (isGear(item.kind) && !!previous?.gameplay) act('Equipar','equip');
        else if (bagOpen) actions.push({label:'Equipar',disabled:true,run:()=>{}});
        const consumable = consumableAction(item);
        if (consumable) actions.push({label:consumable.label,run:()=>{
          send(consumable.action);
          if (item.kind==='briefcaseTracker') dialog.close();
        }});
        if (!!previous?.gameplay) for (const [key,site] of Object.entries(installationSites)) {
          if (item.kind!==site.kind) continue;
          const label = item.kind==='pizza' ? 'Servir na mesa' : item.kind==='vip' ? 'Reservar cadeira' : 'Instalar ou substituir';
          if (state.installable.includes(key)) act(`${label} · ${site.label}`,'install',key);
        }
        if (contacts.length) {
          if (contacts.some(person=>!person.bot) && !contacts.some(person=>person.id===recipient && person.bot)) act('Oferecer','offer');
          if (item.document && (item.document.project===undefined || item.document.requiredSignatures>0)) act('Pedir assinatura','sign-request');
        }
        act('Largar no chão','drop');
        if ('destructible' in definition) act('Destruir','destroy');
        for (const place of state.locations) {
          const terminal = terminals[place as keyof typeof terminals];
          if ('storage' in terminal) act(`Guardar · ${terminal.title}`,'store',place);
          if (item.document && item.document.project===undefined && 'stamp' in terminal) act(`Carimbar · ${terminal.stamp}`,'stamp',place);
          if (item.document && canVerifyDocumentAt(place)) act('Verificar documento','verify-document',place);
        }
      }
      const detail = objectCard(item,actions,selection?.source==='inventory',inventoryShortcuts);
      content = bagOpen ? renderBag(detail) : <InventoryShortcuts {...inventoryShortcuts}>{detail}</InventoryShortcuts>;
    }
    if (decoration) {
      content = <DecorationCard decoration={decoration} ownId={ownId}
        exploring={!!previous?.gameplay} canRemove={canRemoveDecoration} send={send} close={()=>dialog.close()}/>;
    }
    const showMail = phone && app==='Correio';
    if (phone && app && !showMail) {
      let application:ReactNode;
      if (app==='Telefone') application = <PhoneCalls call={state.call} contacts={directory.filter(person=>person.id!==ownId)}
        available={!!previous?.gameplay} send={send} close={closePhoneApp}/>;
      if (app==='Joguinhos') application = <PhoneSnake game={state.game} bets={state.bets} candy={state.candy} wallet={view.politics?.wallet ?? 0} available={!!previous?.gameplay} board={setSnakeBoard} send={send} close={closePhoneApp}/>;
      if (app==='Câmera') application = <PhoneCamera character={directory.find(person=>person.id===ownId)?.character} count={photos.count}
        available={!!previous?.gameplay} preview={photos.setPreview} send={send} openAlbum={openPersonalAlbum} close={closePhoneApp}/>;
      if (app==='Pix' && view.politics) application = <PhonePix ownId={ownId} politics={view.politics} send={sendPolitics} close={closePhoneApp}/>;
      if (app==='Projetos') application = <ProjectCatalog project={view.project} outcomes={view.outcomes} projectFilingClosed={view.projectFilingClosed} projectVoteExpired={view.projectVoteExpired} close={closePhoneApp}/>;
      if (app==='Denunciar') application = photos.renderComplaintAlbum(view.complaints,submitComplaint,()=>dialog.close());
      if (app==='Álbum') application = photos.renderAlbum(contacts,directory,state.locations.includes('press') && !!previous?.gameplay,closePhoneApp);
      if (application) content = <div key={app} className="phone-app-content">{application}</div>;
    }
    mailHost.hidden = !showMail;
    body.hidden = showMail || phone && !app;
    flushSync(()=>bodyRoot.render(body.hidden ? null :
      content ?? <p>{phone ? 'Nenhuma informação disponível.' : 'Nenhum objeto disponível.'}</p>));
    if (phone && app==='Joguinhos' && state.game && snakeBoard) paintSnake(snakeBoard,state.game);
    if (focused && !body.contains(previouslyFocused)) body.querySelector<HTMLButtonElement>('button')?.focus();
  }

  function renderSlots(inventory:WorldItem[]) {
    const key = JSON.stringify(inventory);
    if (key===inventoryKey && !purchases.size) return;
    inventoryKey = key;
    inventoryItems = inventory;
    hotbar = reconcileHotbar(hotbar,inventory);
    for (const item of inventory) {
      if (purchases.delete(item.id) && consumableAction(item)) hotbar = pinPurchasedConsumable(hotbar,item.id);
    }
    highlightSlot();
  }

  function activateHotbar(index:number) {
    const item = inventoryItems.find(entry=>entry.id===hotbar[index]);
    if (!item) {
      assigningSlot = index;
      open(undefined,undefined,false,false,true);
      return;
    }
    const use = consumableAction(item);
    if (use) send(use.action);
    else open({id:item.id,source:'inventory'});
  }

  function hotbarControl(index:number) {
    const item = inventoryItems.find(entry=>entry.id===hotbar[index]);
    const shortcut = index+1;
    const use = item && consumableAction(item);
    const name = item && itemName(item);
    const label = item ? use ? `${use.label} · ${name}` : `Abrir ${name}` : `Escolher item para o slot ${shortcut}`;
    return {item,shortcut,use,label};
  }

  function hotbarVisible() {
    return !slots.hidden && slots.parentElement?.checkVisibility({visibilityProperty:true,opacityProperty:true});
  }

  function hotbarShortcuts():ShortcutEntry[] {
    if (!hotbarVisible()) return [];
    return Array.from({length:HOTBAR_SLOTS},(_,index)=>{
      const {item,label} = hotbarControl(index);
      return {name:label,activate:()=>{
        if (hotbarVisible() && hotbar[index]===item?.id) activateHotbar(index);
      }};
    });
  }

  function highlightSlot() {
    slotsRoot.render(Array.from({length:HOTBAR_SLOTS},(_,index)=>{
      const {item,shortcut,use,label} = hotbarControl(index);
      const badge = <kbd className="slot-key" aria-hidden="true">⇧ + {shortcut}</kbd>;
      if (!item) return <HudHelp className="item-tile item-tile-empty" key={index}
        aria-label={label} help={`Vincule um item da mochila a este atalho. (Shift+${shortcut})`}
        onClick={()=>activateHotbar(index)}>
        {badge}<span className="slot-plus" aria-hidden="true">+</span>
      </HudHelp>;
      return <HudHelp key={index} className="item-tile" data-kind={item.kind} data-item={item.id}
        aria-label={label} help={`${label} (Shift+${shortcut})`} aria-haspopup={use ? undefined : "dialog"}
        aria-expanded={selection?.source==='inventory' && selection.id===item.id} aria-keyshortcuts={`Shift+${shortcut}`}
        onClick={()=>activateHotbar(index)}>
        <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+objects[item.kind].portrait} alt="" draggable={false}/>
        {itemQuantity(item)>1 && <span className="slot-count">{itemQuantity(item)}</span>}{badge}
      </HudHelp>;
    }));
  }

  function pinBagItem(item:WorldItem,index:number) {
    if (!canPinToHotbar(item)) return;
    hotbar = hotbar[index]===item.id ? hotbar.map((id,slot)=>slot===index ? undefined : id) : assignHotbarSlot(hotbar,index,item.id);
    highlightSlot();
    renderKey = '';
    render();
  }

  const onSlotKey = (event:KeyboardEvent) => {
    if (event.isComposing) return;
    if (dialog.open && dialog.contains(document.activeElement) && selection?.source==='inventory' && !event.defaultPrevented &&
        !event.ctrlKey && !event.altKey && !event.metaKey && !isEditingText(event.target) &&
        (event.key==='ArrowLeft' || event.key==='ArrowRight')) {
      const item = inventoryItems.find(entry=>entry.id===selection?.id);
      if (item && itemQuantity(item)>1) {
        event.preventDefault();
        changeQuantity(item,event.key==='ArrowLeft' ? -1 : 1);
        return;
      }
    }
    if (bagOpen && !offerTarget && dialog.matches('dialog:modal') && dialog.contains(document.activeElement) && selection?.source==='inventory' &&
        event.shiftKey && !event.defaultPrevented && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey &&
        !isEditingText(event.target) && /^Digit[1-6]$/.test(event.code)) {
      const item = inventoryItems.find(entry=>entry.id===selection?.id);
      if (item && canPinToHotbar(item)) {
        event.preventDefault();
        pinBagItem(item,Number(event.code.at(-1))-1);
        return;
      }
    }
    if (dialog.open || slots.hidden || !event.shiftKey || event.repeat || event.defaultPrevented || event.ctrlKey || event.altKey ||
      event.metaKey || hudConsumesKeys(event.target) || !/^Digit[1-6]$/.test(event.code)) return;
    event.preventDefault();
    activateHotbar(Number(event.code.at(-1))-1);
  };
  document.addEventListener('keydown',onSlotKey);
  function pickUp(area:InteractionArea, action:()=>void) {
    if (pendingPickup) return;
    pendingPickup = area;
    action();
  }

  const closed = () => {
    if (dialog.open) return;
    syncPhoneOpen();
    bodyRoot.render(null);
    mailHost.hidden = true;
    renderKey = '';
    selection = undefined;
    assigningSlot = undefined;
    highlightSlot();
    photos.closePresentation();
  };
  dialog.addEventListener('close',closed);

  return {
    openComplaint() {
      app = 'Denunciar';
      photos.resetSelection();
      open();
    },
    openPhone() { app = undefined; open(); },
    closePhoneApp,
    close() { dialog.close(); },
    restorePhoneActivity() { if (phoneOpen) send({kind:'phone-open'}); },
    openBag() { open(undefined,undefined,false,false,true); },
    openOffer(id:string) {
      const target = previous?.gameplay?.contacts.find(contact=>!contact.bot && contact.id===id);
      if (!target) return;
      assigningSlot = undefined;
      open(undefined,undefined,false,false,true,target);
    },
    openEquipment() { open(undefined,undefined,true); },
    itemObtained(pickup:boolean) {
      if (!pickup || !pendingPickup) return;
      collectedArea = pendingPickup;
      pendingPickup = undefined;
      nearbyKey = '';
      nearbyActions.update([]);
    },
    nearbyActions,
    requestShortcuts:()=>requestEntries,
    hotbarShortcuts,
    nearby(player:Motion | undefined, exploring:boolean, directCollections:readonly number[]) {
      if (collectedArea) {
        if (exploring && (!player || collectedArea(player))) return;
        collectedArea = undefined;
      }
      const state = exploring ? previous?.gameplay : undefined;
      const key = JSON.stringify(state ? [state.nearby,state.stored,state.filed,state.locations,state.interactive,photos.count,directCollections] : null);
      if (key===nearbyKey) return;
      nearbyKey = key;
      const tiles:NearbyItem[] = [];
      const add = (key:string,kind:ObjectKind,name:string,verb:string,activate:()=>void) =>
        tiles.push({key,kind,name,verb,activate});
      if (state) {
        for (const item of state.nearby) {
          if (directCollections.includes(item.id)) continue;
          add('ground-'+item.id,item.kind,itemName(item),'Pegar',
            ()=>pickUp(player=>canReachObject(player,item),()=>send({kind:'collect',item:item.id})));
        }
        const storage = state.locations.map(place=>terminals[place as keyof typeof terminals])
          .filter(terminal=>'storage' in terminal);
        for (const item of state.stored) {
          add('stored-'+item.id,item.kind,itemName(item),'Recuperar',()=>pickUp(
            player=>storage.some(terminal=>canReachObject(player,terminal.point)),
            ()=>send({kind:'recover',item:item.id}),
          ));
        }
        if (state.locations.includes('press') && photos.count) {
          add('album','portrait','Álbum para a Imprensa','Abrir',openPersonalAlbum);
        }
        for (const decoration of state.interactive) {
          add('decoration-'+decoration.id,decoration.kind,decorationLabel(decoration),'Inspecionar',()=>open(undefined,decoration.id));
        }
        for (const place of state.locations) {
          const terminal = terminals[place as keyof typeof terminals];
          if (!('supply' in terminal) || terminal.supply==='document') continue;
          add('supply-'+place,terminal.supply,objects[terminal.supply].name,'Pegar',()=>pickUp(
            player=>canReachObject(player,terminal.point),
            ()=>send({kind:'supply',place}),
          ));
        }
        for (const item of state.filed) {
          add('filed-'+item.id,item.kind,itemName(item),'Consultar',()=>open({id:item.id,source:'filed'}));
        }
      }
      nearbyActions.update(tiles);
    },
    render(view:PlenaryView) {
      const call = view.gameplay?.call;
      const incoming = view.gameplay?.requests.at(0);
      const information = view.gameplay && photos.request;
      const old = previous?.gameplay;
      previous = view;
      if (!view.gameplay) { pendingPickup = undefined; nearbyActions.update([]); nearbyKey = ''; }
        if (!view.gameplay && dialog.open) dialog.close();
      slots.hidden = !view.gameplay;
      if (view.gameplay) renderSlots(view.gameplay.inventory.filter(occupiesInventorySlot));
      if (call?.state==='connected' && old?.call?.state!=='connected' && dialog.dataset.mode==='phone' && app==='Telefone') dialog.close();
      if (call?.state==='incoming' && old?.call?.state!=='incoming' && !document.querySelector('dialog:modal')) {
        app = 'Telefone';
        open();
      }
      const requestKey = information ? `info-${information.id}` : String(incoming?.id ?? '');
      if (requestKey!==requestBox.dataset.request) {
        requestBox.dataset.request = requestKey;
        requestBox.hidden = !incoming && !information;
        const entries:ShortcutEntry[] = [];
        const respond = (kind:GameplayAction['kind'],item:number)=>()=>send({kind,item});
        if (information) {
          const accept = respond('info-accept',information.id);
          const decline = respond('info-decline',information.id);
          entries.push({name:'Aceitar fotografia',activate:accept},{name:'Recusar fotografia',activate:decline});
          requestRoot.render(<article className="object-card">
            <p>{information.from.name} quer {information.mode==='copy' ? 'enviar uma cópia de' : 'mostrar'} uma fotografia.</p>
            <button className="hud-button hud-button--secondary" onClick={accept}>Aceitar</button>
            <button className="hud-button hud-button--secondary" onClick={decline}>Recusar</button>
          </article>);
        } else if (incoming) {
          const label = incoming.kind==='signature' ? 'Assinar' : 'Aceitar';
          const accept = respond('accept',incoming.id);
          const decline = respond('decline',incoming.id);
          requestRoot.render(<><p>{incoming.from.name} {incoming.kind==='signature' ? 'pede uma assinatura' : 'oferece um objeto'}</p>
            {objectCard(incoming.item,[
              {label,run:accept},{label:'Recusar',run:decline},
            ],false,{entries})}</>);
        } else requestRoot.render(null);
        requestEntries = entries.map(({name,activate})=>({
          name,activate:()=>{if (requestBox.dataset.request===requestKey) activate();},
        }));
      }
      render();
    },
    purchasedConsumable(id:number) { purchases.add(id); },
    inspectBriefcase(id:number) { open({id,source:'inventory'}); },
    inspectDecoration(id:number) { open(undefined,id); },
    openStash() { if (previous?.gameplay?.officeStash) open(undefined,undefined,false,true); },
    photoState(next:PhotoAccessView) {
      const {captured,presented} = photos.update(next);
      if (presented) {
        app = 'Álbum';
        open();
      }
      if (previous) this.render(previous);
      if (captured) photos.flash();
      return captured;
    },
    resetPendingPickup() { pendingPickup = undefined; },
    feedback(text:string) {
      pendingPickup = undefined;
      notify(text);
    },
    destroy() {
      photos.destroy();
      document.removeEventListener('keydown',onSlotKey);
      phoneResize.disconnect();
      setPhoneInset(0);
      dialog.removeEventListener('close',closed);
      dialog.close();
      element('object-request').hidden = true;
      delete element('object-request').dataset.request;
      headerRoot.unmount();
      navigationRoot.unmount();
      bodyRoot.unmount();
      mailHost.hidden = true;
      slots.hidden = true;
      slotsRoot.unmount();
      requestRoot.unmount();
    },
  };
}
