import { markShortcut } from './action-shortcuts';
import { describeFood, foodKinds, foods, isFood } from './food';
import { equipment, gearKinds, isGear } from './equipment';
import { INVENTORY_SLOTS, objects, type GameplayAction, type WorldItem } from './gameplay';
import { button, contactFace, glyph, itemPortrait, node } from './gameplay-ui';
import { npcs } from './npcs';
import type { PlenaryView } from './plenary';
import { money } from './politics';

export function createMarketPanel(send:(action:GameplayAction)=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#market-dialog')!;
  const heading = dialog.querySelector('h2')!;
  const body = dialog.querySelector<HTMLElement>('#market-body')!;
  const feedback = dialog.querySelector<HTMLElement>('#market-feedback')!;
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
  const pageSize = 4;
  let category:'equipment'|'food' = 'equipment';
  let page = 0;
  let token:number|undefined;
  let dismissed = false;
  let last = '';
  const close = () => {
    if (token===undefined || dismissed) return;
    dismissed = true;
    send({kind:'dialogue-close'});
  };
  dialog.addEventListener('cancel',close);
  dialog.addEventListener('submit',close);

  function renderCatalog(token:number,wallet:number,inventory:readonly WorldItem[],equipped:readonly WorldItem[]) {
    const funds = node('p',money(wallet));
    funds.className = 'market-wallet';
    funds.prepend(glyph('wallet'));
    const tabs = node('div');
    tabs.className = 'market-category';
    for (const [value,label,key] of [['equipment','Equipamentos','8'],['food','Comida','9']] as const) {
      const tab = button(label,()=>{
        if (category===value) return;
        category = value;
        page = 0;
        renderCatalog(token,wallet,inventory,equipped);
      });
      tab.setAttribute('aria-pressed',String(category===value));
      markShortcut(tab,key);
      tabs.append(tab);
    }
    const products = node('div');
    products.className = 'market-products';
    const kinds = category==='equipment' ? gearKinds : foodKinds;
    const owned = [...inventory,...equipped];
    const full = inventory.length>=INVENTORY_SLOTS;
    for (const [index,kind] of kinds.slice(page*pageSize,(page+1)*pageSize).entries()) {
      const food = isFood(kind) ? foods[kind] : undefined;
      const price = isGear(kind) ? equipment[kind].price : foods[kind].price;
      const item = objects[kind];
      const card = node('article');
      const art = itemPortrait(kind);
      art.className = 'market-art';
      const description = node('div');
      description.append(node('p',item.description));
      if (food) {
        const details = node('p',`${food.category} · ${describeFood(food.effect)}`);
        details.className = 'market-food-effect';
        description.append(details);
      }
      const hasItem = isGear(kind) && owned.some(ownedItem=>ownedItem.kind===kind);
      const buy = button(hasItem ? 'Adquirido' : `Comprar · ${money(price)}`,
        ()=>send({kind:'shop-buy',target:kind,token}));
      buy.disabled = hasItem || wallet<price || full;
      if (full && !hasItem) buy.title = 'Inventário cheio';
      if (!buy.disabled) markShortcut(buy,String(index+1));
      card.append(art,node('h3',item.name),description,buy);
      products.append(card);
    }
    body.replaceChildren(funds,tabs,products);
    const pageCount = Math.ceil(kinds.length/pageSize);
    if (pageCount>1) {
      const paging = node('nav');
      paging.className = 'market-paging';
      paging.setAttribute('aria-label','Páginas do catálogo');
      const previous = button('Anterior',()=>{ page--; renderCatalog(token,wallet,inventory,equipped); });
      const next = button('Próxima',()=>{ page++; renderCatalog(token,wallet,inventory,equipped); });
      previous.disabled = page===0;
      next.disabled = page===pageCount-1;
      if (!previous.disabled) markShortcut(previous,'5');
      if (!next.disabled) markShortcut(next,'6');
      paging.append(previous,node('span',`${page+1} / ${pageCount}`),next);
      body.append(paging);
    }
    if (dialog.open && !prompt.open && !dialog.contains(document.activeElement)) tabs.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
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
        dismissed = false;
        category = 'equipment';
        page = 0;
        last = '';
        feedback.textContent = '';
        if (dialog.open) dialog.close();
        return;
      }
      if (dismissed) {
        if (state.token===token || state.shop) return;
        dismissed = false;
        category = 'equipment';
        page = 0;
      }
      const wallet = view.politics?.wallet ?? 0;
      const equipped = view.gameplay?.equipped ?? [];
      const key = JSON.stringify([state.token,state.options,wallet,inventory,equipped]);
      if (key===last) return;
      last = key;
      token = state.token;
      const npc = npcs[state.npc];
      heading.textContent = state.shop ? npc.label : npc.name;
      if (!dialog.open) dialog.showModal();
      if (!state.shop) {
        const line = node('div');
        line.className = 'market-line';
        line.append(contactFace({id:state.npc,name:npc.name,character:npc.character}),node('p',state.text));
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
      renderCatalog(state.token,wallet,inventory,equipped);
    },
    purchased(item:Pick<WorldItem,'id'|'kind'>) {
      purchase = item;
    },
    feedback(message:string) {
      if (!dialog.open) return false;
      feedback.textContent = message;
      return true;
    },
    destroy() {
      prompt.removeEventListener('close',dismissPurchase);
      purchase = undefined;
      prompt.close();
      yes.onclick = no.onclick = null;
      dialog.removeEventListener('cancel',close);
      dialog.removeEventListener('submit',close);
      dialog.close();
    },
  };
}
