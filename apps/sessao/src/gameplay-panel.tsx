import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { OfficeStash } from './ui/office-stash';
import { markShortcut } from './action-shortcuts';
import { describeFood, foods, isFood } from './food';
import { isGear } from './equipment';
import { createPhoneSnake, snakeDirection } from './phone-snake';
import { hudConsumesKeys } from './game-keys';
import { installationSites, shop } from './installations';
import { decorationLabel, itemSymbols } from './photo-renderer';
import type { PhotoAccessView, PhotoScene } from './photography';
import { money } from './politics';
import { button, contactFace, glyph, itemPortrait, node } from './gameplay-ui';
import { createPhonePhotos } from './phone-photos';
import { canReachObject, canVerifyDocumentAt, cashAmount, itemQuantity, selectedItemQuantity, consumableAction, documentTemplates, INVENTORY_SLOTS, objects, terminals, type GameplayAction, type ObjectKind, type WorldItem } from './gameplay';
import type { Motion } from './map';
import type { PlenaryView } from './plenary';
import type { DirectoryContact } from './politics';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const apps = {
  'Telefone':'app-call',
  'Joguinhos':'app-games',
  'Câmera':'app-camera',
  'Álbum':'app-photos',
} as const;
type App = keyof typeof apps;
type InteractionArea = (player:Motion) => boolean;

function itemArt(kind:ObjectKind) {
  if (!isGear(kind) && itemSymbols[kind]) {
    const symbol = node('span',itemSymbols[kind]);
    symbol.className = 'item-art-symbol';
    symbol.setAttribute('aria-hidden','true');
    return symbol;
  }
  return itemPortrait(kind);
}

function itemName(item:Pick<WorldItem,'kind'|'document'|'quantity'>) {
  const name = item.document?.title ?? objects[item.kind].name;
  return itemQuantity(item)>1 ? `${name} ×${itemQuantity(item)}` : name;
}

import type { SpyOption } from "./surveillance";

export function createGameplayPanel(send:(action:GameplayAction)=>void, ownId:string, notify:(text:string)=>void, drawPhoto:(canvas:HTMLCanvasElement,photo?:PhotoScene)=>void, sendSpy:(option:SpyOption)=>void) {
  const dialog = element<HTMLDialogElement>('gameplay-dialog');
  const body = element('gameplay-body');
  const navigation = element('phone-apps');
  const target = element<HTMLSelectElement>('gameplay-target');

  const tools = element('gameplay-tools');
  const equipmentButton = element<HTMLButtonElement>('open-equipment');
  const phoneButton = element<HTMLButtonElement>('open-phone');
  const slots = element('item-slots');
  const slotsRoot = createRoot(slots);
  const equipmentHost = document.createElement('div');
  const equipmentRoot = createRoot(equipmentHost);
  const objectsHost = document.createElement('div');
  const objectsRoot = createRoot(objectsHost);
  const requestBox = element('object-request');
  const requestRoot = createRoot(requestBox);
  const nearbyItems = element('nearby-items');
  const nearbyButton = element<HTMLButtonElement>('nearby-objects');
  let selection: {id:number; source:'inventory'|'filed'} | undefined;
  let nearbyKey = '';
  let inventoryKey = '';
  let inventoryItems:WorldItem[] = [];
  let pendingPickup:InteractionArea | undefined;
  let collectedArea:InteractionArea | undefined;
  let app:App = 'Telefone';
  let decorationId:number | undefined;
  let equipmentOpen = false;
  let stashOpen = false;
  let bagOpen = false;
  const snake = createPhoneSnake(direction=>send({kind:'game-turn',direction}));
  const photos = createPhonePhotos(send,drawPhoto,render);
  let previous:PlenaryView | undefined;
  let renderKey = '';
  let targetKey = '';
  let quantity = 1;

  function objectCard(item:WorldItem, actions:readonly ObjectAction[] = [], chooseQuantity=false) {
    const definition = objects[item.kind];
    const doc = item.document;
    const cash = cashAmount(item);
    const food = isFood(item.kind) ? foods[item.kind] : undefined;
    return <article className="object-card" key={item.id}>
      <h3><img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+definition.portrait} alt="" draggable={false}/>{itemName(item)}{doc?.project!==undefined && <small> #{item.id}</small>}</h3>
      <details><summary>Inspecionar</summary><p>{doc?.description ?? definition.description}</p>
        {doc && <>
          <p>Assinaturas {doc.signatures.length}/{doc.requiredSignatures} · {doc.signatures.map(person=>person.name).join(', ') || 'nenhuma'}</p>
          <p>Carimbos {doc.stamps.length}/{doc.requiredStamps.length} · {doc.requiredStamps.map(stamp=>doc.stamps.includes(stamp) ? '✓ '+stamp : stamp).join(', ')}</p>
          {doc.requiredOffice && <p>Assinatura exigida: Parlamentar</p>}
        </>}
        {food && <p>{itemQuantity(item)} un. · {food.category} · {describeFood(food.effect)}</p>}
        {!!cash && <p>{money(cash)}</p>}
      </details>
      {chooseQuantity && itemQuantity(item)>1 && <div role="group" aria-label="Quantidade para oferecer ou largar">
        <button type="button" className="hud-button hud-button--secondary" aria-label="Diminuir quantidade" aria-keyshortcuts="ArrowLeft"
          disabled={selectedItemQuantity(item,quantity)===1} onClick={()=>changeQuantity(item,-1)}>− <kbd>←</kbd></button>
        <output aria-label="Quantidade selecionada"> {selectedItemQuantity(item,quantity)} / {itemQuantity(item)} </output>
        <button type="button" className="hud-button hud-button--secondary" aria-label="Aumentar quantidade" aria-keyshortcuts="ArrowRight"
          disabled={selectedItemQuantity(item,quantity)===itemQuantity(item)} onClick={()=>changeQuantity(item,1)}>+ <kbd>→</kbd></button>
      </div>}
      {actions.map(({label,run,key})=><button type="button" key={label} className="hud-button hud-button--secondary"
        aria-keyshortcuts={key} onClick={run}>{label}{key && <kbd className="action-key" aria-hidden="true">{key}</kbd>}</button>)}
    </article>;
  }
  function changeQuantity(item:WorldItem,delta:number) {
    quantity = selectedItemQuantity(item,selectedItemQuantity(item,quantity)+delta);
    render();
  }

  type ObjectAction = {label:string;run:()=>void;key?:string};

  function open(item?:typeof selection, decoration?:number, equipment=false, stash=false, bag=false) {
    selection = item;
    quantity = 1;
    decorationId = decoration;
    equipmentOpen = equipment;
    stashOpen = stash;
    bagOpen = bag;
    const object = !!item || decoration!==undefined;
    highlightSlot();
    photos.clearRecipient();
    renderKey = '';
    element('gameplay-title').textContent = bag ? 'Mochila' : stash ? 'Armário particular' : equipment ? 'Equipamentos' : object ? 'Objeto' : 'Celular';
    navigation.hidden = object || equipment || stash || bag;
    dialog.dataset.mode = equipment || stash || bag ? 'equipment' : object ? 'item' : 'phone';
    if (!dialog.open) dialog.showModal();
    render();
  }

  function openPersonalAlbum() {
    app = 'Álbum';
    photos.resetSelection();
    open();
  }

  const appButtons = (Object.keys(apps) as App[]).map(title => {
    const tile = button(title,() => {
      if (app==='Joguinhos' && title!=='Joguinhos') send({kind:'game-stop'});
      photos.closePresentation();
      app = title;
      photos.resetSelection();
      render();
    });
    tile.className = 'phone-app';
    tile.dataset.app = apps[title];
    const art = node('span');
    art.className = 'phone-app-icon';
    art.append(glyph(apps[title]));
    tile.prepend(art);
    navigation.append(tile);
    return {tile,title};
  });

  function phoneContacts(contacts:DirectoryContact[]) {
    if (!contacts.length) return node('p','Ninguém mais na sala.');
    const grid = node('div');
    grid.className = 'phone-contacts';
    for (const person of contacts) {
      const tile = button('',()=>send({kind:'call',target:person.id}));
      tile.className = 'phone-contact';
      tile.setAttribute('aria-label',`Ligar para ${person.name}`);
      const dial = glyph('handset');
      dial.classList.add('phone-contact-dial');
      tile.append(contactFace(person),node('strong',person.name),dial);
      grid.append(tile);
    }
    return grid;
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
    if ((selection && !item) || (decorationId!==undefined && !decoration)) {
      dialog.close();
      return;
    }
    const directory = view.politics?.directory ?? [];
    const contacts = state.contacts;
    const key = JSON.stringify(contacts);
    if (!phone && key!==targetKey) {
      targetKey = key;
      const selected = target.value;
      target.replaceChildren(new Option('Escolha…',''),...contacts.map(person=>new Option(person.name,person.id)));
      if (contacts.some(person=>person.id===selected)) target.value = selected;
    }
    element('gameplay-target-label').hidden = selection?.source!=='inventory' || !contacts.length;
    for (const {tile,title} of appButtons) tile.setAttribute('aria-pressed',String(app===title));
    const phase = view.phase;
    const visible = bagOpen ? state.inventory : stash ? [stash,state.inventory] : equipmentOpen ? [state.equipped,state.modulator,state.megaphoneSeconds,state.equipmentCooldowns] : selection ? [item,state.locations,contacts.length,state.exposed,state.installable,state.officeStash?.id,state.officeDecor,state.surveillance?.options] : decoration ? decoration :
      app==='Álbum' ? photos.albumKey(contacts,state.locations.includes('press')) :
      app==='Câmera' ? photos.count :
      app==='Telefone' ? [state.call,directory.map(({id,name,character})=>({id,name,character}))] :
      state.game?.status;
    if (phone && app==='Joguinhos' && state.game) snake.paint(state.game);
    const nextKey = JSON.stringify([selection,quantity,decorationId,equipmentOpen,stashOpen,bagOpen,app,phase,visible]);
    if (nextKey===renderKey) return;
    renderKey = nextKey;
    const focused = body.contains(document.activeElement);
    photos.stopPreview();
    const cards:HTMLElement[] = [];
    if (stash) {
      flushSync(()=>objectsRoot.render(<OfficeStash stash={stash} inventory={state.inventory} send={send}/>));
      cards.push(objectsHost);
    }
    if (bagOpen) {
      flushSync(()=>objectsRoot.render(<div className="congress-bag">
        {Array.from({length:INVENTORY_SLOTS},(_,index)=>{
          const item = state.inventory[index];
          return item ? <button key={item.id} type="button" className="item-tile" title={itemName(item)}
            onClick={()=>open({id:item.id,source:'inventory'})}>
            <img className="item-portrait" alt="" src={import.meta.env.BASE_URL+'assets/'+objects[item.kind].portrait}/>
            <span>{itemName(item)}</span>
          </button> : <span className="item-tile item-tile-empty" aria-hidden="true" key={index}>+</span>;
        })}
      </div>));
      cards.push(objectsHost);
    }
    if (equipmentOpen) {
      const equipped = state.equipped ?? [];
      flushSync(()=>equipmentRoot.render(equipped.length ? <ul className="equipment-list">
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
              <button type="button" className="hud-button hud-button--secondary" disabled={state.modulator.recharge>0}
                onClick={()=>send({kind:'toggle-modulator'})}>{state.modulator.active ? `Desligar · ${state.modulator.battery}s` :
                  state.modulator.recharge ? `Recarga · ${state.modulator.recharge}s` : 'Ligar modulador'}</button>}
          </>}
        </li>)}
      </ul> : <p className="equipment-empty"><svg className="hud-glyph" aria-hidden="true"><use href="#icon-inventory"/></svg>Nenhum item equipado.</p>));
      cards.push(equipmentHost);
    }

    if (item) {
      const actions:ObjectAction[] = [];
      const act = (label:string,kind:GameplayAction['kind'],place?:string,key?:string) => {
        const transferQuantity = (kind==='offer' || kind==='drop') && itemQuantity(item)>1
          ? {quantity:selectedItemQuantity(item,quantity)} : {};
        actions.push({label,key,run:()=>send({kind,item:item.id,target:target.value,place,...transferQuantity})});
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
        if (isGear(item.kind) && phase==='negotiation') act('Equipar','equip');
        const consumable = consumableAction(item);
        if (consumable) actions.push({label:consumable.label,key:consumable.key,run:()=>send(consumable.action)});
        if ('exposable' in definition) {
          const exposed = state.exposed.includes(item.id);
          act(exposed ? 'Guardar na mochila' : 'Expor acima do personagem',exposed ? 'conceal' : 'expose');
        }
        if (phase==='negotiation') for (const [key,site] of Object.entries(installationSites)) {
          if (item.kind!==site.kind) continue;
          const label = item.kind==='pizza' ? 'Servir na mesa' : 'Instalar ou substituir';
          if (state.installable.includes(key)) act(`${label} · ${site.label}`,'install',key);
        }
        if (contacts.length) {
          act('Oferecer','offer');
          if (item.document) act('Pedir assinatura','sign-request');
        }
        act('Largar','drop');
        if ('destructible' in definition) act('Destruir','destroy');
        for (const place of state.locations) {
          const terminal = terminals[place as keyof typeof terminals];
          if ('storage' in terminal) act(`Guardar · ${terminal.title}`,'store',place);
          if (item.document && 'stamp' in terminal) act(`Carimbar · ${terminal.stamp}`,'stamp',place);
          if (item.document && canVerifyDocumentAt(place)) act('Verificar documento','verify-document',place);
          if (item.document && 'file' in terminal) act('Protocolar','file',place);
        }
      }
      flushSync(()=>objectsRoot.render(objectCard(item,actions,selection?.source==='inventory')));
      cards.push(objectsHost);
    }
    if (decoration) {
      const card = node('article');
      card.className = 'object-card';
      card.append(node('h3',decorationLabel(decoration)));
      if (decoration.kind==='portrait') card.append(contactFace({...decoration.owner,character:decoration.character}));
      if (decoration.marked) card.append(node('p','Retrato rabiscado'));
      if (decoration.kind==='vip') card.append(node('p','Área reservada por '+decoration.owner.name));
      const control = (label:string,kind:GameplayAction['kind'])=>button(label,()=>send({kind,item:decoration.id}));
      if (phase==='negotiation' && !decoration.privateOffice) {
        if (decoration.kind==='pizza') card.append(control('Pegar uma fatia','slice'));
        else {
          if (decoration.kind==='portrait' && !decoration.marked && decoration.owner.id!==ownId) card.append(control('Rabiscar','mark'));
          card.append(control('Retirar','uninstall'));
        }
      }
      cards.push(card);
    }
    if (phone) {
      cards.push(node('h3',app));
      if (app==='Telefone') {
        const call = state.call;
        if (call) {
          const caller = node('div');
          caller.className = 'phone-caller';
          const person = directory.find(person=>person.id===call.peer.id) ?? call.peer;
          const status = call.state==='incoming' ? 'Chamada recebida' : call.state==='outgoing' ? 'Chamando…' : 'Em ligação';
          caller.append(contactFace(person),node('strong',person.name),node('span',status));
          cards.push(caller);
          if (call.state==='incoming') {
            const answer = button('Atender',()=>send({kind:'answer'}));
            answer.classList.add('phone-answer');
            answer.prepend(glyph('handset'));
            cards.push(answer);
          }
          const hangup = button(call.state==='incoming' ? 'Recusar' : 'Encerrar',()=>send({kind:'hangup'}));
          hangup.classList.add('phone-hangup');
          hangup.prepend(glyph('cross'));
          cards.push(hangup);
        } else if (phase==='negotiation') cards.push(phoneContacts(directory.filter(person=>person.id!==ownId)));
        else cards.push(node('p','Ligações ficam disponíveis durante a articulação.'));
      }
      if (app==='Joguinhos') {
        if (phase!=='negotiation') cards.push(node('p','O jogo está disponível durante a articulação.'));
        else if (!state.game) {
          const game = button('Snake',()=>send({kind:'game-start'}));
          game.className = 'snake-launch';
          game.prepend(glyph('snake'));
          cards.push(game);
        } else {
          cards.push(snake.element);
          if (state.game.status==='won' || state.game.status==='lost') {
            cards.push(button('Jogar de novo',()=>send({kind:'game-start'})));
          }
          cards.push(button('Voltar aos joguinhos',()=>send({kind:'game-stop'})));
        }
      }
      if (app==='Câmera') photos.renderCamera(cards,phase,openPersonalAlbum);
      if (app==='Álbum') photos.renderAlbum(cards,contacts,directory,
        state.locations.includes('press') && phase==='negotiation');
    }
    body.replaceChildren(...(cards.length ? cards : [node('p',phone ? 'Nenhuma informação disponível.' : 'Nenhum objeto disponível.')]));
    if (focused) body.querySelector<HTMLButtonElement>('button')?.focus();
  }

  function itemButton(kind:ObjectKind, name:string, verb:string, action:()=>void) {
    const tile = button('',action);
    tile.className = 'item-tile';
    tile.dataset.kind = kind;
    tile.title = `${verb} · ${name}`;
    tile.setAttribute('aria-label',`${verb} ${name}`);
    const caption = node('span',name);
    caption.className = 'item-caption';
    tile.append(itemArt(kind),caption);
    return tile;
  }

  function renderSlots(inventory:WorldItem[]) {
    const key = JSON.stringify(inventory);
    if (key===inventoryKey) return;
    inventoryKey = key;
    inventoryItems = inventory;
    highlightSlot();
  }

  function highlightSlot() {
    slotsRoot.render(Array.from({length:INVENTORY_SLOTS},(_,index)=>{
      const item = inventoryItems[index];
      const shortcut = index+1;
      const badge = <kbd className="slot-key" aria-hidden="true">{shortcut}</kbd>;
      if (!item) return <span className="item-tile item-tile-empty" key={index} aria-hidden="true">{badge}<span className="slot-plus">+</span></span>;
      const name = itemName(item);
      return <button type="button" key={index} className="item-tile" data-kind={item.kind} data-item={item.id}
        aria-label={'Abrir '+name} title={`Abrir · ${name} (Shift+${shortcut})`} aria-haspopup="dialog"
        aria-expanded={selection?.source==='inventory' && selection.id===item.id} aria-keyshortcuts={`Shift+${shortcut}`}
        onClick={()=>open({id:item.id,source:'inventory'})}>
        <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+objects[item.kind].portrait} alt="" draggable={false}/>
        {itemQuantity(item)>1 && <span className="slot-count">{itemQuantity(item)}</span>}{badge}
      </button>;
    }));
  }

  const onSlotKey = (event:KeyboardEvent) => {
    if (dialog.open && selection?.source==='inventory' && !event.defaultPrevented && !event.ctrlKey && !event.altKey &&
        !event.metaKey && !hudConsumesKeys(event.target) && (event.key==='ArrowLeft' || event.key==='ArrowRight')) {
      const control = objectsHost.querySelector<HTMLButtonElement>(`button[aria-keyshortcuts="${event.key}"]`);
      if (control) {
        event.preventDefault();
        control.click();
        return;
      }
    }
    if (dialog.open && stashOpen && !event.repeat && !event.defaultPrevented && !event.ctrlKey && !event.altKey &&
        !event.metaKey && !hudConsumesKeys(event.target) && /^Digit[1-6]$/.test(event.code)) {
      const key = (event.shiftKey ? 'Shift+' : '')+event.code.at(-1);
      objectsHost.querySelector<HTMLButtonElement>(`button[aria-keyshortcuts="${key}"]:enabled`)?.click();
      event.preventDefault();
      return;
    }
    if (slots.hidden || !event.shiftKey || event.repeat || event.defaultPrevented || event.ctrlKey || event.altKey ||
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
  }

  function pickUp(area:InteractionArea, action:()=>void) {
    if (pendingPickup) return;
    pendingPickup = area;
    action();
  }

  nearbyButton.onclick = () => setNearbyExpanded(nearbyItems.hidden);
  phoneButton.onclick = () => open();
  element('open-bag').onclick = () => open(undefined,undefined,false,false,true);
  equipmentButton.onclick = () => open(undefined,undefined,true);
  const closed = () => {
    photos.stopPreview();
    selection = undefined;
    highlightSlot();
    if (previous?.gameplay?.game) send({kind:'game-stop'});
    photos.closePresentation();
  };
  dialog.addEventListener('close',closed);

  return {
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
      const tiles:HTMLButtonElement[] = [];
      if (state) {
        for (const item of state.nearby) {
          tiles.push(itemButton(item.kind,itemName(item),'Pegar',
            ()=>pickUp(player=>canReachObject(player,item),()=>send({kind:'collect',item:item.id}))));
        }
        const storage = state.locations.map(place=>terminals[place as keyof typeof terminals])
          .filter(terminal=>'storage' in terminal);
        for (const item of state.stored) {
          tiles.push(itemButton(item.kind,itemName(item),'Recuperar',()=>pickUp(
            player=>storage.some(terminal=>canReachObject(player,terminal.point)),
            ()=>send({kind:'recover',item:item.id}),
          )));
        }
        if (state.locations.includes('press') && photos.count) {
          tiles.push(itemButton('portrait','Álbum para a Imprensa','Abrir',openPersonalAlbum));
        }
        for (const decoration of state.interactive) {
          tiles.push(itemButton(decoration.kind,decorationLabel(decoration),'Inspecionar',()=>open(undefined,decoration.id)));
        }
        for (const place of state.locations) {
          for (const kind of place==='credentials' ? ['portrait','vip'] as const : []) {
            tiles.push(itemButton(kind,`${objects[kind].name} · ${money(shop[kind])}`,'Comprar',
              ()=>pickUp(player=>canReachObject(player,terminals[place as keyof typeof terminals].point),()=>send({kind:'buy',target:kind}))));
          }
          const terminal = terminals[place as keyof typeof terminals];
          if (!('supply' in terminal)) continue;
          const take = (target?:string) => pickUp(player=>canReachObject(player,terminal.point),
            ()=>send({kind:'supply',place,target}));
          if (terminal.supply==='document') {
            for (const [target,template] of Object.entries(documentTemplates)) {
              tiles.push(itemButton('document',template.title,'Pegar',()=>take(target)));
            }
          } else {
            tiles.push(itemButton(terminal.supply,objects[terminal.supply].name,'Pegar',()=>take()));
          }
        }
        for (const item of state.filed) {
          tiles.push(itemButton(item.kind,itemName(item),'Consultar',()=>open({id:item.id,source:'filed'})));
        }
      }
      nearbyItems.replaceChildren(...tiles);
      nearbyButton.hidden = !tiles.length;
      if (!tiles.length) setNearbyExpanded(false);
    },
    render(view:PlenaryView) {
      const call = view.gameplay?.call;
      const incoming = view.gameplay?.requests.at(0);
      const information = view.gameplay && photos.request;
      const old = previous?.gameplay;
      previous = view;
      if (view.phase!=='negotiation') pendingPickup = undefined;
      tools.hidden = !view.gameplay;
      if (!view.gameplay && dialog.open) dialog.close();
      slots.hidden = !view.gameplay;
      if (view.gameplay) renderSlots(view.gameplay.inventory);
      phoneButton.dataset.call = call?.state ?? '';
      phoneButton.lastChild!.textContent = call?.state==='connected' ? ` Ligação · ${call.peer.name}` :
        call?.state==='incoming' ? ` Chamada · ${call.peer.name}` : ' Celular';
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
      dialog.removeEventListener('close',closed);
      dialog.close();
      tools.hidden = element('object-request').hidden = true;
      delete element('object-request').dataset.request;
      navigation.replaceChildren();
      slots.hidden = nearbyButton.hidden = true;
      slotsRoot.unmount();
      equipmentRoot.unmount();
      objectsRoot.unmount();
      requestRoot.unmount();
      nearbyItems.replaceChildren();
      setNearbyExpanded(false);
    },
  };
}
