import { installationSites, shop } from './installations';
import { decorationLabel, itemSymbols } from './photo-renderer';
import { emptyPhotoAccess, PHOTO_LIMIT, type PhotoAccessView, type Photo, type PhotoScene } from './photography';
import { money } from './politics';
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
  'Álbum':'album',
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
  if (itemSymbols[kind]) {
    const symbol = node('span',itemSymbols[kind]);
    symbol.className = 'item-art-symbol';
    symbol.setAttribute('aria-hidden','true');
    return symbol;
  }
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

export function createGameplayPanel(send:(action:GameplayAction)=>void, ownId:string, notify:(text:string)=>void, drawPhoto:(canvas:HTMLCanvasElement,photo?:PhotoScene)=>void) {
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
  let photos = emptyPhotoAccess;
  let app:App = 'Telefone';
  let photoId:number | undefined;
  let photoRecipient:string | undefined;
  let decorationId:number | undefined;
  let showing = false;
  let cameraPreview:HTMLCanvasElement | undefined;
  const previewTimer = window.setInterval(()=>{
    if (dialog.open && cameraPreview?.isConnected) drawPhoto(cameraPreview);
  },150);
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
    card.append(heading,summary);
    return card;
  }

  function open(item?:typeof selection, decoration?:number) {
    selection = item;
    decorationId = decoration;
    const object = !!item || decoration!==undefined;
    photoRecipient = undefined;
    feedback.textContent = '';
    renderKey = '';
    element('gameplay-title').textContent = object ? 'Objeto' : 'Celular';
    navigation.hidden = object;
    dialog.dataset.mode = object ? 'item' : 'phone';
    if (!dialog.open) dialog.showModal();
    render();
  }

  const appButtons = (Object.keys(apps) as App[]).map(title => {
    const tile = button(title,() => {
      if (app==='Joguinhos' && title!=='Joguinhos') send({kind:'game-stop'});
      if (showing) closePresentation();
      app = title;
      photoId = photoRecipient = undefined;
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
    const phone = !selection && decorationId===undefined;
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
    const visible = selection ? [item,state.locations,contacts.length,state.exposed,state.installable] : decoration ? decoration :
      app==='Álbum' ? [photos.album.map(({photo})=>photo.id),photos.publicPhotos.map(photo=>photo.id),showing && photos.shown,photoId,photoRecipient,contacts,state.locations.includes('press')] :
      app==='Câmera' ? photos.album.length :
      app==='Telefone' ? [state.call,directory.map(({id,name,character})=>({id,name,character}))] : app==='Joguinhos' ? state.game && [state.game.tiles,state.game.progress,state.game.elapsed*1000<PHONE_PREVIEW_MS] :
      app==='Notícias' ? [view.politics?.ledger,photos.publicPhotos.map(photo=>photo.id),photoId] : app==='Eleições' ? view.election?.polls : null;
    const nextKey = JSON.stringify([selection,decorationId,app,phase,visible]);
    if (nextKey===renderKey) return;
    renderKey = nextKey;
    const focused = body.contains(document.activeElement);
    cameraPreview = undefined;
    const cards:HTMLElement[] = [];
    if (item) {
      const card = objectCard(item);
      const act = (label:string,kind:GameplayAction['kind'],place?:string) =>
        card.append(button(label,() => send({kind,item:item.id,target:target.value,place})));
      if (selection?.source==='inventory') {
        const definition = objects[item.kind];
        if ('use' in definition) act(definition.use==='cash' ? 'Embolsar' : item.kind==='pizza' ? 'Comer pizza' : 'Tomar café','use');
        if ('exposable' in definition) {
          const exposed = state.exposed===item.id;
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
    if (decoration) {
      const card = node('article');
      card.className = 'object-card';
      card.append(node('h3',decorationLabel(decoration)));
      if (decoration.kind==='portrait') card.append(contactFace({...decoration.owner,character:decoration.character}));
      if (decoration.marked) card.append(node('p','Retrato rabiscado'));
      if (decoration.kind==='vip') card.append(node('p','Área reservada por '+decoration.owner.name));
      const control = (label:string,kind:GameplayAction['kind'])=>button(label,()=>send({kind,item:decoration.id}));
      if (phase==='negotiation') {
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
      if (app==='Câmera') {
        cameraPreview = node('canvas');
        cameraPreview.className = 'camera-preview';
        cameraPreview.setAttribute('aria-label','Enquadramento da câmera');
        drawPhoto(cameraPreview);
        cards.push(cameraPreview);
        const capture = (label:string,kind:'photo'|'selfie') => {
          const shutter = button(label,()=>send({kind}));
          shutter.disabled = phase!=='negotiation' || photos.album.length>=PHOTO_LIMIT;
          shutter.prepend(glyph('camera'));
          return shutter;
        };
        cards.push(capture('Tirar foto','photo'),capture('Selfie','selfie'));
        cards.push(button(`Abrir álbum · ${photos.album.length}/${PHOTO_LIMIT}`,()=>{app='Álbum';render();}));
      }
      if (app==='Álbum') {
        const entry = photos.album.find(entry=>entry.photo.id===photoId);
        if (showing && photos.shown) {
          cards.push(photoView(photos.shown,true),button('Fechar apresentação',closePresentation));
        } else if (entry) {
          cards.push(button('Voltar ao álbum',()=>{photoId=photoRecipient=undefined;render();}),photoView(entry.photo,true));
          cards.push(node('p',entry.access==='original' ? 'Original' : 'Cópia verificada'));
          if (contacts.length) {
            const list = node('div');
            list.className = 'photo-contacts';
            for (const person of contacts) {
              const choice = button(person.name,()=>{photoRecipient=person.id;render();});
              choice.classList.add('photo-contact');
              choice.setAttribute('aria-pressed',String(photoRecipient===person.id));
              choice.prepend(contactFace(directory.find(contact=>contact.id===person.id) ?? person));
              list.append(choice);
            }
            cards.push(list);
          }
          if (contacts.some(person=>person.id===photoRecipient)) {
            for (const [kind,label] of [['info-show','Mostrar'],['info-copy','Enviar cópia']] as const) {
              cards.push(button(label,()=>send({kind,item:entry.photo.id,target:photoRecipient})));
            }
          }
          if (state.locations.includes('press') && phase==='negotiation' && !photos.publicPhotos.some(photo=>photo.id===entry.photo.id)) {
            cards.push(button('Publicar nas Notícias',()=>send({kind:'photo-publish',item:entry.photo.id})));
          }
          cards.push(button('Excluir do meu álbum',()=>send({kind:'photo-delete',item:entry.photo.id})));
        } else cards.push(photoGrid(photos.album.map(entry=>entry.photo),'O álbum está vazio.'));
      }
      if (app==='Notícias') {
        const current = photos.publicPhotos.find(photo=>photo.id===photoId);
        if (current) cards.push(button('Voltar às Notícias',()=>{photoId=undefined;render();}),photoView(current,true));
        else if (photos.publicPhotos.length) cards.push(photoGrid(photos.publicPhotos,''));
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

  function photoView(photo:Photo, full:boolean) {
    const figure = node('figure');
    figure.className = full ? 'album-photo album-photo-full' : 'album-photo';
    const canvas = node('canvas');
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label',`${photo.selfie ? 'Selfie' : 'Foto'} em ${photo.location} · ${photo.people.map(person=>person.name).join(', ')}`);
    drawPhoto(canvas,photo);
    figure.append(canvas,node('figcaption',full ? `${photo.author.name} · ${photo.location} · ${Math.floor(photo.at/1000)} s` : photo.location));
    if (full) {
      const facts = photo.people.map(person=>person.name+(person.exposed ? ` · ${objects[person.exposed.kind].name}` : ''));
      if (facts.length) figure.append(node('small',facts.join(' / ')));
      for (const handoff of photo.transfers) {
        const from = photo.people.find(person=>person.id===handoff.from)?.name;
        const to = photo.people.find(person=>person.id===handoff.to)?.name;
        figure.append(node('small',`Entrega recente · ${from} → ${to} · ${objects[handoff.kind].name}`));
      }
    }
    return figure;
  }

  function photoGrid(photos:Photo[], empty:string) {
    if (!photos.length) return node('p',empty);
    const grid = node('div');
    grid.className = 'album-grid';
    for (const photo of [...photos].reverse()) {
      const tile = button('',()=>{photoId=photo.id;render();});
      tile.className = 'album-tile';
      tile.setAttribute('aria-label',`Abrir fotografia ${photo.id} · ${photo.location}`);
      tile.append(photoView(photo,false));
      grid.append(tile);
    }
    return grid;
  }

  function closePresentation() {
    showing = false;
    send({kind:'info-close'});
    render();
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
  const closed = () => {
    if (previous?.gameplay?.game) send({kind:'game-stop'});
    if (showing) closePresentation();
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
      const key = JSON.stringify(state ? [state.nearby,state.stored,state.filed,state.locations,state.interactive,photos.album.length] : null);
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
        if (state.locations.includes('press') && photos.album.length) {
          tiles.push(itemButton('portrait','Álbum para a Imprensa','Abrir',()=>{app='Álbum';photoId=undefined;open();}));
        }
        for (const decoration of state.interactive) {
          tiles.push(itemButton(decoration.kind,decorationLabel(decoration),'Inspecionar',()=>open(undefined,decoration.id)));
        }
        for (const place of state.locations) {
          for (const kind of place==='coffee' ? ['pizza'] as const : place==='credentials' ? ['portrait','vip'] as const : []) {
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
      phoneButton.lastChild!.textContent = call?.state==='connected' ? ` Ligação · ${call.peer.name}` :
        call?.state==='incoming' ? ` Chamada · ${call.peer.name}` : ' Celular';
      if (call?.state==='connected' && old?.call?.state!=='connected' && !selection && app==='Telefone') dialog.close();
      if (call?.state==='incoming' && old?.call?.state!=='incoming' && !document.querySelector('dialog:modal')) {
        app = 'Telefone';
        open();
      }
      const requestBox = element('object-request');
      const requestKey = information ? `info-${information.id}` : String(incoming?.id ?? '');
      if (requestKey!==requestBox.dataset.request) {
        requestBox.dataset.request = requestKey;
        requestBox.hidden = !incoming && !information;
        if (information) {
          const card = node('article');
          card.className = 'object-card';
          card.append(node('p',`${information.from.name} quer ${information.mode==='copy' ? 'enviar uma cópia de' : 'mostrar'} uma fotografia.`),
            button('Aceitar',()=>send({kind:'info-accept',item:information.id})),
            button('Recusar',()=>send({kind:'info-decline',item:information.id})));
          requestBox.replaceChildren(card);
        } else if (incoming) {
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
    photoState(next:PhotoAccessView) {
      const captured = next.album.some(({photo,access})=>access==='original' && !photos.album.some(entry=>entry.photo.id===photo.id));
      const presented = next.shown && next.shown.id!==photos.shown?.id;
      photos = next;
      if (presented) {
        showing = true;
        app = 'Álbum';
        open();
      }
      if (previous) this.render(previous);
      if (captured && cameraPreview?.isConnected) {
        cameraPreview.animate([{filter:'brightness(3)'},{filter:'brightness(1)'}],{duration:220});
      }
      return captured;
    },
    feedback(text:string) {
      pendingPickup = undefined;
      if (dialog.open) feedback.textContent = text;
      else notify(text);
    },
    destroy() {
      window.clearInterval(previewTimer);
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
