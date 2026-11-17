import {useDialogKeys} from './ui/use-dialog-keys';
import { DialogDismiss } from './ui/dialog-dismiss';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import type {ParliamentarianDeal} from './parliamentarians';
import {money} from './politics';
import type {PlenaryView, Vote} from './plenary';

export function refreshVoteOffer(amount:number,minimum:number) {
  return minimum===0 ? 0 : Math.max(amount,minimum);
}

type Send = (action:object)=>void;

export function ParliamentarianDealPanel({deal,round,send}:{deal:ParliamentarianDeal;round:number;send:Send}) {
  const [quote,setQuote] = useState<{vote:Vote;amount:number}>();
  let shortcut = 0;
  const actions = new Map<string,()=>void>();
  const panel = useDialogKeys<HTMLDivElement>(key=>actions.get(key));
  const paymentUnavailable = (price:number) => price>0 && (deal.paymentsLeft<=0 || price>deal.wallet);
  function action(label:string,run:()=>void,disabled=false) {
    const key = ++shortcut<=9 ? String(shortcut) : undefined;
    if (key && !disabled) actions.set(key,run);
    return <button key={label} type="button" className="hud-button hud-button--secondary" onClick={run}
      disabled={disabled} aria-keyshortcuts={key}>{label}{key && <kbd className="action-key" aria-hidden="true">{key}</kbd>}</button>;
  }
  const minimum = quote ? deal.minimum[quote.vote] : 0;
  const amount = quote ? refreshVoteOffer(quote.amount,minimum) : 0;
  if (quote && amount!==quote.amount) setQuote({...quote,amount});
  return <>
    <header><h2 id="parliamentarian-title">{deal.name}</h2>
      <DialogDismiss className="hud-button hud-button--secondary">Encerrar</DialogDismiss>
    </header>
    <div className="parliamentarian-options" ref={panel}>
      <p>Carteira · {money(deal.wallet)}{deal.paymentsLeft<=0 && ' · Limite de pagamentos atingido'}</p>
      {deal.documents.map(doc=><div className="grid" key={doc.id}>{action(
        `${doc.title} · ${doc.price ? money(doc.price) : 'Assinatura gratuita'}`,
        ()=>send({kind:'sign',target:deal.id,item:doc.id,amount:doc.price}),paymentUnavailable(doc.price)
      )}</div>)}
      {deal.project ? <><h3>{deal.project}</h3>
      {(['yes','no'] as const).map(vote=>action(vote==='yes' ? 'Negociar voto a favor' : 'Negociar voto contra',
        ()=>setQuote({vote,amount:deal.minimum[vote]}),paymentUnavailable(deal.minimum[vote])))}
      {quote && <>
        <p>{minimum ? `Contraproposta · mínimo de ${money(minimum)}` : 'Aceita sem pagamento.'}</p>
        {minimum>0 && <>
          {action('− R$ 10 mil',()=>setQuote({...quote,amount:amount-1}),amount<=minimum)}
          {action('+ R$ 10 mil',()=>setQuote({...quote,amount:amount+1}),paymentUnavailable(amount+1))}
        </>}
        {action(`Confirmar ${quote.vote==='yes' ? 'a favor' : 'contra'} · ${amount ? money(amount) : 'Grátis'}`,()=>{
          send({kind:'vote',target:deal.id,round,project:deal.projectIndex,vote:quote.vote,amount});
          setQuote(undefined);
        },paymentUnavailable(amount))}
      </>}</> : <p>Nenhum projeto em pauta.</p>}
    </div>
  </>;
}

export function createParliamentarianPanel(send:Send) {
  const dialog = document.querySelector<HTMLDialogElement>('#parliamentarian-dialog')!;
  const root = createRoot(dialog);
  let key = '';
  let opened:number|undefined;
  let dismissed:number|undefined;
  const close = () => {
    if (opened===undefined || dialog.open) return;
    dismissed = opened;
    opened = undefined;
    send({kind:'close',session:dismissed});
  };
  dialog.addEventListener('close',close);
  return {
    update(view:PlenaryView) {
      const deal = view.gameplay?.parliamentarianDeal;
      if (!deal) {
        opened = dismissed = undefined;
        if (key) {
          key = '';
          dialog.close();
          root.render(null);
        }
        return;
      }
      close();
      if (dismissed===deal.session) return;
      const projectKey = JSON.stringify([view.round,deal.projectIndex,deal.session]);
      const next = JSON.stringify([projectKey,deal.name,deal.project,deal.documents,deal.minimum,deal.wallet,deal.paymentsLeft]);
      if (key!==next) {
        key = next;
        flushSync(()=>root.render(<ParliamentarianDealPanel key={projectKey} deal={deal} round={view.round} send={send}/>));
      }
      if (!dialog.open && !document.querySelector('dialog:modal')) dialog.showModal();
      if (dialog.open) opened = deal.session;
    },
    destroy() {
      dialog.removeEventListener('close',close);
      dialog.close();
      root.unmount();
    },
  };
}
