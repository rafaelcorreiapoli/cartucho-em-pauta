import { markShortcut } from './action-shortcuts';
import { equipment, gearKinds } from './equipment';
import { objects, type GameplayAction, type WorldItem } from './gameplay';
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
        last = '';
        feedback.textContent = '';
        if (dialog.open) dialog.close();
        return;
      }
      if (dismissed) {
        if (state.token===token || state.shop) return;
        dismissed = false;
      }
      const wallet = view.politics?.wallet ?? 0;
      const owned = [...inventory,...(view.gameplay?.equipped ?? [])];
      const key = JSON.stringify([state.token,state.options,wallet,owned.map(item=>item.kind)]);
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
      const funds = node('p',money(wallet));
      funds.className = 'market-wallet';
      funds.prepend(glyph('wallet'));
      const products = node('div');
      products.className = 'market-products';
      for (const [index,kind] of gearKinds.entries()) {
        const product = equipment[kind];
        const item = objects[kind];
        const card = node('article');
        const art = itemPortrait(kind);
        art.className = 'market-art';
        art.setAttribute('aria-hidden','true');
        const hasItem = owned.some(ownedItem=>ownedItem.kind===kind);
        const buy = button(hasItem ? 'Adquirido' : `Comprar · ${money(product.price)}`,
          ()=>send({kind:'shop-buy',target:kind,token:state.token}));
        buy.disabled = hasItem || wallet<product.price;
        if (!buy.disabled) markShortcut(buy,String(index+1));
        card.append(art,node('h3',item.name),node('p',item.description),buy);
        products.append(card);
      }
      body.replaceChildren(funds,products);
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
