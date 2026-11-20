import {isSpyProduct} from './surveillance';
import {investmentRules} from './public-investments';
import type {ShortcutEntry} from './action-shortcuts';
import {isEditingText} from './game-keys';
import {DialogHeader} from './ui/dialog-header';
import type { ReactNode } from 'react';
import { equipmentCategories, equipmentCategoryKinds, type EquipmentCategory, decorationProductEnabled, isCredentialGood, marketKinds, marketProduct, marketPurchaseSlot } from './market-catalog';
import { isOfficeFurniture, type OfficeFurniture } from './private-offices';
import { EquipmentReplacement } from './ui/equipment-replacement';
import { describeFood, foodDefinition, isFood } from './food';
import { gearConflict, isGear } from './equipment';
import { objects, type GameplayAction, type WorldItem } from './gameplay';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { npcs, type NpcId } from './npcs';
import type { BillPolicies, PlenaryView } from './plenary';
import { money } from './politics';

function marketVendorPortrait(npc:NpcId) {
  const vendor = npcs[npc];
  return 'portrait' in vendor ? vendor.portrait : vendor.sprite;
}

export function MarketDialogContent({title,children}:{title:string;children:ReactNode}) {
  return <>
    <DialogHeader id="market-title" title={title} dismissLabel="Fechar"/>
    <div id="market-body">{children}</div>
  </>;
}

export function createMarketPanel(send:(action:GameplayAction)=>void,requestDocument:()=>void,playChoice:()=>void=()=>{}) {
  const dialog = document.querySelector<HTMLDialogElement>('#market-dialog')!;
  const root = createRoot(dialog);
  const prompt = document.querySelector<HTMLDialogElement>('#equip-purchase-dialog')!;
  const promptRoot = createRoot(prompt);
  let replacement:number|undefined;
  let purchase:Pick<WorldItem,'id'|'kind'>|undefined;
  const marketKeys = new Map<string,ShortcutEntry>();
  const replacementKeys = new Map<string,ShortcutEntry>();
  const dismissPurchase = () => {
    purchase = undefined;
    replacement = undefined;
    replacementKeys.clear();
  };
  prompt.addEventListener('close',dismissPurchase);
  const pageSize = 9;
  let category:EquipmentCategory = 'equipment';
  let page = 0;
  let selected = 0;
  let token:number|undefined;
  let currentVendor:NpcId|undefined;
  let dismissed = false;
  let last = '';
  let infiltrator = false;
  let projectsEnabled = true;
  let surveillanceEnabled = true;
  let decorationsEnabled = true;
  let portraitsAndVipEnabled = true;
  const close = () => {
    if (token===undefined || dismissed) return;
    dismissed = true;
    playChoice();
    send({kind:'dialogue-close'});
  };
  dialog.addEventListener('cancel',close);
  dialog.addEventListener('submit',close);
  function runShortcut(event:KeyboardEvent,keys:Map<string,ShortcutEntry>) {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey ||
        event.metaKey || event.shiftKey || isEditingText(event.target)) return;
    if (event.repeat && event.key!=='ArrowLeft' && event.key!=='ArrowRight') return;
    const activate = keys.get(event.key)?.activate;
    if (!activate) return;
    event.preventDefault();
    activate();
  }
  const onMarketKey = (event:KeyboardEvent)=>runShortcut(event,marketKeys);
  const onReplacementKey = (event:KeyboardEvent)=>runShortcut(event,replacementKeys);
  dialog.addEventListener('keydown',onMarketKey);
  prompt.addEventListener('keydown',onReplacementKey);

  function renderCatalog(npc:NpcId,token:number,wallet:number,inventory:readonly WorldItem[],equipped:readonly WorldItem[], furnishings:readonly OfficeFurniture[], policies:BillPolicies|undefined, budget:number,direct:boolean,suppliesSeconds?:number) {
    const catalog = npcs[npc].catalog;
    if (!catalog) return;
    const kinds = (catalog==='equipment' ? equipmentCategoryKinds(category) : marketKinds[catalog]).filter(kind=>(kind!=='ghostAdviser' || infiltrator) && (projectsEnabled || kind!=='forensicKit') && (surveillanceEnabled || !isSpyProduct(kind)) && decorationProductEnabled(kind,decorationsEnabled,portraitsAndVipEnabled));
    const owned = [...inventory,...equipped];
    const visible = kinds.slice(page*pageSize,(page+1)*pageSize);
    const pageCount = Math.ceil(kinds.length/pageSize);
    const goTo = (next:number) => {
      if (next===page || next<0 || next>=pageCount) return;
      page = next;
      selected = 0;
      renderCatalog(npc,token,wallet,inventory,equipped,furnishings,policies,budget,direct,suppliesSeconds);
    };
    const stock = visible.map(kind=>{
      const item = objects[kind];
      const price = marketProduct(catalog,kind,policies,budget)!.price;
      const furniture = isOfficeFurniture(kind);
      const hasItem = furniture ? furnishings.includes(kind) : (isCredentialGood(kind) || isGear(kind)) && owned.some(entry=>entry.kind===kind);
      const noSpace = !marketPurchaseSlot(kind,inventory,equipped,direct);
      const status = hasItem ? (furniture ? 'Instalado' : 'Adquirido') : noSpace ? 'Inventário cheio' :
        wallet<price ? 'Saldo insuficiente' : undefined;
      return {kind,item,price,status,hasItem};
    });
    const product = stock[selected];
    const select = (index:number) => {
      selected = index;
      renderCatalog(npc,token,wallet,inventory,equipped,furnishings,policies,budget,direct,suppliesSeconds);
    };
    const changeCategory = (key:EquipmentCategory) => {
      category = key;
      page = 0;
      selected = 0;
      renderCatalog(npc,token,wallet,inventory,equipped,furnishings,policies,budget,direct,suppliesSeconds);
    };
    const buy = () => {
      if (product && !product.status) send({kind:'shop-buy',target:product.kind,token});
    };
    const previousPage = ()=>goTo(page-1);
    const nextPage = ()=>goTo(page+1);
    marketKeys.clear();
    if (catalog==='equipment') for (const [key,{label}] of Object.entries(equipmentCategories)) {
      marketKeys.set('category:'+key,{name:label,activate:()=>changeCategory(key as EquipmentCategory)});
    }
    stock.forEach(({item,price},index)=>marketKeys.set(String(index+1),{name:item.name+' · '+money(price),activate:()=>select(index)}));
    if (product && !product.status) marketKeys.set('Enter',{name:'Comprar',activate:buy});
    if (page>0) marketKeys.set('ArrowLeft',{name:'Página anterior',activate:previousPage});
    for (let index=0;index<pageCount;index++) {
      marketKeys.set('page:'+index,{name:'Página '+(index+1),activate:()=>goTo(index)});
    }
    if (page<pageCount-1) marketKeys.set('ArrowRight',{name:'Próxima página',activate:nextPage});
    const food = product && isFood(product.kind) ? foodDefinition(product.kind) : undefined;
    const vendor = npcs[npc];
    flushSync(()=>root.render(<MarketDialogContent title={vendor.label}>
      <div className="market-toolbar">
        <div className="market-vendor">
          <img src={import.meta.env.BASE_URL+'assets/'+marketVendorPortrait(npc)} alt=""/>
          <div><h2 id="market-catalog-title">{vendor.label}</h2><strong>{vendor.name}</strong><p>{vendor.catalog==='equipment' ? 'Equipamentos, espionagem e utilidades parlamentares.' :
            vendor.catalog==='furniture' ? 'Móveis instalados no seu gabinete.' :
            vendor.catalog==='credentials' ? 'Retratos oficiais e placas para reservar cadeiras.' : 'Lanches e bebidas.'}</p></div>
        </div>
        <p className="market-wallet tabular-nums"><svg className="hud-glyph" aria-hidden="true"><use href="#icon-wallet"/></svg>{money(wallet)}</p>
      </div>
      {catalog==='food' && suppliesSeconds!==undefined && <p className="market-supplies">
        Abastecimento · {investmentRules.suppliesDiscount}% de desconto por mais {suppliesSeconds} s
      </p>}
      {catalog==='equipment' ? <nav className="market-categories" aria-label="Categorias da loja">
        {Object.entries(equipmentCategories).map(([key,{label}])=><button key={key} type="button" aria-pressed={key===category}
          onClick={()=>changeCategory(key as EquipmentCategory)}>{label}</button>)}
      </nav> : <div className="market-catalog-label"><span><svg className="hud-glyph" aria-hidden="true"><use href="#icon-inventory"/></svg>Comprar</span></div>}
      <div className="market-catalog-layout">
        <div className="market-products" aria-label="Produtos">
          {stock.map(({kind,item,price,hasItem,status},index)=><button type="button" className="market-product-button item-tile"
            key={kind} aria-pressed={selected===index} aria-label={item.name+' · '+money(price)} aria-keyshortcuts={String(index+1)}
            onClick={()=>select(index)}>
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
            onClick={buy}>
            <span><svg className="hud-glyph" aria-hidden="true"><use href="#icon-inventory"/></svg>{product.status ?? 'Comprar'}</span>
            <kbd className="action-key" aria-hidden="true">Enter</kbd>
          </button>
        </section>}
      </div>
      <nav className="market-paging" aria-label="Páginas do catálogo">
        <button type="button" className="market-page-arrow" aria-label="Página anterior" aria-keyshortcuts="ArrowLeft"
          disabled={page===0} onClick={previousPage}>‹</button>
        <div className="market-page-dots">
          {Array.from({length:pageCount},(_,index)=><button type="button" className="market-page-dot" key={index}
            aria-label={'Página '+(index+1)} aria-current={index===page ? 'page' : undefined} onClick={()=>goTo(index)}/>)}
        </div>
        <button type="button" className="market-page-arrow" aria-label="Próxima página" aria-keyshortcuts="ArrowRight"
          disabled={page===pageCount-1} onClick={nextPage}>›</button>
      </nav>
    </MarketDialogContent>));
    if (dialog.open && !prompt.open && !dialog.contains(document.activeElement)) {
      dialog.querySelector<HTMLButtonElement>('header button')?.focus({preventScroll:true});
    }
  }

  return {
    shortcuts(scope:HTMLElement):ShortcutEntry[]|undefined {
      const entries = scope===dialog ? marketKeys : scope===prompt ? replacementKeys : undefined;
      if (!entries) return;
      const actions = [...entries].map(([key,entry])=>({name:entry.name,activate:()=>{
        if (scope instanceof HTMLDialogElement && scope.open && entries.get(key)===entry) entry.activate();
      }}));
      if (scope===dialog) actions.unshift({name:'Fechar',activate:()=>{ if (dialog.open) { close(); dialog.close(); } }});
      return actions;
    },
    render(view:PlenaryView) {
      infiltrator = view.role==='Infiltrado';
      projectsEnabled = view.projectVotingEnabled!==false;
      surveillanceEnabled = view.surveillanceEnabled!==false;
      decorationsEnabled = view.decorationsEnabled!==false;
      portraitsAndVipEnabled = view.portraitsAndVipEnabled!==false;
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
        const {id:item,kind} = purchase;
        const confirm = () => {
          prompt.close();
          send({kind:'replace-gear',item,token:conflict.id});
        };
        const cancel = ()=>prompt.close();
        replacementKeys.set('1',{name:'Sim',activate:confirm});
        replacementKeys.set('2',{name:'Não',activate:cancel});
        flushSync(()=>promptRoot.render(<EquipmentReplacement equipped={objects[conflict.kind].name} purchased={objects[kind].name}
          confirm={confirm} cancel={cancel}/>));
        prompt.showModal();
        prompt.querySelector<HTMLButtonElement>('#equip-purchase-no')?.focus();
      }
      const state = view.phase==='negotiation' ? view.gameplay?.dialogue : undefined;
      if (!state) {
        marketKeys.clear();
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
      const {policies,budget} = view;
      const suppliesSeconds = npcs[state.npc].catalog==='food' ? view.suppliesSeconds : undefined;
      const furnishings = view.gameplay?.officeFurnishings ?? [];
      if (currentVendor!==state.npc) { category = 'equipment'; page = 0; selected = 0; }
      currentVendor = state.npc;
      const key = JSON.stringify([state.npc,state.token,state.shop,state.direct,state.text,state.feedback,state.options,infiltrator,projectsEnabled,surveillanceEnabled,decorationsEnabled,portraitsAndVipEnabled,wallet,inventory,equipped,furnishings,policies,budget,suppliesSeconds]);
      if (key===last) return;
      last = key;
      token = state.token;
      const npc = npcs[state.npc];
      dialog.classList.toggle('market-catalog',state.shop);
      dialog.setAttribute('aria-labelledby',state.shop ? 'market-catalog-title' : 'market-title');
      if (!state.shop) {
        const choices = state.options.map(option=>({...option,activate:()=>{
          playChoice();
          if (state.npc==='secretary' && option.id==='projects') return requestDocument();
          send({kind:'dialogue-choice',target:option.id,token:state.token});
        }}));
        marketKeys.clear();
        choices.forEach((choice,index)=>marketKeys.set(String(index+1),{name:choice.label,activate:choice.activate}));
        flushSync(()=>root.render(<MarketDialogContent title={npc.catalog ? npc.name : `${npc.label} · ${npc.name}`}>
          <div className="market-line">
            <img className="phone-contact-face market-npc-face" src={import.meta.env.BASE_URL+'assets/'+npc.sprite} alt=""/>
            <p>{state.text}</p>
          </div>
          {state.feedback && <p role="status">{state.feedback}</p>}
          <div className="market-choices">
            {choices.map((option,index)=><button key={option.id} type="button" className="hud-button hud-button--secondary"
              aria-keyshortcuts={String(index+1)} onClick={option.activate}>
              {option.label}<kbd className="action-key" aria-hidden="true">{index+1}</kbd>
            </button>)}
          </div>
        </MarketDialogContent>));
        if (!dialog.open) dialog.showModal();
        dialog.querySelector<HTMLButtonElement>('.market-choices button')?.focus();
        return;
      }
      renderCatalog(state.npc,state.token,wallet,inventory,equipped,furnishings,policies,budget,state.direct!==false,suppliesSeconds);
      if (!dialog.open) dialog.showModal();
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
      promptRoot.unmount();
      dialog.removeEventListener('cancel',close);
      dialog.removeEventListener('submit',close);
      dialog.removeEventListener('keydown',onMarketKey);
      prompt.removeEventListener('keydown',onReplacementKey);
      dialog.close();
    },
  };
}
