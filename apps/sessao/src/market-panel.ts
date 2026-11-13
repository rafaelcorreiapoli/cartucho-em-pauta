import { isOfficeFurniture, isOfficeGood, officeGoodKinds, officeGoods, type OfficeFurniture } from './private-offices';
import { markShortcut } from './action-shortcuts';
import { describeFood, foodKinds, foods, isFood } from './food';
import { concealment, equipment, gearKinds, isGear } from './equipment';
import { INVENTORY_SLOTS, objects, type GameplayAction, type WorldItem } from './gameplay';
import { button, glyph, itemPortrait, node } from './gameplay-ui';
import { npcs, type NpcId } from './npcs';
import type { PlenaryView } from './plenary';
import { money } from './politics';

import { isSpyProduct, spyProducts, type SpyProduct } from "./surveillance";

const spyKinds = Object.keys(spyProducts) as SpyProduct[];

export function createMarketPanel(send:(action:GameplayAction)=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#market-dialog')!;
  const heading = dialog.querySelector('h2')!;
  const body = dialog.querySelector<HTMLElement>('#market-body')!;
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
    const funds = node('p',money(wallet));
    funds.className = 'market-wallet';
    funds.prepend(glyph('wallet'));
    const toolbar = node('div');
    toolbar.className = 'market-toolbar';
    toolbar.append(funds);
    const products = node('div');
    products.className = 'market-products';
    const kinds = npcs[npc].catalog==='equipment' ? [...gearKinds,...officeGoodKinds,...spyKinds,'mensalUnderwear' as const] : foodKinds;
    const owned = [...inventory,...equipped];
    const full = inventory.length>=INVENTORY_SLOTS;
    const visible = kinds.slice(page*pageSize,(page+1)*pageSize);
    for (const [index,kind] of visible.entries()) {
      const food = isFood(kind) ? foods[kind] : undefined;
      const price = isGear(kind) ? equipment[kind].price : isOfficeGood(kind) ? officeGoods[kind].price : isSpyProduct(kind) ? spyProducts[kind].price : kind==='mensalUnderwear' ? concealment.price : foods[kind].price;
      const item = objects[kind];
      const card = node('article');
      card.className = 'market-product';
      const art = itemPortrait(kind);
      art.className = 'market-art';
      const furniture = isOfficeFurniture(kind);
      const hasItem = furniture ? furnishings.includes(kind) : isGear(kind) && owned.some(ownedItem=>ownedItem.kind===kind);
      const noSpace = !furniture && full;
      const priceLabel = hasItem ? (furniture ? 'Instalado' : 'Adquirido') : money(price);
      const buy = button('',()=>send({kind:'shop-buy',target:kind,token}));
      buy.className = 'market-product-button';
      buy.disabled = hasItem || wallet<price || noSpace;
      buy.setAttribute('aria-label',hasItem ? `${item.name} · ${priceLabel}` : `Comprar ${item.name} · ${money(price)}`);
      const caption = node('span');
      caption.className = 'market-product-caption';
      const name = node('strong',item.name);
      const cost = node('span',priceLabel);
      cost.className = 'market-product-price';
      caption.append(name,cost);
      buy.append(art,caption);
      if (!buy.disabled) markShortcut(buy,String(index+1));

      const details = node('span',item.description);
      details.className = 'market-product-details';
      details.id = `market-description-${kind}`;
      if (food) details.append(node('small',`${food.category} · ${describeFood(food.effect)}`));
      if (!hasItem && (noSpace || wallet<price)) details.append(node('small',noSpace ? 'Inventário cheio' : 'Saldo insuficiente'));
      buy.setAttribute('aria-describedby',details.id);
      card.append(buy,details);
      products.append(card);
    }
    for (let index=visible.length;index<pageSize;index++) {
      const empty = node('div');
      empty.className = 'market-product-empty';
      empty.setAttribute('aria-hidden','true');
      products.append(empty);
    }

    const pageCount = Math.ceil(kinds.length/pageSize);
    const paging = node('nav');
    paging.className = 'market-paging';
    paging.setAttribute('aria-label','Páginas do catálogo');
    const goTo = (next:number) => {
      if (next===page || next<0 || next>=pageCount) return;
      page = next;
      renderCatalog(npc,token,wallet,inventory,equipped,furnishings);
    };
    const previous = button('‹',()=>goTo(page-1));
    const next = button('›',()=>goTo(page+1));
    for (const [arrow,label,key,disabled] of [
      [previous,'Página anterior','ArrowLeft',page===0],
      [next,'Próxima página','ArrowRight',page===pageCount-1],
    ] as const) {
      arrow.className = 'market-page-arrow';
      arrow.setAttribute('aria-label',label);
      arrow.setAttribute('aria-keyshortcuts',key);
      arrow.disabled = disabled;
      arrow.hidden = pageCount===1;
    }
    const dots = node('div');
    dots.className = 'market-page-dots';
    for (let index=0;index<pageCount;index++) {
      const dot = button('',()=>goTo(index));
      dot.className = 'market-page-dot';
      dot.setAttribute('aria-label',`Página ${index+1}`);
      if (index===page) dot.setAttribute('aria-current','page');
      dots.append(dot);
    }
    paging.append(previous,dots,next);
    body.replaceChildren(toolbar,products,paging);
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
      const key = JSON.stringify([state.npc,state.token,state.options,wallet,inventory,equipped,furnishings]);
      if (key===last) return;
      last = key;
      token = state.token;
      const npc = npcs[state.npc];
      dialog.classList.toggle('market-catalog',state.shop);
      heading.textContent = state.shop ? npc.label : npc.name;
      if (!dialog.open) dialog.showModal();
      if (!state.shop) {
        const line = node('div');
        line.className = 'market-line';
        const face = node('img');
        face.className = 'phone-contact-face market-npc-face';
        face.src = import.meta.env.BASE_URL+'assets/'+npc.sprite;
        face.alt = '';
        line.append(face,node('p',state.text));
        const choices = node('div');
        choices.className = 'market-choices';
        for (const [index,option] of state.options.entries()) {
          const choice = button(option.label,()=>send({kind:'dialogue-choice',target:option.id,token:state.token}));
          markShortcut(choice,String(index+1));
          choices.append(choice);
        }
        body.replaceChildren(line,choices);
        choices.querySelector('button')?.focus();
        return;
      }
      renderCatalog(state.npc,state.token,wallet,inventory,equipped,furnishings);
    },
    purchased(item:Pick<WorldItem,'id'|'kind'>) {
      purchase = item;
    },
    isOpen() { return dialog.open; },
    destroy() {
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
