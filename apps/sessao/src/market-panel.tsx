import { marketKinds, marketProduct } from './market-catalog';
import { isOfficeFurniture, type OfficeFurniture } from './private-offices';
import { markShortcut } from './action-shortcuts';
import { describeFood, foods, isFood } from './food';
import { gearConflict, isGear } from './equipment';
import { canStackItem, INVENTORY_SLOTS, objects, type GameplayAction, type WorldItem } from './gameplay';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { npcs, type NpcId } from './npcs';
import type { PlenaryView } from './plenary';
import { money } from './politics';

function marketVendorPortrait(npc:NpcId) {
  const vendor = npcs[npc];
  return 'portrait' in vendor ? vendor.portrait : vendor.sprite;
}

export function createMarketPanel(send:(action:GameplayAction)=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#market-dialog')!;
  const heading = dialog.querySelector('h2')!;
  const body = dialog.querySelector<HTMLElement>('#market-body')!;
  const root = createRoot(body);
  const prompt = document.querySelector<HTMLDialogElement>('#equip-purchase-dialog')!;
  const purchasedName = prompt.querySelector('#equip-purchase-item')!;
  const yes = prompt.querySelector<HTMLButtonElement>('#equip-purchase-yes')!;
  const no = prompt.querySelector<HTMLButtonElement>('#equip-purchase-no')!;
  if (!yes.hasAttribute('aria-keyshortcuts')) {
    markShortcut(yes,'1');
    markShortcut(no,'2');
  }
  let replacement:number|undefined;
  let purchase:Pick<WorldItem,'id'|'kind'>|undefined;
  yes.onclick = () => {
    const item = purchase?.id;
    const token = replacement;
    prompt.close();
    if (item!==undefined && token!==undefined) send({kind:'replace-gear',item,token});
  };
  no.onclick = () => prompt.close();
  const dismissPurchase = () => { purchase = undefined; replacement = undefined; };
  prompt.addEventListener('close',dismissPurchase);
  const pageSize = 9;
  let page = 0;
  let selected = 0;
  let token:number|undefined;
  let currentVendor:NpcId|undefined;
  let dismissed = false;
  let last = '';
  const close = () => {
    if (token===undefined || dismissed) return;
    dismissed = true;
    send({kind:'dialogue-close'});
  };
  dialog.addEventListener('cancel',close);
  dialog.addEventListener('submit',close);
  function onPageKey(event:KeyboardEvent) {
    if (!event.defaultPrevented && event.key==='Enter' && !event.repeat && !event.altKey &&
        !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      const purchaseButton = body.querySelector<HTMLButtonElement>('.market-buy');
      if (purchaseButton) {
        event.preventDefault();
        purchaseButton.click();
        return;
      }
    }
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (event.key!=='ArrowLeft' && event.key!=='ArrowRight')) return;
    const arrow = body.querySelector<HTMLButtonElement>(`button[aria-keyshortcuts="${event.key}"]`);
    if (!arrow) return;
    event.preventDefault();
    if (!arrow.disabled) arrow.click();
  }
  dialog.addEventListener('keydown',onPageKey);

  function renderCatalog(npc:NpcId,token:number,wallet:number,inventory:readonly WorldItem[],equipped:readonly WorldItem[], furnishings:readonly OfficeFurniture[]) {
    const catalog = npcs[npc].catalog;
    if (!catalog) return;
    const kinds = marketKinds[catalog];
    const owned = [...inventory,...equipped];
    const visible = kinds.slice(page*pageSize,(page+1)*pageSize);
    const pageCount = Math.ceil(kinds.length/pageSize);
    const goTo = (next:number) => {
      if (next===page || next<0 || next>=pageCount) return;
      page = next;
      selected = 0;
      renderCatalog(npc,token,wallet,inventory,equipped,furnishings);
    };
    const stock = visible.map(kind=>{
      const item = objects[kind];
      const price = marketProduct(catalog,kind)!.price;
      const furniture = isOfficeFurniture(kind);
      const hasItem = furniture ? furnishings.includes(kind) : isGear(kind) && owned.some(entry=>entry.kind===kind);
      const stack = inventory.some(entry=>entry.kind===kind) && canStackItem(kind);
      const needsSpace = !isGear(kind) || !!gearConflict(kind,equipped);
      const noSpace = needsSpace && !furniture && !stack && inventory.length>=INVENTORY_SLOTS;
      const status = hasItem ? (furniture ? 'Instalado' : 'Adquirido') : noSpace ? 'Inventário cheio' :
        wallet<price ? 'Saldo insuficiente' : undefined;
      return {kind,item,price,status,hasItem};
    });
    const product = stock[selected];
    const food = product && isFood(product.kind) ? foods[product.kind] : undefined;
    const vendor = npcs[npc];
    flushSync(()=>root.render(<>
      <div className="market-toolbar">
        <div className="market-vendor">
          <img src={import.meta.env.BASE_URL+'assets/'+marketVendorPortrait(npc)} alt=""/>
          <div><h2 id="market-catalog-title">{vendor.label}</h2><strong>{vendor.name}</strong><p>{vendor.catalog==='equipment' ? 'Equipamentos, espionagem e utilidades parlamentares.' :
            vendor.catalog==='furniture' ? 'Móveis instalados no seu gabinete.' : 'Lanches e bebidas.'}</p></div>
        </div>
        <p className="market-wallet tabular-nums"><svg className="hud-glyph" aria-hidden="true"><use href="#icon-wallet"/></svg>{money(wallet)}</p>
      </div>
      <div className="market-catalog-label"><span><svg className="hud-glyph" aria-hidden="true"><use href="#icon-inventory"/></svg>Comprar</span></div>
      <div className="market-catalog-layout">
        <div className="market-products" aria-label="Produtos">
          {stock.map(({kind,item,price,hasItem,status},index)=><button type="button" className="market-product-button item-tile"
            key={kind} aria-pressed={selected===index} aria-label={item.name+' · '+money(price)} aria-keyshortcuts={String(index+1)}
            onClick={()=>{selected = index;renderCatalog(npc,token,wallet,inventory,equipped,furnishings);}}>
            <img className="market-art" src={import.meta.env.BASE_URL+'assets/'+item.portrait} alt="" draggable={false}/>
            <span className="market-product-caption"><strong>{item.name}</strong><span className="market-product-price">{hasItem ? status : money(price)}</span></span>
            <kbd className="action-key" aria-hidden="true">{index+1}</kbd>
          </button>)}
          {Array.from({length:pageSize-stock.length},(_,index)=><div className="market-product-empty item-tile" aria-hidden="true" key={index}>+</div>)}
        </div>
        {product && <section className="market-detail" aria-label="Produto selecionado">
          <div className="market-detail-content">
            <img className="market-detail-art" src={import.meta.env.BASE_URL+'assets/'+product.item.portrait} alt="" draggable={false}/>
            <h3>{product.item.name}</h3>
            <span className="bag-item-type">{food ? 'Consumível' : isGear(product.kind) ? 'Equipamento' : isOfficeFurniture(product.kind) ? 'Mobília' : 'Utilidade'}</span>
            <p className="market-detail-price"><svg className="hud-glyph" aria-hidden="true"><use href="#icon-wallet"/></svg>{money(product.price)}</p>
            <p className="market-detail-description">{product.item.description}</p>
            {food && <p className="market-detail-effects"><strong>Efeitos</strong>{describeFood(food.effect)}</p>}
          </div>
          <button type="button" className="hud-button market-buy" disabled={!!product.status} aria-keyshortcuts="Enter"
            onClick={()=>send({kind:'shop-buy',target:product.kind,token})}>
            <span><svg className="hud-glyph" aria-hidden="true"><use href="#icon-inventory"/></svg>{product.status ?? 'Comprar'}</span>
            <kbd className="action-key" aria-hidden="true">Enter</kbd>
          </button>
        </section>}
      </div>
      <nav className="market-paging" aria-label="Páginas do catálogo">
        <button type="button" className="market-page-arrow" aria-label="Página anterior" aria-keyshortcuts="ArrowLeft"
          disabled={page===0} onClick={()=>goTo(page-1)}>‹</button>
        <div className="market-page-dots">
          {Array.from({length:pageCount},(_,index)=><button type="button" className="market-page-dot" key={index}
            aria-label={'Página '+(index+1)} aria-current={index===page ? 'page' : undefined} onClick={()=>goTo(index)}/>)}
        </div>
        <button type="button" className="market-page-arrow" aria-label="Próxima página" aria-keyshortcuts="ArrowRight"
          disabled={page===pageCount-1} onClick={()=>goTo(page+1)}>›</button>
      </nav>
    </>));
    if (dialog.open && !prompt.open && !dialog.contains(document.activeElement)) {
      dialog.querySelector<HTMLButtonElement>('header button')?.focus({preventScroll:true});
    }
  }

  return {
    render(view:PlenaryView) {
      const inventory = view.gameplay?.inventory ?? [];
      const equipped = view.gameplay?.equipped ?? [];
      if (purchase && equipped.some(item=>item.id===purchase?.id)) purchase = undefined;
      const conflict = purchase && isGear(purchase.kind) ? gearConflict(purchase.kind,equipped) : undefined;
      if (view.phase!=='negotiation' || view.gameplay?.vitality?.recovery ||
        (prompt.open && (replacement!==conflict?.id || !inventory.some(item=>item.id===purchase?.id)))) {
        purchase = undefined;
        if (prompt.open) prompt.close();
      } else if (!prompt.open && conflict && purchase && inventory.some(item=>item.id===purchase?.id)) {
        replacement = conflict.id;
        purchasedName.textContent = `${objects[conflict.kind].name} → ${objects[purchase.kind].name}`;
        prompt.showModal();
      }
      const state = view.phase==='negotiation' ? view.gameplay?.dialogue : undefined;
      if (!state) {
        token = undefined;
        currentVendor = undefined;
        dismissed = false;
        page = 0;
        selected = 0;
        if (last) root.render(null);
        last = '';
        if (dialog.open) dialog.close();
        return;
      }
      if (dismissed) {
        if (state.token===token) return;
        dismissed = false;
        page = 0;
        selected = 0;
      }
      const wallet = view.politics?.wallet ?? 0;
      const furnishings = view.gameplay?.officeFurnishings ?? [];
      if (currentVendor!==state.npc) { page = 0; selected = 0; }
      currentVendor = state.npc;
      const key = JSON.stringify([state.npc,state.token,state.shop,state.text,state.options,wallet,inventory,equipped,furnishings]);
      if (key===last) return;
      last = key;
      token = state.token;
      const npc = npcs[state.npc];
      dialog.classList.toggle('market-catalog',state.shop);
      dialog.setAttribute('aria-labelledby',state.shop ? 'market-catalog-title' : 'market-title');
      heading.textContent = state.shop ? npc.label : npc.name;
      if (!dialog.open) dialog.showModal();
      if (!state.shop) {
        flushSync(()=>root.render(<>
          <div className="market-line">
            <img className="phone-contact-face market-npc-face" src={import.meta.env.BASE_URL+'assets/'+npc.sprite} alt=""/>
            <p>{state.text}</p>
          </div>
          <div className="market-choices">
            {state.options.map((option,index)=><button key={option.id} type="button" className="hud-button hud-button--secondary"
              aria-keyshortcuts={String(index+1)} onClick={()=>send({kind:'dialogue-choice',target:option.id,token:state.token})}>
              {option.label}<kbd className="action-key" aria-hidden="true">{index+1}</kbd>
            </button>)}
          </div>
        </>));
        body.querySelector<HTMLButtonElement>('.market-choices button')?.focus();
        return;
      }
      renderCatalog(state.npc,state.token,wallet,inventory,equipped,furnishings);
    },
    purchased(item:Pick<WorldItem,'id'|'kind'>) {
      purchase = item;
    },
    isOpen() { return dialog.open; },
    destroy() {
      root.unmount();
      prompt.removeEventListener('close',dismissPurchase);
      purchase = undefined;
      prompt.close();
      yes.onclick = no.onclick = null;
      dialog.removeEventListener('cancel',close);
      dialog.removeEventListener('submit',close);
      dialog.removeEventListener('keydown',onPageKey);
      dialog.close();
    },
  };
}
