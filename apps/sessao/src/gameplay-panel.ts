import { offices } from './elections';
import { setCharacterPortrait } from './character-art';
import { canReachObject, documentTemplates, INVENTORY_SLOTS, objects, PHONE_PREVIEW_MS, terminals, type GameplayAction, type ObjectKind, type WorldItem } from './gameplay';
import type { Motion } from './map';
import type { PlenaryView } from './plenary';
import type { DirectoryContact } from './politics';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
const apps = {
  'Telefone':'handset',
  'Joguinhos':'gamepad',
  'Câmera':'camera',
  'Notícias':'document',
  'Eleições':'ballot',
} as const;
type App = keyof typeof apps;
type InteractionArea = (player:Motion) => boolean;

function node<K extends keyof HTMLElementTagNameMap>(tag:K,text = '') {
  const result = document.createElement(tag);
  result.textContent = text;
  return result;
}

function itemArt(kind:ObjectKind) {
  const portrait = node('img');
  portrait.className = 'item-portrait';
  portrait.src = import.meta.env.BASE_URL+'assets/'+objects[kind].portrait;
  portrait.alt = '';
  portrait.draggable = false;
  return portrait;
}

function glyph(name:string) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
  icon.classList.add('hud-glyph');
  icon.setAttribute('aria-hidden','true');
  const use = document.createElementNS(icon.namespaceURI,'use');
  use.setAttribute('href','#icon-'+name);
  icon.append(use);
  return icon;
}

function itemName(item:Pick<WorldItem,'kind'|'document'>) {
  return item.document?.title ?? objects[item.kind].name;
}

export function createGameplayPanel(send:(action:GameplayAction)=>void, ownId:string, notify:(text:string)=>void) {
  const dialog = element<HTMLDialogElement>('gameplay-dialog');
  const body = element('gameplay-body');
  const navigation = element('phone-apps');
  const feedback = element('gameplay-feedback');
  const target = element<HTMLSelectElement>('gameplay-target');

  const tools = element('gameplay-tools');
  const phoneButton = element<HTMLButtonElement>('open-phone');
  const slots = element('item-slots');
  const nearbyItems = element('nearby-items');
  const nearbyButton = element<HTMLButtonElement>('nearby-objects');
  let selection: {id:number; source:'inventory'|'filed'} | undefined;
  let nearbyKey = '';
  let inventoryKey = '';
  let pendingPickup:InteractionArea | undefined;
  let collectedArea:InteractionArea | undefined;
  let app:App = 'Telefone';
  let previous:PlenaryView | undefined;
  let renderKey = '';
  let targetKey = '';

  function button(label:string, action:()=>void) {
    const result = node('button',label);
    result.type = 'button';
    result.className = 'hud-button hud-button--secondary';
    result.onclick = action;
    return result;
  }

  function objectCard(item:WorldItem) {
    const card = node('article');
    card.className = 'object-card';
    const definition = objects[item.kind];
    const heading = node('h3',itemName(item));
    heading.prepend(itemArt(item.kind));
    const summary = node('details');
    summary.append(node('summary','Inspecionar'),node('p',definition.description));
    const doc = item.document;
    if (doc) summary.append(
      node('p',`Assinaturas ${doc.signatures.length}/${doc.requiredSignatures} · ${doc.signatures.map(person=>person.name).join(', ') || 'nenhuma'}`),
      node('p',`Carimbos ${doc.stamps.length}/${doc.requiredStamps.length} · ${doc.requiredStamps.map(stamp=>doc.stamps.includes(stamp) ? `✓ ${stamp}` : stamp).join(', ')}`),
    );
    if (doc?.requiredOffice) summary.append(node('p',`Assinatura exigida: ${offices[doc.requiredOffice].name}`));
    if ('amount' in definition) summary.append(node('p',`R$ ${definition.amount*10} mil`));
    if (item.photo) {
      const photo = node('figure');
      photo.className = 'phone-photo';
      const group = node('div');
      group.className = 'phone-photo-people';
      for (const person of item.photo.people) {
        const face = node('span');
        face.className = 'portrait';
        face.setAttribute('aria-hidden','true');
        setCharacterPortrait(face,person.character);
        const entry = node('span');
        entry.append(face,node('small',person.name));
        group.append(entry);
      }
      photo.append(group,node('figcaption',`${item.photo.location} · ${Math.floor(item.photo.at/1000)} s`));
      if (item.photo.objects.length) photo.append(node('p',item.photo.objects.join(', ')));
      summary.append(photo);
    }
    card.append(heading,summary);
    return card;
  }

  function open(item?:typeof selection) {
    selection = item;
    feedback.textContent = '';
    renderKey = '';
    element('gameplay-title').textContent = item ? 'Objeto' : 'Celular';
    navigation.hidden = !!item;
    dialog.dataset.mode = item ? 'item' : 'phone';
    if (!dialog.open) dialog.showModal();
    render();
  }

  const appButtons = (Object.keys(apps) as App[]).map(title => {
    const tile = button(title,() => {
      if (app==='Joguinhos' && title!=='Joguinhos') send({kind:'game-stop'});
      app = title;
      feedback.textContent = '';
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

  function contactFace(person:DirectoryContact) {
    const face = node('span');
    face.className = 'portrait phone-contact-face';
    face.setAttribute('aria-hidden','true');
    if (person.character!==undefined) setCharacterPortrait(face,person.character);
    else {
      face.classList.remove('portrait');
      face.textContent = person.name.slice(0,1).toUpperCase();
    }
    return face;
  }

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
    if (!dialog.open || !state || !view) return;
    const phone = !selection;
    const selected = selection;
    const item = selected && state[selected.source].find(item=>item.id===selected.id);
    if (selection && !item) {
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
    const visible = selection ? [item,state.locations,contacts.length] :
      app==='Telefone' ? [state.call,directory.map(({id,name,character})=>({id,name,character}))] : app==='Joguinhos' ? state.game && [state.game.tiles,state.game.progress,state.game.elapsed*1000<PHONE_PREVIEW_MS] :
      app==='Notícias' ? view.politics?.ledger : app==='Eleições' ? view.election?.polls : null;
    const nextKey = JSON.stringify([selection,app,phase,visible]);
    if (nextKey===renderKey) return;
    renderKey = nextKey;
    const focused = body.contains(document.activeElement);
    const cards:HTMLElement[] = [];
    if (item) {
      const card = objectCard(item);
      const act = (label:string,kind:GameplayAction['kind'],place?:string) =>
        card.append(button(label,() => send({kind,item:item.id,target:target.value,place})));
      if (selection?.source==='inventory') {
        const definition = objects[item.kind];
        if ('use' in definition) act(definition.use==='cash' ? 'Embolsar' : 'Tomar café','use');
        if (contacts.length) {
          act('Oferecer','offer');
          if (item.document) act('Pedir assinatura','sign-request');
        }
        act('Largar','drop');
        if ('destructible' in definition) act('Destruir','destroy');
        if (item.document) act('Adulterar','edit');
        for (const place of state.locations) {
          const terminal = terminals[place as keyof typeof terminals];
          if ('delivery' in terminal && terminal.delivery.some(kind=>kind===item.kind)) act('Depositar','deliver',place);
          if ('storage' in terminal) act(`Guardar · ${terminal.title}`,'store',place);
          if (item.document && 'stamp' in terminal) act(`Carimbar · ${terminal.stamp}`,'stamp',place);
          if (item.document && 'file' in terminal) act('Protocolar','file',place);
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
        else if (!state.game) cards.push(button('Jogar Sequência',()=>send({kind:'game-start'})));
        else {
          const game = state.game;
          const preview = game.elapsed*1000<PHONE_PREVIEW_MS;
          cards.push(node('p',preview ? 'Memorize a sequência' : `Repita a sequência · ${game.progress}/${game.total}`));
          cards.push(node('strong',game.tiles ? game.tiles.map(tile=>tile+1).join('  ·  ') : '•  ·  •  ·  •  ·  •  ·  •'));
          const tiles = node('div');
          tiles.className = 'phone-tiles';
          for (let tile=0;tile<4;tile++) {
            const key = button(String(tile+1),()=>send({kind:'game-tile',tile}));
            key.disabled = preview;
            tiles.append(key);
          }
          cards.push(tiles,button('Parar',()=>send({kind:'game-stop'})));
        }
      }
      if (app==='Câmera' && phase==='negotiation') cards.push(button('Tirar foto',()=>send({kind:'photo'})));
      if (app==='Notícias') {
        const ledger = view.politics?.ledger ?? [];
        for (const record of ledger.slice().reverse()) {
          const name = view.politics?.directory.find(person=>person.id===record.from)?.name ?? 'Parlamentar';
          cards.push(node('p',`${name} · ${record.kind==='diversion' ? 'Desvio' : 'Pagamento'} publicado · R$ ${record.amount*10} mil`));
        }
      }
      if (app==='Eleições') cards.push(button('Abrir pesquisa eleitoral',() => {
        dialog.close();
        element<HTMLDetailsElement>('election-dock').open = true;
      }));
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
    slots.replaceChildren(...Array.from({length:INVENTORY_SLOTS},(_,index) => {
      const item = inventory[index];
      if (item) return itemButton(item.kind,itemName(item),'Abrir',()=>open({id:item.id,source:'inventory'}));
      const slot = node('span');
      slot.className = 'item-tile item-tile-empty';
      slot.setAttribute('aria-hidden','true');
      return slot;
    }));
  }

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
  const closed = () => { if (previous?.gameplay?.game) send({kind:'game-stop'}); };
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
      const key = JSON.stringify(state ? [state.nearby,state.stored,state.filed,state.locations] : null);
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
        for (const place of state.locations) {
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
      const old = previous?.gameplay;
      previous = view;
      if (view.phase!=='negotiation') pendingPickup = undefined;
      tools.hidden = !view.gameplay;
      if (!view.gameplay && dialog.open) dialog.close();
      slots.hidden = !view.gameplay;
      if (view.gameplay) renderSlots(view.gameplay.inventory);
      phoneButton.lastChild!.textContent = call?.state==='connected' ? ` Ligação · ${call.peer.name}` :
        call?.state==='incoming' ? ` Chamada · ${call.peer.name}` : ' Celular';
      if (call?.state==='connected' && old?.call?.state!=='connected' && !selection && app==='Telefone') dialog.close();
      if (call?.state==='incoming' && old?.call?.state!=='incoming' && !document.querySelector('dialog:modal')) {
        app = 'Telefone';
        open();
      }
      const requestBox = element('object-request');
      const requestKey = String(incoming?.id ?? '');
      if (requestKey!==requestBox.dataset.request) {
        requestBox.dataset.request = requestKey;
        requestBox.hidden = !incoming;
        if (incoming) {
          const item = incoming.item;
          const card = objectCard(item);
          card.prepend(node('p',`${incoming.from.name} ${incoming.kind==='signature' ? 'pede uma assinatura' : 'oferece um objeto'}`));
          card.append(button(incoming.kind==='signature' ? 'Assinar' : 'Aceitar',()=>send({kind:'accept',item:incoming.id})),
            button('Recusar',()=>send({kind:'decline',item:incoming.id})));
          requestBox.replaceChildren(card);
        } else requestBox.replaceChildren();
      }
      render();
    },
    feedback(text:string) {
      pendingPickup = undefined;
      if (dialog.open) feedback.textContent = text;
      else notify(text);
    },
    destroy() {
      dialog.removeEventListener('close',closed);
      dialog.close();
      tools.hidden = element('object-request').hidden = true;
      delete element('object-request').dataset.request;
      navigation.replaceChildren();
      slots.hidden = nearbyButton.hidden = true;
      slots.replaceChildren();
      nearbyItems.replaceChildren();
      setNearbyExpanded(false);
    },
  };
}
