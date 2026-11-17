import {DialogDismiss} from './dialog-dismiss';
import {useRef,useState} from 'react';
import {useDialogKeys} from './use-dialog-keys';
import type {ShortcutEntry} from '../action-shortcuts';
import {PhoneContactFace} from './phone-call';
import type {Motion,Player} from '../map';
import {canReachStation,type PlenaryView} from '../plenary';
import {describeEvidence,money,type Offer,type PoliticsAction} from '../politics';

export function canBuyEvidence(offer:Pick<Offer,'from'|'price'>,contacts:ReadonlySet<string>,wallet:number,paymentsLeft:number) {
  return contacts.has(offer.from) && wallet>=offer.price && paymentsLeft>0;
}

export function canPublishEvidence(view?:PlenaryView,player?:Motion) {
  return !!(view?.phase==='negotiation' && view.politics?.evidence.length && player && canReachStation(player,'press'));
}

export function dossierModel(id:string,view:PlenaryView|undefined,players:readonly Player[]) {
  const politics = view?.politics;
  if (!politics) return;
  const names = new Map(politics.directory.map(({id,name})=>[id,name]));
  const nameOf = (id:string)=>names.get(id) ?? 'Jogador';
  const nearby = new Set(politics.contacts.map(({id})=>id));
  return {
    evidence:politics.evidence.map(record=>({
      id:record.id,label:`Documento ${record.id} · Rodada ${record.round+1}`,detail:describeEvidence(record,nameOf),
    })),
    publicRecords:politics.ledger.slice().reverse().map(record=>({id:record.id,detail:describeEvidence(record,nameOf)})),
    contacts:politics.contacts.flatMap(contact=>{
      const player = players.find(player=>player.id===contact.id);
      return player ? [{...contact,character:player.character}] : [];
    }),
    offers:[...politics.incoming,...(politics.outgoing ? [politics.outgoing] : [])].map(offer=>({
      id:offer.id, outgoing:offer.from===id, price:offer.price,
      name:nameOf(offer.from===id ? offer.to : offer.from),
      canBuy:canBuyEvidence(offer,nearby,politics.wallet,politics.paymentsLeft),
    })),
    trading:view.phase==='negotiation' || view.phase==='ballot',
    publishing:canPublishEvidence(view,players.find(player=>player.id===id)),
  };
}

export function Dossier({model,send,close}:{close?:()=>void;model:NonNullable<ReturnType<typeof dossierModel>>;send:(action:PoliticsAction)=>void}) {
  const [evidence,setEvidence] = useState<number>();
  const [recipient,setRecipient] = useState<string>();
  const [price,setPrice] = useState(0);
  const selected = model.evidence.find(record=>record.id===evidence) ?? model.evidence[0];
  const contact = model.contacts.find(contact=>contact.id===recipient);
  if (recipient!==undefined && !contact) setRecipient(undefined);
  if (evidence!==undefined && selected?.id!==evidence) setEvidence(undefined);
  const ledger = useRef<HTMLDetailsElement>(null);
  const maxPrice = Math.floor(Number.MAX_SAFE_INTEGER/10);
  const adjustPrice = (step:number)=>setPrice(current=>Math.max(0,Math.min(maxPrice,current+step)));
  const share = ()=>{if (contact && selected) send({kind:'share',to:contact.id,evidence:selected.id,price});};
  const publish = ()=>{if (selected && model.publishing) send({kind:'publish',evidence:selected.id});};
  const buy = (offer:number)=>send({kind:'accept',offer});
  const cancel = (offer:number)=>send({kind:'cancel',offer});
  const entries:ShortcutEntry[] = close ? [{name:'Fechar dossiê',activate:close}] : [];
  for (const offer of model.offers) {
    if (!offer.outgoing && offer.canBuy) entries.push({name:`Comprar de ${offer.name}`,activate:()=>buy(offer.id)});
    entries.push({name:offer.outgoing ? `Cancelar oferta para ${offer.name}` : `Recusar oferta de ${offer.name}`,
      activate:()=>cancel(offer.id)});
  }
  for (const record of model.evidence) entries.push({name:record.label,activate:()=>setEvidence(record.id)});
  if (selected && model.trading) {
    for (const person of model.contacts) entries.push({name:`Selecionar ${person.name}`,activate:()=>setRecipient(person.id)});
    if (price>0) entries.push({name:'Diminuir valor',activate:()=>adjustPrice(-1)});
    if (price<maxPrice) entries.push({name:'Aumentar valor',activate:()=>adjustPrice(1)});
    if (contact) entries.push({name:'Enviar a quem está perto',activate:share});
    if (model.publishing) entries.push({name:'Divulgar na imprensa',activate:publish});
  }
  entries.push({name:'Registro público',activate:()=>{if (ledger.current) ledger.current.open = !ledger.current.open;}});
  const offers = useDialogKeys<HTMLElement>(()=>undefined,entries);
  return <>
    <header className="social-header">
      <h2 id="dossier-title">Dossiê</h2>
      {close && <DialogDismiss label="Fechar dossiê" onDismiss={close}/>}
    </header>
    <section ref={offers} aria-label="Ofertas de documentos">
      {model.offers.map(offer=><div className="offer" key={offer.id}>
        {offer.outgoing ? `Oferta para ${offer.name} · ${money(offer.price)}` : `${offer.name} oferece um documento por ${money(offer.price)}`}
        {!offer.outgoing && <button className="hud-button" type="button" disabled={!offer.canBuy}
          onClick={()=>buy(offer.id)}>Comprar</button>}
        <button className="hud-button hud-button--secondary" type="button"
          onClick={()=>cancel(offer.id)}>{offer.outgoing ? 'Cancelar' : 'Recusar'}</button>
      </div>)}
    </section>
    <section aria-label="Provas privadas">
      <h3><svg className="hud-glyph" aria-hidden="true"><use href="#icon-document"/></svg> Provas privadas</h3>
      {selected ? <>
        <div className="choice-grid" role="group" aria-label="Selecionar documento">
          {model.evidence.map(record=><button key={record.id} type="button"
            className="hud-button hud-button--secondary game-choice" aria-pressed={record===selected}
            onClick={()=>setEvidence(record.id)}>{record.label}</button>)}
        </div>
        <p>{selected.detail}</p>
        {model.trading && <div className="evidence-tools">
          <div className="section-label">Compartilhar com</div>
          <div className="choice-grid" role="group" aria-label="Destinatário da prova">
            {model.contacts.length ? model.contacts.map(person=><button key={person.id} type="button"
              className="hud-button hud-button--secondary game-choice" aria-pressed={person===contact}
              onClick={()=>setRecipient(person.id)}>
              <PhoneContactFace person={person}/>{person.name}
            </button>) : <p className="choice-empty">Ninguém próximo</p>}
          </div>
          <div className="game-stepper" role="group" aria-label="Preço da prova">
            <button type="button" className="hud-button hud-button--secondary" aria-label="Diminuir valor"
              disabled={price===0} onClick={()=>adjustPrice(-1)}>−</button>
            <output>{price ? money(price) : 'Grátis'}</output>
            <button type="button" className="hud-button hud-button--secondary" aria-label="Aumentar valor"
              disabled={price>=maxPrice} onClick={()=>adjustPrice(1)}>+</button>
          </div>
          <div className="economy-row">
            <button className="hud-button hud-button--secondary" type="button" disabled={!contact}
              onClick={share}>Enviar a quem está perto</button>
            <button className="hud-button hud-button--secondary" type="button" disabled={!model.publishing}
              onClick={publish}>Divulgar na imprensa</button>
          </div>
        </div>}
      </> : <div className="social-empty">
        <svg className="hud-glyph" aria-hidden="true"><use href="#icon-document"/></svg>
        <strong>Nenhuma prova no dossiê</strong>
        <p>Você pode receber provas de outros jogadores.</p>
      </div>}
    </section>
    <details ref={ledger}>
      <summary>Registro público</summary>
      {model.publicRecords.length ? <ol className="grid gap-2">
        {model.publicRecords.map(record=><li key={record.id}>{record.detail}</li>)}
      </ol> : <p>Nenhum registro público.</p>}
    </details>
  </>;
}
