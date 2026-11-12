import { equipment, gearKinds } from './equipment';
import { objects, type GameplayAction } from './gameplay';
import { button, contactFace, glyph, node } from './gameplay-ui';
import { npcs } from './npcs';
import type { PlenaryView } from './plenary';
import { money } from './politics';

export function createMarketPanel(send:(action:GameplayAction)=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#market-dialog')!;
  const heading = dialog.querySelector('h2')!;
  const body = dialog.querySelector<HTMLElement>('#market-body')!;
  const feedback = dialog.querySelector<HTMLElement>('#market-feedback')!;
  let token:number|undefined;
  let dismissed = false;
  let last = '';
  const close = () => {
    if (token===undefined || dismissed) return;
    dismissed = true;
    send({kind:'dialogue-close'});
  };
  dialog.addEventListener('close',close);

  return {
    render(view:PlenaryView) {
      const state = view.phase==='negotiation' ? view.gameplay?.dialogue : undefined;
      if (!state) {
        token = undefined;
        dismissed = false;
        last = '';
        feedback.textContent = '';
        if (dialog.open) dialog.close();
        return;
      }
      if (dismissed || (token!==undefined && !dialog.open)) return;
      const wallet = view.politics?.wallet ?? 0;
      const owned = [...(view.gameplay?.inventory ?? []),...(view.gameplay?.equipped ?? [])];
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
        for (const option of state.options) {
          const choice = button(option.label,()=>send({kind:'dialogue-choice',target:option.id,token:state.token}));
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
      for (const kind of gearKinds) {
        const product = equipment[kind];
        const item = objects[kind];
        const card = node('article');
        const art = node('span',product.symbol);
        art.className = 'market-art';
        art.setAttribute('aria-hidden','true');
        const hasItem = owned.some(ownedItem=>ownedItem.kind===kind);
        const buy = button(hasItem ? 'Adquirido' : `Comprar · ${money(product.price)}`,
          ()=>send({kind:'shop-buy',target:kind,token:state.token}));
        buy.disabled = hasItem || wallet<product.price;
        card.append(art,node('h3',item.name),node('p',item.description),buy);
        products.append(card);
      }
      body.replaceChildren(funds,products);
    },
    feedback(message:string) {
      if (!dialog.open) return false;
      feedback.textContent = message;
      return true;
    },
    destroy() {
      dialog.removeEventListener('close',close);
      dialog.close();
    },
  };
}
