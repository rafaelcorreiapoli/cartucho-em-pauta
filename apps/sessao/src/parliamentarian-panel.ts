import { button, node } from './gameplay-ui';
import { markShortcut } from './action-shortcuts';
import type { ParliamentarianDeal } from './parliamentarians';
import { money } from './politics';
import type { PlenaryView, Vote } from './plenary';

export function createParliamentarianPanel(send:(action:object)=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#parliamentarian-dialog')!;
  const title = dialog.querySelector('h2')!;
  const body = dialog.querySelector<HTMLElement>('.parliamentarian-options')!;
  let key = '';
  let dismissed = false;
  let quote: {vote:Vote;amount:number}|undefined;
  const close = () => { dismissed = true; quote = undefined; send({kind:'close'}); };
  dialog.addEventListener('close',close);

  function render(deal:ParliamentarianDeal,round:number) {
    title.textContent = deal.name;
    const wallet = node('p',`Carteira · ${money(deal.wallet)}`);
    const options = deal.documents.map(doc=>{
      const sign = button(`${doc.title} · ${doc.price ? money(doc.price) : 'Assinatura gratuita'}`,()=>{
        send({kind:'sign',target:deal.id,item:doc.id,amount:doc.price});
      });
      sign.disabled = doc.price>deal.wallet;
      return sign;
    });
    const heading = node('h3',deal.project);
    const votes = (['yes','no'] as const).map(vote=>button(vote==='yes' ? 'Negociar voto a favor' : 'Negociar voto contra',()=>{
      quote = {vote,amount:deal.minimum[vote]};
      render(deal,round);
    }));
    const controls = [...options,...votes];
    const summary = node('p');
    if (quote) {
      const minimum = deal.minimum[quote.vote];
      quote.amount = Math.max(quote.amount,minimum);
      const offer = quote;
      summary.textContent = minimum ? `Contraproposta · mínimo de ${money(minimum)}` : 'Aceita sem pagamento.';
      if (minimum) {
        const less = button('− R$ 10 mil',()=>{offer.amount--;render(deal,round);});
        const more = button('+ R$ 10 mil',()=>{offer.amount++;render(deal,round);});
        less.disabled = offer.amount<=minimum;
        more.disabled = offer.amount>=deal.wallet;
        controls.push(less,more);
      }
      const commit = button(`Confirmar ${offer.vote==='yes' ? 'a favor' : 'contra'} · ${offer.amount ? money(offer.amount) : 'Grátis'}`,()=>{
        send({kind:'vote',target:deal.id,round,vote:offer.vote,amount:offer.amount});
        quote = undefined;
        render(deal,round);
      });
      commit.disabled = offer.amount>deal.wallet;
      controls.push(commit);
    }
    controls.forEach((control,index)=>{if (index<9) markShortcut(control,String(index+1));});
    body.replaceChildren(wallet,...options,heading,...votes,summary,...controls.slice(options.length+votes.length));
  }

  return {
    update(view:PlenaryView) {
      const deal = view.gameplay?.parliamentarianDeal;
      if (!deal) {
        dismissed = false;
        quote = undefined;
        key = '';
        if (dialog.open) dialog.close();
        return;
      }
      if (dismissed) return;
      const next = JSON.stringify([view.round,deal.id,deal.documents,deal.minimum,deal.wallet]);
      if (key!==next) { key = next; render(deal,view.round); }
      if (!dialog.open && !document.querySelector('dialog:modal')) dialog.showModal();
    },
    destroy() { dialog.removeEventListener('close',close); dialog.close(); },
  };
}
