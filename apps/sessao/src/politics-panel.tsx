import { createRoot } from 'react-dom/client';
import type { CSSProperties } from 'react';
import { canReachStation, type Station, type PlenaryView } from './plenary';
import { CABINET_GRANT, CAMPAIGN_COST, money, splits, type Evidence, type Offer, type PoliticsAction, type Split } from './politics';
import type { Player } from './map';

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

type Choice = {value:string; label:string; portrait?:number};

function picker(id:string, changed:()=>void, empty='') {
  const container = el(id);
  const root = createRoot(container);
  let key = '';
  let choices:Choice[] = [];
  const render = () => root.render(choices.length ? choices.map(choice=>{
    const portrait = choice.portrait===undefined ? undefined : {
      '--portrait-column':choice.portrait%2,'--portrait-row':Math.floor(choice.portrait/2),
    } as CSSProperties;
    return <button type="button" className="hud-button hud-button--secondary game-choice" key={choice.value}
      value={choice.value} aria-pressed={container.dataset.value===choice.value} onClick={()=>{
        container.dataset.value = choice.value;
        render();
        changed();
      }}>
      {portrait && <span className="portrait" style={portrait} aria-hidden="true"/>}{choice.label}
    </button>;
  }) : empty ? <p className="choice-empty">{empty}</p> : null);
  container.dataset.value = '';
  return {
    get value() { return container.dataset.value ?? ''; },
    update(nextChoices:Choice[],selectFirst=false) {
      const next = JSON.stringify(nextChoices);
      if (key===next) return;
      key = next;
      choices = nextChoices;
      if (!choices.some(choice=>choice.value===this.value)) container.dataset.value = selectFirst ? choices[0]?.value ?? '' : '';
      render();
    },
    destroy() { root.unmount(); },
  };
}

function stepper(id:string, initial:number, minimum:number, format:(value:number)=>string) {
  const container = el(id);
  const root = createRoot(container);
  let value = initial;
  let maximum = Number.MAX_SAFE_INTEGER / 10;
  function render() {
    root.render(<>
      <button type="button" className="hud-button hud-button--secondary" aria-label="Diminuir valor"
        disabled={value<=minimum} onClick={()=>{value--;render();}}>−</button>
      <output>{format(value)}</output>
      <button type="button" className="hud-button hud-button--secondary" aria-label="Aumentar valor"
        disabled={value>=maximum} onClick={()=>{value++;render();}}>+</button>
    </>);
  }
  render();
  return {
    get value() { return value; },
    limit(limit:number) {
      const next = Math.max(minimum,Math.floor(limit));
      if (maximum===next) return;
      maximum = next;
      value = Math.min(value,maximum);
      render();
    },
    destroy() { root.unmount(); },
  };
}

export function canBuyEvidence(offer:Pick<Offer,'from'|'price'>, contacts:ReadonlySet<string>, wallet:number, paymentsLeft:number) {
  return contacts.has(offer.from) && wallet>=offer.price && paymentsLeft>0;
}

export function createPoliticsPanel(id:string, send:(action:PoliticsAction) => void, focusMap:()=>void) {
  const dock = el<HTMLDetailsElement>('politics-dock');
  const institutional = el<HTMLDetailsElement>('institutional-dock');
  const recipient = picker('evidence-contact',updateControls,'Ninguém próximo');
  const dossier = picker('evidence',() => { describeSelected(); updateControls(); });
  const price = stepper('evidence-price',0,0,value => value ? money(value) : 'Grátis');
  const nominee = picker('hearing-target',updateControls);
  const split = picker('grant-split',updateControls);
  split.update(splits.map(value => ({value:String(value),label:value ? `Desviar ${money(value)}` : 'Aplicar tudo'})),true);
  let visiblePlayers:Player[] = [];
  let view:PlenaryView | undefined;
  let own:Player | undefined;
  let recordsKey = '';
  let offersKey = '';
  dock.open = false;
  institutional.open = false;
  el<HTMLDetailsElement>('ledger').open = false;
  const recordsRoot = createRoot(el('public-records'));
  const offersRoot = createRoot(el('offer-list'));
  const at = (key:Station) => !!own && canReachStation(own,key);
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
    el<HTMLButtonElement>('share').disabled = !recipient.value || !dossier.value;
    el<HTMLButtonElement>('hearing-confirm').disabled = !nominee.value;
  }

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
    recipient.update(choices);
  }

  return {
    render(next:PlenaryView) {
      view = next;
      const p = view.politics;
      dock.hidden = !p;
      institutional.hidden = !p || view.phase!=='negotiation';
      if (!p) return;
      const active = view.phase==='negotiation' || view.phase==='ballot';
      el('personal-stats').textContent = p.incoming.length ? 'Nova oferta' : '';
      el('politics-actions').hidden = el('evidence-tools').hidden = !active;
      updateContacts();
      nominee.update(p.directory.filter(contact => contact.id!==id && contact.eligible)
        .map(({id,name,popularity}) => ({value:id,label:`${name} · ${popularity} pop.`})));
      dossier.update(p.evidence.map(record => ({value:String(record.id),label:`Documento ${record.id} · Rodada ${record.round+1}`})),true);
      el('evidence-form').hidden = p.evidence.length===0;
      el('empty-evidence').hidden = p.evidence.length>0;
      describeSelected();
      const ledgerKey = p.ledger.map(record => record.id).join(',');
      if (recordsKey!==ledgerKey) {
        recordsKey = ledgerKey;
        recordsRoot.render(p.ledger.slice().reverse().map(record=><li key={record.id}>{describe(record)}</li>));
      }
      const contacts = new Set(p.contacts.map(contact => contact.id));
      const offerList = [...p.incoming,...(p.outgoing ? [p.outgoing] : [])];
      const key = offerList.map(offer => `${offer.id}:${canBuyEvidence(offer,contacts,p.wallet,p.paymentsLeft)}`).join(',');
      if (offersKey!==key) {
        offersKey = key;
        offersRoot.render(offerList.map(offer=>{
          const outgoing = offer.from===id;
          return <div className="offer" key={offer.id}>
            {outgoing ? `Oferta para ${name(offer.to)} · ${money(offer.price)}` : `${name(offer.from)} oferece um documento por ${money(offer.price)}`}
            {!outgoing && <button className="hud-button" type="button" disabled={!canBuyEvidence(offer,contacts,p.wallet,p.paymentsLeft)}
              onClick={()=>send({kind:'accept',offer:offer.id})}>Comprar</button>}
            <button className="hud-button hud-button--secondary" type="button" onClick={()=>send({kind:'cancel',offer:offer.id})}>
              {outgoing ? 'Cancelar' : 'Recusar'}
            </button>
          </div>;
        }));
      }
      updateControls();
    },
    destroy() {
      for (const control of [recipient,dossier,price,nominee,split]) control.destroy();
      recordsRoot.unmount();
      offersRoot.unmount();
    },
    players(players:Player[]) {
      visiblePlayers = players;
      updateContacts();
      own = players.find(player => player.id===id);
      updateControls();
    },
  };
}
