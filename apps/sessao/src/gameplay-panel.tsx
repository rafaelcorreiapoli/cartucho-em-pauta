import {NearbyItems,type NearbyItem} from './ui/nearby-items';
import { DecorationCard, GameplayDialogHeader } from './ui/gameplay-dialog';
import { PhonePix } from './ui/phone-pix';
import type { PoliticsAction } from './politics';
import { PhoneCamera } from './ui/phone-camera';
import { PhoneSnake } from './ui/phone-snake';
import { PhoneCalls } from './ui/phone-call';
import {ProjectCatalog} from './ui/project-catalog';
import { PhoneApps, type PhoneApp } from './ui/phone-apps';
import { Backpack, Coffee, Grid2X2, Shirt, Download } from 'lucide';
import {assignHotbarSlot, canPinToHotbar, emptyHotbar, pinPurchasedConsumable, reconcileHotbar} from './hotbar';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { OfficeStash } from './ui/office-stash';
import { describeFood, foodDefinition, isFood } from './food';
import { isGear } from './equipment';
import { paintSnake, snakeDirection } from './phone-snake';
import { hudConsumesKeys } from './game-keys';
import { installationSites } from './installations';
import { decorationLabel } from './photo-renderer';
import type { PhotoAccessView, PhotoScene } from './photography';
import { money } from './politics';
import { createPhonePhotos } from './phone-photos';
import { canReachObject, canVerifyDocumentAt, cashAmount, itemQuantity, selectedItemQuantity, consumableAction, hasInventorySpace, INVENTORY_SLOTS, objects, terminals, type GameplayAction, type ObjectKind, type WorldItem } from './gameplay';
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

export function createGameplayPanel(send:(action:GameplayAction)=>void, ownId:string, notify:(text:string)=>void, drawPhoto:(canvas:HTMLCanvasElement,photo?:PhotoScene)=>void, sendSpy:(option:SpyOption)=>void, sendPolitics:(action:PoliticsAction)=>void, resetMail:()=>void, setPhoneInset:(width:number)=>void) {
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
  const nearbyItems = element('nearby-items');
  const nearbyRoot = createRoot(nearbyItems);
  const nearbyButton = element<HTMLButtonElement>('nearby-objects');
  let selection: {id:number; source:'inventory'|'filed'} | undefined;
  let nearbyKey = '';
  let inventoryKey = '';
  let inventoryItems:WorldItem[] = [];
  let hotbar:readonly (number|undefined)[] = emptyHotbar();
  const purchases = new Set<number>();
  let assigningSlot:number|undefined;
  let pendingPickup:InteractionArea | undefined;
  let collectedArea:InteractionArea | undefined;
  let app:PhoneApp|undefined;
  let decorationId:number | undefined;
  let equipmentOpen = false;
  let stashOpen = false;
  let bagOpen = false;
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

  function objectCard(item:WorldItem, actions:readonly ObjectAction[] = [], chooseQuantity=false) {
    const definition = objects[item.kind];
    const doc = item.document;
    const cash = cashAmount(item);
    const food = isFood(item.kind) ? foodDefinition(item.kind) : undefined;
    const isBag = bagOpen && chooseQuantity;
    const controls = isBag ? [...actions].sort((first,second)=>{
      const rank = (action:ObjectAction) => action.label==='Equipar' ? 0 : action.label==='Largar no chão' ? 1 : 2;
      return rank(first)-rank(second);
    }) : actions;
    return <article className="object-card" key={item.id}>
      <div className={isBag ? "bag-item-info" : "object-card-content"}>
        <h3><img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+definition.portrait} alt="" draggable={false}/>{itemName(item)}{doc?.project!==undefined && <small> #{item.id}</small>}</h3>
        {bagOpen && chooseQuantity && <>
          <span className="bag-item-type">{isGear(item.kind) ? 'Equipamento' : consumableAction(item) ? 'Consumível' : doc ? 'Documento' : 'Objeto'}</span>
          <p className="bag-description">{doc?.description ?? definition.description}</p>
        </>}
        <details><summary>{bagOpen && chooseQuantity ? 'Mais detalhes' : 'Inspecionar'}</summary>
          {!(bagOpen && chooseQuantity) && <p>{doc?.description ?? definition.description}</p>}
          {doc && <>
            <p>Assinaturas {doc.signatures.length}/{doc.requiredSignatures} · {doc.signatures.map(person=>person.name).join(', ') || 'nenhuma'}</p>
            {doc.project===undefined && <p>Carimbos {doc.stamps.length}/{doc.requiredStamps.length} · {doc.requiredStamps.map(stamp=>doc.stamps.includes(stamp) ? '✓ '+stamp : stamp).join(', ')}</p>}
            {doc.requiredOffice && <p>Assinatura exigida: Parlamentar</p>}
          </>}
          {food && <p>{itemQuantity(item)} un. · {food.category} · {describeFood(food.effect)}</p>}
          {!!cash && <p>{money(cash)}</p>}
        </details>
        {chooseQuantity && !!previous?.gameplay?.contacts.length && <label className={isBag ? 'bag-recipient' : 'object-recipient'}>Jogador
          <select value={recipient} onChange={event=>{recipient = event.currentTarget.value; render();}}>
            <option value="">Escolha…</option>
            {previous.gameplay.contacts.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>}
        {chooseQuantity && itemQuantity(item)>1 && <div role="group" aria-label="Quantidade para oferecer ou largar">
          <button type="button" className="hud-button hud-button--secondary" aria-label="Diminuir quantidade" aria-keyshortcuts="ArrowLeft"
            disabled={selectedItemQuantity(item,quantity)===1} onClick={()=>changeQuantity(item,-1)}>− <kbd>←</kbd></button>
          <output aria-label="Quantidade selecionada"> {selectedItemQuantity(item,quantity)} / {itemQuantity(item)} </output>
          <button type="button" className="hud-button hud-button--secondary" aria-label="Aumentar quantidade" aria-keyshortcuts="ArrowRight"
            disabled={selectedItemQuantity(item,quantity)===itemQuantity(item)} onClick={()=>changeQuantity(item,1)}>+ <kbd>→</kbd></button>
        </div>}
      </div>
      <div className={isBag ? "bag-item-actions" : "object-card-content"}>
        {chooseQuantity && bagOpen && <button type="button" className="bag-pin hud-button"
          disabled={!canPinToHotbar(item)} onClick={()=>document.querySelector<HTMLButtonElement>('.bag-preview button:not(:disabled)')?.focus()}>
          <span><BagIcon name="grid"/>Adicionar à hotbar</span><kbd>⇧1–6</kbd>
        </button>}
        {chooseQuantity && !bagOpen && <div className="bag-hotbar" role="group" aria-label="Adicionar à hotbar">
          <span><BagIcon name="grid"/>Adicionar à hotbar</span>
          {hotbar.map((id,index)=><button key={index} type="button" className="hud-button hud-button--secondary"
            disabled={!canPinToHotbar(item)} aria-label={`Vincular ao slot ${index+1}`} aria-pressed={id===item.id}
            onClick={()=>{hotbar = assignHotbarSlot(hotbar,index,item.id);highlightSlot();renderKey = '';render();}}>{index+1}</button>)}
          {hotbar.includes(item.id) && <button type="button" className="hud-button hud-button--secondary"
            onClick={()=>{hotbar = hotbar.map(id=>id===item.id ? undefined : id);highlightSlot();renderKey = '';render();}}>Remover atalho</button>}
        </div>}
        {controls.map(({label,run,key,disabled})=><button type="button" key={label} className="hud-button hud-button--secondary"
          aria-keyshortcuts={key} disabled={disabled} onClick={run}><span>{isBag && (label==='Equipar' || label==='Largar no chão') && <BagIcon name={label==='Equipar' ? 'gear' : 'drop'}/>} {label}</span>{key && <kbd className="action-key" aria-hidden="true">{key}</kbd>}</button>)}
      </div>
    </article>;
  }
  function changeQuantity(item:WorldItem,delta:number) {
    quantity = selectedItemQuantity(item,selectedItemQuantity(item,quantity)+delta);
    render();
  }

  type ObjectAction = {label:string;run:()=>void;key?:string;disabled?:boolean};

  function renderHeader() {
    const mode = dialog.dataset.mode;
    const title = mode==='phone' ? app ?? 'Celular' : mode==='bag' ? 'Inventário' :
      stashOpen ? 'Armário particular' : mode==='equipment' ? 'Equipamentos' : 'Objeto';
    flushSync(()=>headerRoot.render(<GameplayDialogHeader title={title} bag={mode==='bag'}
      back={mode==='phone' && app ? ()=>selectApp() : undefined}/>));
  }

  function open(item?:typeof selection, decoration?:number, equipment=false, stash=false, bag=false) {
    selection = item;
    quantity = 1;
    decorationId = decoration;
    equipmentOpen = equipment;
    stashOpen = stash;
    bagOpen = bag;
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
    if (!phone && !contacts.some(person=>person.id===recipient)) recipient = '';
    navigation.hidden = !phone || !!app;
    if (phone && !navigationMounted) {
      navigationMounted = true;
      navigationRoot.render(<PhoneApps select={selectApp}/>);
    }
    const phase = view.phase;
    const canRemoveDecoration = !!decoration && state.interactive.some(item=>item.id===decoration.id) && hasInventorySpace(state.inventory.length);
    const visible = stash ? [stash,state.inventory] : equipmentOpen ? [state.equipped,state.modulator,state.megaphoneSeconds,state.equipmentCooldowns] : selection ? [item,state.locations,contacts,state.installable,state.officeStash?.id,state.officeDecor,state.surveillance?.options] : decoration ? [decoration,canRemoveDecoration] :
      app==='Álbum' ? photos.albumKey(contacts,state.locations.includes('press')) :
      app==='Câmera' ? photos.count :
      app==='Projetos' ? [view.project,view.outcomes] :
      app==='Pix' ? [view.politics?.contacts,view.politics?.wallet,view.politics?.paymentsLeft,view.politics?.directory] :
      app==='Telefone' ? [state.call,directory.map(({id,name,character})=>({id,name,character}))] :
      [state.game?.status,state.game?.score,state.candy,state.bets,view.politics?.wallet];
    if (phone && app==='Joguinhos' && state.game && snakeBoard) paintSnake(snakeBoard,state.game);
    const nextKey = JSON.stringify([selection,recipient,quantity,decorationId,equipmentOpen,stashOpen,bagOpen,bagFilter,assigningSlot,app,phase,visible,bagOpen ? state.inventory : undefined]);
    if (nextKey===renderKey) return;
    renderKey = nextKey;
    const previouslyFocused = document.activeElement;
    const focused = body.contains(previouslyFocused);
    let content:ReactNode;
    if (stash) {
      content = <OfficeStash stash={stash} inventory={state.inventory} send={send}/>;
    }
    function renderBag(detail?:ReturnType<typeof objectCard>) {
      const inventory = state!.inventory;
      const filtered = inventory.filter(entry=>bagFilter==='Todos' ||
        (bagFilter==='Equipamentos' ? isGear(entry.kind) : !!consumableAction(entry)));
      return <div className="bag-layout">
        <div className="bag-filters flex gap-2" role="group" aria-label="Categoria de itens">
          {bagFilters.map(filter=><button key={filter} type="button" aria-pressed={bagFilter===filter}
            onClick={()=>{bagFilter = filter;selection = undefined;render();}}><BagIcon name={filter==='Todos' ? 'bag' : filter==='Equipamentos' ? 'gear' : 'food'}/>{filter}</button>)}
        </div>
        <div className="bag-storage">
          <div className="congress-bag">
            {Array.from({length:INVENTORY_SLOTS},(_,index)=>{
              const entry = filtered[index];
              return entry ? <button key={entry.id} type="button" className="item-tile" title={itemName(entry)}
                aria-label={itemName(entry)} aria-pressed={selection?.id===entry.id}
                disabled={assigningSlot!==undefined && !canPinToHotbar(entry)}
                onClick={()=>{
                  if (assigningSlot!==undefined) {
                    hotbar = assignHotbarSlot(hotbar,assigningSlot,entry.id);
                    dialog.close();
                  } else {
                    selection = {id:entry.id,source:'inventory'};
                    quantity = 1;
                    render();
                  }
                }}>
                <img className="item-portrait" alt="" src={import.meta.env.BASE_URL+'assets/'+objects[entry.kind].portrait}/>
                {itemQuantity(entry)>1 && <span className="slot-count">×{itemQuantity(entry)}</span>}
              </button> : <span className="item-tile item-tile-empty" aria-hidden="true" key={`empty-${index}`}>+</span>;
            })}
          </div>
          <p className="bag-capacity"><BagIcon name="bag"/>{inventory.length} / {INVENTORY_SLOTS} slots</p>
        </div>
        <div className="bag-detail">{detail ?? <p>{assigningSlot===undefined ? 'Selecione um item.' : `Escolha um item para o slot ${assigningSlot+1}.`}</p>}</div>
        <footer className="bag-preview">
          <strong>Hotbar <span>(atalhos rápidos)</span></strong>
          <div className="bag-preview-slots">
            {hotbar.map((id,index)=>{
              const pinned = inventory.find(entry=>entry.id===id);
              return <button type="button" key={index} className="item-tile"
                disabled={!item || !canPinToHotbar(item)} aria-pressed={!!item && item.id===id}
                aria-label={`Vincular ao slot ${index+1}`} aria-keyshortcuts={item && canPinToHotbar(item) ? `Shift+${index+1}` : undefined}
                onClick={()=>{
                  if (!item) return;
                  hotbar = id===item.id ? hotbar.map((entry,slot)=>slot===index ? undefined : entry) : assignHotbarSlot(hotbar,index,item.id);
                  highlightSlot();
                  renderKey = '';
                  render();
                }}>
                <kbd className="slot-key">{index+1}</kbd>
                {pinned ? <img alt={itemName(pinned)} src={import.meta.env.BASE_URL+'assets/'+objects[pinned.kind].portrait}/> : <span aria-hidden="true">+</span>}
              </button>;
            })}
          </div>
        </footer>
      </div>;
    }
    if (bagOpen && !item) {
      content = renderBag();
    }
    if (equipmentOpen) {
      const equipped = state.equipped ?? [];
      content = equipped.length ? <ul className="equipment-list">
        {equipped.map(gear=><li key={gear.id}>
          <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+objects[gear.kind].portrait} alt="" draggable={false}/>
          <strong>{itemName(gear)}</strong>
          {phase==='negotiation' && !state.vitality?.recovery && <>
            <button type="button" className="hud-button hud-button--secondary" onClick={()=>send({kind:'unequip',item:gear.id})}>Desequipar</button>
            {gear.kind==='megaphone' &&
              <button type="button" className="hud-button hud-button--secondary" disabled={!!state.equipmentCooldowns?.[gear.id]}
                onClick={()=>send({kind:'toggle-megaphone'})}>{state.megaphoneSeconds ? `Encerrar · ${state.megaphoneSeconds}s` :
                  state.equipmentCooldowns?.[gear.id] ? `Recarga · ${state.equipmentCooldowns[gear.id]}s` : 'Ativar megafone'}</button>}
            {gear.kind==='voiceModulator' && state.modulator &&
              <button type="button" className="hud-button hud-button--secondary"
                onClick={()=>send({kind:'toggle-modulator'})}>{state.modulator.active ? 'Desligar modulador' : 'Ligar modulador'}</button>}
          </>}
        </li>)}
      </ul> : <p className="equipment-empty"><svg className="hud-glyph" aria-hidden="true"><use href="#icon-inventory"/></svg>Nenhum item equipado.</p>;
    }

    if (item) {
      const actions:ObjectAction[] = [];
      const act = (label:string,kind:GameplayAction['kind'],place?:string,key?:string) => {
        const transferQuantity = (kind==='offer' || kind==='drop') && itemQuantity(item)>1
          ? {quantity:selectedItemQuantity(item,quantity)} : {};
        actions.push({label,key,run:()=>send({kind,item:item.id,target:recipient,place,...transferQuantity})});
      };
      if (selection?.source==='inventory') {
        const definition = objects[item.kind];
        if (cashAmount(item) && state.locations.includes('treasury')) act('Entregar ao tesoureiro','deliver','treasury');
        const spyOptions = state.surveillance?.options.filter(option=>option.item===item.id) ?? [];
        spyOptions.forEach((option,index)=>{
          actions.push({label:option.label,key:String(index+1),run:()=>{ sendSpy(option); dialog.close(); }});
        });
        if (state.officeStash) act('Guardar no armário particular','office-stash',state.officeStash.id);
        const decorSlot = state.officeDecor?.find(slot=>slot.kind===item.kind);
        if (decorSlot) act('Instalar no gabinete','office-install',decorSlot.id);
        if (isGear(item.kind) && phase==='negotiation') act('Equipar','equip',undefined,bagOpen ? '7' : undefined);
        else if (bagOpen) actions.push({label:'Equipar',disabled:true,run:()=>{}});
        const consumable = consumableAction(item);
        if (consumable) actions.push({label:consumable.label,key:consumable.key,run:()=>send(consumable.action)});
        if (phase==='negotiation') for (const [key,site] of Object.entries(installationSites)) {
          if (item.kind!==site.kind) continue;
          const label = item.kind==='pizza' ? 'Servir na mesa' : item.kind==='vip' ? 'Reservar cadeira' : 'Instalar ou substituir';
          if (state.installable.includes(key)) act(`${label} · ${site.label}`,'install',key);
        }
        if (contacts.length) {
          act('Oferecer','offer');
          if (item.document && (item.document.project===undefined || item.document.requiredSignatures>0)) act('Pedir assinatura','sign-request');
        }
        act('Largar no chão','drop',undefined,bagOpen ? '8' : undefined);
        if ('destructible' in definition) act('Destruir','destroy');
        for (const place of state.locations) {
          const terminal = terminals[place as keyof typeof terminals];
          if ('storage' in terminal) act(`Guardar · ${terminal.title}`,'store',place);
          if (item.document && item.document.project===undefined && 'stamp' in terminal) act(`Carimbar · ${terminal.stamp}`,'stamp',place);
          if (item.document && canVerifyDocumentAt(place)) act('Verificar documento','verify-document',place);
        }
      }
      const detail = objectCard(item,actions,selection?.source==='inventory');
      content = bagOpen ? renderBag(detail) : detail;
    }
    if (decoration) {
      content = <DecorationCard decoration={decoration} ownId={ownId}
        exploring={phase==='negotiation'} canRemove={canRemoveDecoration} send={send}/>;
    }
    const showMail = phone && app==='Correio';
    if (phone && app && !showMail) {
      let application:ReactNode;
      if (app==='Telefone') application = <PhoneCalls call={state.call} contacts={directory.filter(person=>person.id!==ownId)}
        available={phase==='negotiation'} send={send}/>;
      if (app==='Joguinhos') application = <PhoneSnake game={state.game} bets={state.bets} candy={state.candy} wallet={view.politics?.wallet ?? 0} available={phase==='negotiation'} board={setSnakeBoard} send={send}/>;
      if (app==='Câmera') application = <PhoneCamera character={directory.find(person=>person.id===ownId)?.character} count={photos.count}
        available={phase==='negotiation'} preview={photos.setPreview} send={send} openAlbum={openPersonalAlbum}/>;
      if (app==='Pix' && view.politics) application = <PhonePix ownId={ownId} politics={view.politics} send={sendPolitics}/>;
      if (app==='Projetos') application = <ProjectCatalog project={view.project} outcomes={view.outcomes}/>;
      if (app==='Álbum') application = photos.renderAlbum(contacts,directory,state.locations.includes('press') && phase==='negotiation');
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

  function highlightSlot() {
    slotsRoot.render(Array.from({length:INVENTORY_SLOTS},(_,index)=>{
      const item = inventoryItems.find(entry=>entry.id===hotbar[index]);
      const shortcut = index+1;
      const badge = <kbd className="slot-key" aria-hidden="true">⇧ + {shortcut}</kbd>;
      if (!item) return <button type="button" className="item-tile item-tile-empty" key={index}
        aria-label={`Escolher item para o slot ${shortcut}`} title={`Vincular item (Shift+${shortcut})`}
        onClick={()=>{assigningSlot = index;open(undefined,undefined,false,false,true);}}>
        {badge}<span className="slot-plus" aria-hidden="true">+</span>
      </button>;
      const name = itemName(item);
      const use = consumableAction(item);
      const label = use ? `${use.label} · ${name}` : `Abrir ${name}`;
      return <button type="button" key={index} className="item-tile" data-kind={item.kind} data-item={item.id}
        aria-label={label} title={`${label} (Shift+${shortcut})`} aria-haspopup={use ? undefined : "dialog"}
        aria-expanded={selection?.source==='inventory' && selection.id===item.id} aria-keyshortcuts={`Shift+${shortcut}`}
        onClick={()=>use ? send(use.action) : open({id:item.id,source:'inventory'})}>
        <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+objects[item.kind].portrait} alt="" draggable={false}/>
        {itemQuantity(item)>1 && <span className="slot-count">{itemQuantity(item)}</span>}{badge}
      </button>;
    }));
  }

  const onSlotKey = (event:KeyboardEvent) => {
    if (dialog.open && selection?.source==='inventory' && !event.defaultPrevented && !event.ctrlKey && !event.altKey &&
        !event.metaKey && !hudConsumesKeys(event.target) && (event.key==='ArrowLeft' || event.key==='ArrowRight')) {
      const control = body.querySelector<HTMLButtonElement>(`button[aria-keyshortcuts="${event.key}"]`);
      if (control) {
        event.preventDefault();
        control.click();
        return;
      }
    }
    if (dialog.open && stashOpen && !event.repeat && !event.defaultPrevented && !event.ctrlKey && !event.altKey &&
        !event.metaKey && !hudConsumesKeys(event.target) && /^Digit[1-6]$/.test(event.code)) {
      const key = (event.shiftKey ? 'Shift+' : '')+event.code.at(-1);
      body.querySelector<HTMLButtonElement>(`button[aria-keyshortcuts="${key}"]:enabled`)?.click();
      event.preventDefault();
      return;
    }
    if (dialog.open && bagOpen && event.shiftKey && /^Digit[1-6]$/.test(event.code) &&
        !event.repeat && !event.defaultPrevented && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const buttons = body.querySelectorAll<HTMLButtonElement>('.bag-preview-slots button');
      event.preventDefault();
      buttons[Number(event.code.at(-1))-1]?.click();
      return;
    }
    if (dialog.open || slots.hidden || !event.shiftKey || event.repeat || event.defaultPrevented || event.ctrlKey || event.altKey ||
      event.metaKey || hudConsumesKeys(event.target) || !/^Digit[1-6]$/.test(event.code)) return;
    const slot = slots.children[Number(event.code.at(-1))-1];
    if (!(slot instanceof HTMLButtonElement)) return;
    event.preventDefault();
    slot.click();
  };
  document.addEventListener('keydown',onSlotKey);
  const onSnakeKey = (event:KeyboardEvent) => {
    if (!dialog.open || dialog.dataset.mode!=='phone' || app!=='Joguinhos' || event.repeat ||
      event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    const status = previous?.gameplay?.game?.status;
    const direction = snakeDirection(event);
    if (!direction || (status!=='ready' && status!=='playing')) return;
    event.preventDefault();
    send({kind:'game-turn',direction});
  };
  document.addEventListener('keydown',onSnakeKey);

  function setNearbyExpanded(expanded:boolean) {
    nearbyItems.hidden = !expanded;
    nearbyButton.setAttribute('aria-expanded',String(expanded));
    if (expanded) nearbyItems.scrollTop = 0;
  }

  function pickUp(area:InteractionArea, action:()=>void) {
    if (pendingPickup) return;
    pendingPickup = area;
    action();
  }

  nearbyButton.onclick = () => setNearbyExpanded(nearbyItems.hidden);
  const closed = () => {
    if (dialog.open) return;
    syncPhoneOpen();
    bodyRoot.render(null);
    mailHost.hidden = true;
    renderKey = '';
    selection = undefined;
    assigningSlot = undefined;
    highlightSlot();
    if (previous?.gameplay?.game) send({kind:'game-stop'});
    photos.closePresentation();
  };
  dialog.addEventListener('close',closed);

  return {
    openPhone() { app = undefined; open(); },
    restorePhoneActivity() { if (phoneOpen) send({kind:'phone-open'}); },
    openBag() { open(undefined,undefined,false,false,true); },
    openEquipment() { open(undefined,undefined,true); },
    itemObtained(pickup:boolean) {
      if (!pickup || !pendingPickup) return;
      collectedArea = pendingPickup;
      pendingPickup = undefined;
      nearbyKey = '';
      nearbyButton.hidden = true;
      setNearbyExpanded(false);
    },
    nearby(player:Motion | undefined, exploring:boolean) {
      if (collectedArea) {
        if (exploring && (!player || collectedArea(player))) return;
        collectedArea = undefined;
      }
      const state = exploring ? previous?.gameplay : undefined;
      const key = JSON.stringify(state ? [state.nearby,state.stored,state.filed,state.locations,state.interactive,photos.count] : null);
      if (key===nearbyKey) return;
      nearbyKey = key;
      const tiles:NearbyItem[] = [];
      const add = (key:string,kind:ObjectKind,name:string,verb:string,activate:()=>void) =>
        tiles.push({key,kind,name,verb,activate});
      if (state) {
        for (const item of state.nearby) {
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
      flushSync(()=>nearbyRoot.render(<NearbyItems items={tiles}/>));
      nearbyButton.hidden = !tiles.length;
      if (!tiles.length) setNearbyExpanded(false);
    },
    render(view:PlenaryView) {
      const call = view.gameplay?.call;
      const incoming = view.gameplay?.requests.at(0);
      const information = view.gameplay && photos.request;
      const old = previous?.gameplay;
      previous = view;
      if (view.phase!=='negotiation') { pendingPickup = undefined; setNearbyExpanded(false); }
      if (document.querySelector('dialog:modal')) setNearbyExpanded(false);
      if (!view.gameplay && dialog.open) dialog.close();
      slots.hidden = !view.gameplay;
      if (view.gameplay) renderSlots(view.gameplay.inventory);
      if (call?.state==='connected' && old?.call?.state!=='connected' && dialog.dataset.mode==='phone' && app==='Telefone') dialog.close();
      if (call?.state==='incoming' && old?.call?.state!=='incoming' && !document.querySelector('dialog:modal')) {
        app = 'Telefone';
        open();
      }
      const requestKey = information ? `info-${information.id}` : String(incoming?.id ?? '');
      if (requestKey!==requestBox.dataset.request) {
        requestBox.dataset.request = requestKey;
        requestBox.hidden = !incoming && !information;
        if (information) {
          requestRoot.render(<article className="object-card">
            <p>{information.from.name} quer {information.mode==='copy' ? 'enviar uma cópia de' : 'mostrar'} uma fotografia.</p>
            <button className="hud-button hud-button--secondary" onClick={()=>send({kind:'info-accept',item:information.id})}>Aceitar</button>
            <button className="hud-button hud-button--secondary" onClick={()=>send({kind:'info-decline',item:information.id})}>Recusar</button>
          </article>);
        } else if (incoming) {
          requestRoot.render(<><p>{incoming.from.name} {incoming.kind==='signature' ? 'pede uma assinatura' : 'oferece um objeto'}</p>
            {objectCard(incoming.item,[
              {label:incoming.kind==='signature' ? 'Assinar' : 'Aceitar',run:()=>send({kind:'accept',item:incoming.id})},
              {label:'Recusar',run:()=>send({kind:'decline',item:incoming.id})},
            ])}</>);
        } else requestRoot.render(null);
      }
      render();
    },
    purchasedConsumable(id:number) { purchases.add(id); },
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
    feedback(text:string) {
      pendingPickup = undefined;
      notify(text);
    },
    destroy() {
      photos.destroy();
      document.removeEventListener('keydown',onSlotKey);
      document.removeEventListener('keydown',onSnakeKey);
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
      slots.hidden = nearbyButton.hidden = true;
      slotsRoot.unmount();
      requestRoot.unmount();
      nearbyRoot.unmount();
      setNearbyExpanded(false);
    },
  };
}
