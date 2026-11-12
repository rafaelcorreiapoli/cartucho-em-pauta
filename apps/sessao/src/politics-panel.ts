import { stations, STATION_RADIUS, type PlenaryView } from './plenary';
import { agendas, CABINET_GRANT, CAMPAIGN_COST, HEARING_POPULARITY, money, splits, type Evidence, type PoliticsAction, type Split } from './politics';
import type { Player } from './map';

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

function updateOptions(select:HTMLSelectElement, options:[string,string][]) {
  if (select.options.length===options.length &&
      options.every(([value,label],i) => select.options[i].value===value && select.options[i].text===label)) return;
  const selected = select.value;
  select.replaceChildren(...options.map(([value,label]) => new Option(label,value)));
  if (options.some(([value]) => value===selected)) select.value = selected;
}

export function createPoliticsPanel(id:string, send:(action:PoliticsAction) => void, focusMap:()=>void) {
  const dock = el<HTMLDetailsElement>('politics-dock');
  const target = el<HTMLSelectElement>('trade-contact');
  const amount = el<HTMLInputElement>('trade-amount');
  const dossier = el<HTMLSelectElement>('evidence');
  const price = el<HTMLInputElement>('evidence-price');
  const nominee = el<HTMLSelectElement>('hearing-target');
  const split = el<HTMLSelectElement>('grant-split');
  const privatePayment = el<HTMLInputElement>('trade-private');
  let view:PlenaryView | undefined;
  let own:Player | undefined;
  let recordsKey = '';
  let offersKey = '';
  dock.open = false;
  amount.value = '1';
  price.value = '0';
  split.value = '0';
  privatePayment.checked = false;
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
    if (!politics || view?.phase!=='negotiation') return;
    el('cabinet-form').hidden = !at('cabinet') || politics.grantUsed || politics.suspended;
    el<HTMLButtonElement>('grant').disabled = view.budget<CABINET_GRANT;
    el('campaign').hidden = !at('press');
    el<HTMLButtonElement>('campaign').disabled = politics.campaigned || politics.wallet<CAMPAIGN_COST;
    el('hearing-form').hidden = !at('panel') || !politics.canCallHearing;
    el<HTMLButtonElement>('publish').disabled = !at('press');
  }

  el<HTMLFormElement>('trade').onsubmit = event => {
    event.preventDefault();
    if (target.value && amount.reportValidity()) send({kind:'transfer',to:target.value,amount:amount.valueAsNumber,clandestine:privatePayment.checked});
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
    if (target.value && dossier.value && price.reportValidity()) {
      send({kind:'share',to:target.value,evidence:Number(dossier.value),price:price.valueAsNumber});
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
  dossier.onchange = describeSelected;

  return {
    render(next:PlenaryView) {
      view = next;
      const p = view.politics;
      dock.hidden = !p;
      if (!p) return;
      const active = view.phase==='negotiation';
      el('personal-stats').textContent = `${money(p.wallet)} · ${p.popularity} pop.${p.incoming.length ? ' · nova oferta' : ''}`;
      el('agenda').textContent = `Agenda secreta: ${agendas[p.agenda]}. ${p.goalMet ? 'Cumprida.' : 'Em andamento.'}`;
      el('politics-actions').hidden = el('evidence-tools').hidden = !active;
      el('politics-hint').textContent = !active ? p.suspended ? 'Mandato cassado. Você continua na sala como assessor.' : '' :
        p.suspended ? 'Você está como assessor: ainda pode negociar, investigar e divulgar provas.' :
        p.contacts.length ? 'Combine pela voz. Transferências não prendem o voto.' :
        `Negocie com quem estiver perto. Campanha na imprensa; cassação no Painel a partir de ${HEARING_POPULARITY} de popularidade.`;
      updateOptions(target,[['',p.contacts.length ? 'Selecione um jogador' : 'Ninguém próximo'],
        ...p.contacts.map(({id,name}):[string,string] => [id,name])]);
      updateOptions(nominee,[['','Selecione um jogador'],...p.directory.filter(contact => contact.id!==id && contact.eligible)
        .map(({id,name,popularity}):[string,string] => [id,`${name} · ${popularity} pop.`])]);
      updateOptions(dossier,p.evidence.map(record => [String(record.id),`Documento ${record.id} · Rodada ${record.round+1}`]));
      amount.max = String(p.wallet);
      el<HTMLButtonElement>('transfer').disabled = !p.contacts.length || p.wallet===0 || p.paymentsLeft===0;
      el<HTMLButtonElement>('transfer').textContent = p.paymentsLeft ? 'Transferir' : 'Limite de pagamentos atingido nesta rodada';
      el<HTMLButtonElement>('share').disabled = !p.contacts.length;
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
      own = players.find(player => player.id===id);
      updateControls();
    },
  };
}
