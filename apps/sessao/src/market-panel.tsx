import { isOfficeFurniture, isOfficeGood, officeGoodKinds, officeGoods, type OfficeFurniture } from './private-offices';
import { markShortcut } from './action-shortcuts';
import { describeFood, foodKinds, foods, isFood } from './food';
import { concealment, equipment, gearKinds, isGear } from './equipment';
import { INVENTORY_SLOTS, objects, type GameplayAction, type WorldItem } from './gameplay';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { npcs, type NpcId } from './npcs';
import type { PlenaryView } from './plenary';
import { money } from './politics';

import { isSpyProduct, spyProducts, type SpyProduct } from "./surveillance";

const spyKinds = Object.keys(spyProducts) as SpyProduct[];

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
  let purchase:Pick<WorldItem,'id'|'kind'>|undefined;
  yes.onclick = () => {
    const item = purchase?.id;
    prompt.close();
    if (item!==undefined) send({kind:'equip',item});
  };
  no.onclick = () => prompt.close();
  const dismissPurchase = () => { purchase = undefined; };
  prompt.addEventListener('close',dismissPurchase);
  const pageSize = 9;
  let page = 0;
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
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (event.key!=='ArrowLeft' && event.key!=='ArrowRight')) return;
    const arrow = body.querySelector<HTMLButtonElement>(`button[aria-keyshortcuts="${event.key}"]`);
    if (!arrow) return;
    event.preventDefault();
    if (!arrow.disabled) arrow.click();
  }
  dialog.addEventListener('keydown',onPageKey);

  function renderCatalog(npc:NpcId,token:number,wallet:number,inventory:readonly WorldItem[],equipped:readonly WorldItem[], furnishings:readonly OfficeFurniture[]) {
    const kinds = npcs[npc].catalog==='equipment' ? [...gearKinds,...officeGoodKinds,...spyKinds,'mensalUnderwear' as const] : foodKinds;
    const owned = [...inventory,...equipped];
    const visible = kinds.slice(page*pageSize,(page+1)*pageSize);
    const pageCount = Math.ceil(kinds.length/pageSize);
    const goTo = (next:number) => {
      if (next===page || next<0 || next>=pageCount) return;
      page = next;
      renderCatalog(npc,token,wallet,inventory,equipped,furnishings);
    };
    flushSync(()=>root.render(<>
      <div className="market-toolbar"><p className="market-wallet tabular-nums">
        <svg className="hud-glyph" aria-hidden="true"><use href="#icon-wallet"/></svg>{money(wallet)}
      </p></div>
      <div className="market-products">
        {visible.map((kind,index)=>{
          const food = isFood(kind) ? foods[kind] : undefined;
          const price = isGear(kind) ? equipment[kind].price : isOfficeGood(kind) ? officeGoods[kind].price :
            isSpyProduct(kind) ? spyProducts[kind].price : kind==='mensalUnderwear' ? concealment.price : foods[kind].price;
          const item = objects[kind];
          const furniture = isOfficeFurniture(kind);
          const hasItem = furniture ? furnishings.includes(kind) : isGear(kind) && owned.some(entry=>entry.kind===kind);
          const noSpace = !furniture && inventory.length>=INVENTORY_SLOTS;
          const disabled = hasItem || wallet<price || noSpace;
          const priceLabel = hasItem ? (furniture ? 'Instalado' : 'Adquirido') : money(price);
          const detail = 'market-description-'+kind;
          return <article className="market-product" key={kind}>
            <button type="button" className="market-product-button" disabled={disabled} aria-describedby={detail}
              aria-label={hasItem ? item.name+' · '+priceLabel : 'Comprar '+item.name+' · '+priceLabel}
              aria-keyshortcuts={disabled ? undefined : String(index+1)}
              onClick={()=>send({kind:'shop-buy',target:kind,token})}>
              <img className="market-art" src={import.meta.env.BASE_URL+'assets/'+item.portrait} alt="" draggable={false}/>
              <span className="market-product-caption"><strong>{item.name}</strong><span className="market-product-price">{priceLabel}</span></span>
              {!disabled && <kbd className="action-key" aria-hidden="true">{index+1}</kbd>}
            </button>
            <span id={detail} className="market-product-details">{item.description}
              {food && <small>{food.category} · {describeFood(food.effect)}</small>}
              {!hasItem && (noSpace || wallet<price) && <small>{noSpace ? 'Inventário cheio' : 'Saldo insuficiente'}</small>}
            </span>
          </article>;
        })}
        {Array.from({length:pageSize-visible.length},(_,index)=><div className="market-product-empty" aria-hidden="true" key={index}/>)}
      </div>
      <nav className="market-paging" aria-label="Páginas do catálogo">
        <button type="button" className="market-page-arrow" aria-label="Página anterior" aria-keyshortcuts="ArrowLeft"
          hidden={pageCount===1} disabled={page===0} onClick={()=>goTo(page-1)}>‹</button>
        <div className="market-page-dots">
          {Array.from({length:pageCount},(_,index)=><button type="button" className="market-page-dot" key={index}
            aria-label={'Página '+(index+1)} aria-current={index===page ? 'page' : undefined} onClick={()=>goTo(index)}/>)}
        </div>
        <button type="button" className="market-page-arrow" aria-label="Próxima página" aria-keyshortcuts="ArrowRight"
          hidden={pageCount===1} disabled={page===pageCount-1} onClick={()=>goTo(page+1)}>›</button>
      </nav>
    </>));
    if (dialog.open && !prompt.open && !dialog.contains(document.activeElement)) {
      dialog.querySelector<HTMLButtonElement>('header button')?.focus({preventScroll:true});
    }
  }

  return {
    render(view:PlenaryView) {
      const inventory = view.gameplay?.inventory ?? [];
      if (view.phase!=='negotiation' || view.gameplay?.vitality?.recovery ||
        (prompt.open && !inventory.some(item=>item.id===purchase?.id))) {
        purchase = undefined;
        if (prompt.open) prompt.close();
      } else if (!prompt.open && purchase && inventory.some(item=>item.id===purchase?.id)) {
        purchasedName.textContent = objects[purchase.kind].name;
        prompt.showModal();
      }
      const state = view.phase==='negotiation' ? view.gameplay?.dialogue : undefined;
      if (!state) {
        token = undefined;
        currentVendor = undefined;
        dismissed = false;
        page = 0;
        if (last) root.render(null);
        last = '';
        if (dialog.open) dialog.close();
        return;
      }
      if (dismissed) {
        if (state.token===token || state.shop) return;
        dismissed = false;
        page = 0;
      }
      const wallet = view.politics?.wallet ?? 0;
      const equipped = view.gameplay?.equipped ?? [];
      const furnishings = view.gameplay?.officeFurnishings ?? [];
      if (currentVendor!==state.npc) page = 0;
      currentVendor = state.npc;
      const key = JSON.stringify([state.npc,state.token,state.shop,state.text,state.options,wallet,inventory,equipped,furnishings]);
      if (key===last) return;
      last = key;
      token = state.token;
      const npc = npcs[state.npc];
      dialog.classList.toggle('market-catalog',state.shop);
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
