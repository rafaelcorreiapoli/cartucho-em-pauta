import { setCharacterPortrait } from './character-art';
import { stations, STATION_RADIUS, type PlenaryView } from './plenary';
import { CABINET_GRANT, CAMPAIGN_COST, money, splits, type Evidence, type PoliticsAction, type Split } from './politics';
import type { Player } from './map';

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

type Choice = {value:string; label:string; portrait?:number};

function picker(id:string, changed:()=>void, empty='') {
  const container = el(id);
  let key = '';
  const select = (value:string) => {
    container.dataset.value = value;
    for (const button of container.querySelectorAll('button')) {
      button.setAttribute('aria-pressed',String(button.value===value));
    }
  };
  select('');
  return {
    get value() { return container.dataset.value ?? ''; },
    update(choices:Choice[], selectFirst=false) {
      const next = JSON.stringify(choices);
      if (key===next) return;
      key = next;
      const previous = this.value;
      const buttons = choices.map(choice => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hud-button hud-button--secondary game-choice';
        button.value = choice.value;
        if (choice.portrait!==undefined) {
          const portrait = document.createElement('span');
          portrait.className = 'portrait';
          portrait.setAttribute('aria-hidden','true');
          setCharacterPortrait(portrait,choice.portrait);
          button.append(portrait);
        }
        button.append(choice.label);
        button.onclick = () => { select(choice.value); changed(); };
        return button;
      });
      container.replaceChildren(...buttons);
      if (!buttons.length && empty) {
        const message = document.createElement('p');
        message.className = 'choice-empty';
        message.textContent = empty;
        container.append(message);
      }
      select(choices.some(choice => choice.value===previous) ? previous : selectFirst ? choices[0]?.value ?? '' : '');
    },
  };
}

function stepper(id:string, initial:number, minimum:number, format:(value:number)=>string) {
  const container = el(id);
  const amount = document.createElement('output');
  const minus = document.createElement('button');
  const plus = document.createElement('button');
  let value = initial;
  let maximum = Number.MAX_SAFE_INTEGER / 10;
  function render() {
    amount.textContent = format(value);
    minus.disabled = value<=minimum;
    plus.disabled = value>=maximum;
  }
  for (const [button, label, text, delta] of [
    [minus,'Diminuir valor','−',-1],[plus,'Aumentar valor','+',1],
  ] as const) {
    button.type = 'button';
    button.className = 'hud-button hud-button--secondary';
    button.textContent = text;
    button.setAttribute('aria-label',label);
    button.onclick = () => { value += delta; render(); };
  }
  container.replaceChildren(minus,amount,plus);
  render();
  return {
    get value() { return value; },
    limit(limit:number) {
      maximum = Math.max(minimum,limit);
      value = Math.min(value,maximum);
      render();
    },
  };
}

export function createPoliticsPanel(id:string, send:(action:PoliticsAction) => void, focusMap:()=>void) {
  const dock = el<HTMLDetailsElement>('politics-dock');
  const trade = el<HTMLDetailsElement>('trade-dock');
  const target = picker('trade-contact',updateControls);
  const recipient = picker('evidence-contact',updateControls,'Ninguém próximo');
  const amount = stepper('trade-amount',1,1,money);
  const dossier = picker('evidence',() => { describeSelected(); updateControls(); });
  const price = stepper('evidence-price',0,0,value => value ? money(value) : 'Grátis');
  const nominee = picker('hearing-target',updateControls);
  const split = picker('grant-split',updateControls);
  const privacy = picker('trade-private',updateControls);
  split.update(splits.map(value => ({value:String(value),label:value ? `Desviar ${money(value)}` : 'Aplicar tudo'})),true);
  privacy.update([{value:'public',label:'Pública'},{value:'private',label:'Clandestina'}],true);
  let visiblePlayers:Player[] = [];
  let view:PlenaryView | undefined;
  let own:Player | undefined;
  let recordsKey = '';
  let offersKey = '';
  dock.open = false;
  trade.open = false;
  el<HTMLDetailsElement>('ledger').open = false;
  el('public-records').replaceChildren();
  el('offer-list').replaceChildren();
  const at = (key:keyof typeof stations) => !!own && Math.hypot(own.x-stations[key].x,own.y-stations[key].y)<=STATION_RADIUS;
  const name = (id:string) => view?.politics?.directory.find(contact => contact.id===id)?.name ?? 'Jogador';
  const describe = (record:Evidence) => record.kind==='diversion' ?
    `${name(record.from)} desviou ${money(record.amount)} da verba do gabinete.` :
    `${name(record.from)} → ${name(record.to!)} · ${money(record.amount)} · pagamento ${record.kind==='public-transfer' ? 'público' : 'clandestino'}.`;

  function updateControls() {
    const politics = view?.politics;
    if (!politics || !view) return;
    const exploring = view.phase==='negotiation';
    el('cabinet-form').hidden = !exploring || !at('cabinet') || !view.mandate || politics.grantUsed || politics.suspended;
    el<HTMLButtonElement>('grant').disabled = view.budget<CABINET_GRANT;
    el('campaign').hidden = !exploring || !at('press');
    el<HTMLButtonElement>('campaign').disabled = politics.campaigned || politics.wallet<CAMPAIGN_COST;
    el('hearing-form').hidden = !exploring || !at('panel') || !politics.canCallHearing;
    el<HTMLButtonElement>('publish').disabled = !exploring || !at('press') || !dossier.value;
    el('trade-controls').hidden = !target.value;
    el<HTMLButtonElement>('transfer').disabled = !target.value || politics.wallet===0 || politics.paymentsLeft===0;
    el<HTMLButtonElement>('share').disabled = !recipient.value || !dossier.value;
    el<HTMLButtonElement>('hearing-confirm').disabled = !nominee.value;
  }

  el<HTMLFormElement>('trade').onsubmit = event => {
    event.preventDefault();
    if (target.value) send({kind:'transfer',to:target.value,amount:amount.value,clandestine:privacy.value==='private'});
  };
  el<HTMLFormElement>('cabinet-form').onsubmit = event => {
    event.preventDefault();
    const diverted = Number(split.value) as Split;
    if (splits.includes(diverted)) {
      send({kind:'grant',diverted});
      focusMap();
    }
  };
  el<HTMLFormElement>('hearing-form').onsubmit = event => {
    event.preventDefault();
    if (nominee.value) send({kind:'hearing',target:nominee.value});
  };
  el<HTMLButtonElement>('campaign').onclick = () => send({kind:'campaign'});
  el<HTMLButtonElement>('share').onclick = () => {
    if (recipient.value && dossier.value) {
      send({kind:'share',to:recipient.value,evidence:Number(dossier.value),price:price.value});
    }
  };
  el<HTMLButtonElement>('publish').onclick = () => {
    if (dossier.value) send({kind:'publish',evidence:Number(dossier.value)});
  };
  el<HTMLFormElement>('evidence-form').onsubmit = event => event.preventDefault();
  const describeSelected = () => {
    const record = view?.politics?.evidence.find(record => record.id===Number(dossier.value));
    el('evidence-detail').textContent = record ? describe(record) : '';
  };
  function updateContacts() {
    const choices = (view?.politics?.contacts ?? []).flatMap(contact => {
      const player = visiblePlayers.find(player => player.id===contact.id);
      return player ? [{value:contact.id,label:contact.name,portrait:player.character}] : [];
    });
    target.update(choices);
    el('trade-empty').hidden = choices.length>0;
    el('trade-recipients').hidden = choices.length===0;
    recipient.update(choices);
  }

  return {
    render(next:PlenaryView) {
      view = next;
      const p = view.politics;
      dock.hidden = !p;
      trade.hidden = !p || (view.phase!=='negotiation' && view.phase!=='ballot');
      if (!p) return;
      const active = view.phase==='negotiation' || view.phase==='ballot';
      el('personal-stats').textContent = p.incoming.length ? 'Nova oferta' : '';
      el('politics-actions').hidden = el('evidence-tools').hidden = !active;
      el('trade-balance').textContent = money(p.wallet);
      updateContacts();
      nominee.update(p.directory.filter(contact => contact.id!==id && contact.eligible)
        .map(({id,name,popularity}) => ({value:id,label:`${name} · ${popularity} pop.`})));
      dossier.update(p.evidence.map(record => ({value:String(record.id),label:`Documento ${record.id} · Rodada ${record.round+1}`})),true);
      amount.limit(p.wallet);
      el<HTMLButtonElement>('transfer').textContent = p.paymentsLeft ? 'Transferir' : 'Limite de pagamentos atingido nesta rodada';
      el('evidence-form').hidden = p.evidence.length===0;
      el('empty-evidence').hidden = p.evidence.length>0;
      describeSelected();
      const ledgerKey = p.ledger.map(record => record.id).join(',');
      if (recordsKey!==ledgerKey) {
        recordsKey = ledgerKey;
        el('public-records').replaceChildren(...p.ledger.slice().reverse().map(record => {
          const item = document.createElement('li');
          item.textContent = describe(record);
          return item;
        }));
      }
      const contacts = new Set(p.contacts.map(contact => contact.id));
      const offerList = [...p.incoming,...(p.outgoing ? [p.outgoing] : [])];
      const key = offerList.map(offer => `${offer.id}:${contacts.has(offer.from) && p.wallet>=offer.price && p.paymentsLeft>0}`).join(',');
      if (offersKey!==key) {
        offersKey = key;
        el('offer-list').replaceChildren(...offerList.map(offer => {
          const block = document.createElement('div');
          block.className = 'offer';
          const outgoing = offer.from===id;
          block.textContent = outgoing ? `Oferta para ${name(offer.to)} · ${money(offer.price)}` :
            `${name(offer.from)} oferece um documento por ${money(offer.price)}`;
          const cancel = document.createElement('button');
          cancel.className = 'hud-button hud-button--secondary';
          cancel.textContent = outgoing ? 'Cancelar' : 'Recusar';
          cancel.onclick = () => send({kind:'cancel',offer:offer.id});
          if (!outgoing) {
            const accept = document.createElement('button');
            accept.className = 'hud-button';
            accept.textContent = 'Comprar';
            accept.disabled = !contacts.has(offer.from) || p.wallet<offer.price || p.paymentsLeft===0;
            accept.onclick = () => send({kind:'accept',offer:offer.id});
            block.append(accept);
          }
          block.append(cancel);
          return block;
        }));
      }
      updateControls();
    },
    players(players:Player[]) {
      visiblePlayers = players;
      updateContacts();
      own = players.find(player => player.id===id);
      updateControls();
    },
  };
}
