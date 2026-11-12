import { offices } from './elections';
import { setCharacterPortrait } from './character-art';
import { documentTemplates, objects, PHONE_PREVIEW_MS, terminals, type GameplayAction, type WorldItem } from './gameplay';
import type { PlenaryView } from './plenary';

const element = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;
type App = 'Telefone'|'Joguinhos'|'Câmera'|'Notícias'|'Eleições';
const apps:App[] = ['Telefone','Joguinhos','Câmera','Notícias','Eleições'];

function node<K extends keyof HTMLElementTagNameMap>(tag:K,text = '') {
  const result = document.createElement(tag);
  result.textContent = text;
  return result;
}

export function createGameplayPanel(send:(action:GameplayAction)=>void, ownId:string, carry:()=>void, notify:(text:string)=>void) {
  const dialog = element<HTMLDialogElement>('gameplay-dialog');
  const body = element('gameplay-body');
  const navigation = element('phone-apps');
  const feedback = element('gameplay-feedback');
  const target = element<HTMLSelectElement>('gameplay-target');

  const tools = element('gameplay-tools');
  const phoneButton = element<HTMLButtonElement>('open-phone');
  const inventoryButton = element<HTMLButtonElement>('open-inventory');
  const nearbyButton = element<HTMLButtonElement>('nearby-objects');
  const carryButton = element<HTMLButtonElement>('carry-cash');
  let mode:'inventory'|'nearby'|'phone' = 'inventory';
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
    const heading = node('h3',item.document?.title ?? definition.name);
    const icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
    icon.classList.add('hud-glyph');
    icon.setAttribute('aria-hidden','true');
    const use = document.createElementNS(icon.namespaceURI,'use');
    use.setAttribute('href','#icon-'+definition.icon);
    icon.append(use);
    heading.prepend(icon);
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

  function open(next:typeof mode) {
    mode = next;
    feedback.textContent = '';
    renderKey = '';
    element('gameplay-title').textContent = next==='phone' ? 'Celular' : next==='nearby' ? 'Objetos próximos' : 'Inventário';
    navigation.hidden = next!=='phone';
    if (!dialog.open) dialog.showModal();
    render();
  }

  for (const title of apps) {
    navigation.append(button(title,() => {
      if (app==='Joguinhos' && title!=='Joguinhos') send({kind:'game-stop'});
      app = title;
      render();
    }));
  }

  function render() {
    const view = previous;
    const state = view?.gameplay;
    if (!dialog.open || !state || !view) return;
    const phone = mode==='phone';
    const list = phone && app==='Telefone' ? view.politics?.directory ?? [] : state.contacts;
    const contacts = list.filter(person=>person.id!==ownId);
    const key = JSON.stringify(contacts);
    if (key!==targetKey) {
      targetKey = key;
      const selected = target.value;
      target.replaceChildren(new Option('Escolha…',''),...contacts.map(person=>new Option(person.name,person.id)));
      if (contacts.some(person=>person.id===selected)) target.value = selected;
    }
    element('gameplay-target-label').hidden = phone ? app!=='Telefone' || !!state.call : mode!=='inventory' || !contacts.length;
    const phase = view.phase;
    const visible = mode==='inventory' ? [state.inventory,state.locations,contacts.length] :
      mode==='nearby' ? [state.nearby,state.stored,state.filed,state.locations] :
      app==='Telefone' ? state.call : app==='Joguinhos' ? state.game && [state.game.tiles,state.game.progress,state.game.elapsed*1000<PHONE_PREVIEW_MS] :
      app==='Notícias' ? view.politics?.ledger : app==='Eleições' ? view.election?.polls : null;
    const nextKey = JSON.stringify([mode,app,phase,visible]);
    if (nextKey===renderKey) return;
    renderKey = nextKey;
    const focused = body.contains(document.activeElement);
    const cards:HTMLElement[] = [];
    if (!phone) cards.push(button(mode==='inventory' ? 'Objetos próximos' : 'Meu inventário',()=>{
      open(mode==='inventory' ? 'nearby' : 'inventory');
    }));
    for (const item of mode==='inventory' ? state.inventory : mode==='nearby' ? [...state.nearby,...state.stored] : []) {
      const card = objectCard(item);
      const act = (label:string,kind:GameplayAction['kind'],place?:string) =>
        card.append(button(label,() => send({kind,item:item.id,target:target.value,place})));
      if (mode==='nearby') {
        act(state.stored.some(stored=>stored.id===item.id) ? 'Recuperar' : 'Coletar',state.stored.some(stored=>stored.id===item.id) ? 'recover' : 'collect');
      } else {
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
    if (mode==='nearby') {
      for (const place of state.locations) {
        const terminal = terminals[place as keyof typeof terminals];
        if ('supply' in terminal && terminal.supply==='document') {
          for (const [key,template] of Object.entries(documentTemplates)) {
            cards.unshift(button(template.title,()=>send({kind:'supply',place,target:key})));
          }
        } else if ('supply' in terminal) {
          cards.unshift(button('Pegar '+objects[terminal.supply].name,()=>send({kind:'supply',place})));
        }
      }
    }
    if (mode==='nearby' && state.filed.length) {
      cards.push(node('h3','Protocolados'),...state.filed.map(objectCard));
    }
    if (phone) {
      if (app==='Telefone') {
        const call = state.call;
        if (call) {
          cards.push(node('p',`${call.state==='incoming' ? 'Chamada de' : call.state==='outgoing' ? 'Chamando' : 'Em ligação com'} ${call.peer.name}`));
          if (call.state==='incoming') cards.push(button('Atender',()=>send({kind:'answer'})));
          cards.push(button(call.state==='incoming' ? 'Recusar' : 'Encerrar',()=>send({kind:'hangup'})));
        } else if (phase==='negotiation') cards.push(button('Ligar',()=>send({kind:'call',target:target.value})));
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

  inventoryButton.onclick = () => open('inventory');
  nearbyButton.onclick = () => open('nearby');
  phoneButton.onclick = () => open('phone');
  carryButton.onclick = carry;
  const closed = () => { if (previous?.gameplay?.game) send({kind:'game-stop'}); };
  dialog.addEventListener('close',closed);

  return {
    render(view:PlenaryView) {
      const call = view.gameplay?.call;
      const incoming = view.gameplay?.requests.at(0);
      const old = previous?.gameplay;
      previous = view;
      tools.hidden = !view.gameplay;
      if (!view.gameplay && dialog.open) dialog.close();
      element('inventory-count').textContent = String(view.gameplay?.inventory.length ?? 0);
      phoneButton.lastChild!.textContent = call?.state==='connected' ? ` Ligação · ${call.peer.name}` :
        call?.state==='incoming' ? ` Chamada · ${call.peer.name}` : ' Celular';
      if (call?.state==='connected' && old?.call?.state!=='connected' && mode==='phone' && app==='Telefone') dialog.close();
      if (call?.state==='incoming' && old?.call?.state!=='incoming' && !document.querySelector('dialog:modal')) {
        app = 'Telefone';
        open('phone');
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
      if (dialog.open) feedback.textContent = text;
      else notify(text);
    },
    destroy() {
      dialog.removeEventListener('close',closed);
      dialog.close();
      tools.hidden = element('object-request').hidden = true;
      delete element('object-request').dataset.request;
      navigation.replaceChildren();
    },
  };
}
