import {useEffect,useEffectEvent,useRef,useState} from 'react';
import {isEditingText} from '../game-keys';
import {manualTransfer,money,type PoliticsAction,type PoliticsView} from '../politics';
import {PhoneContactFace} from './phone-call';

export function PhonePix({politics,ownId,send}:{politics:PoliticsView;ownId:string;send:(action:PoliticsAction)=>void}) {
  const panel = useRef<HTMLElement>(null);
  const [recipient,setRecipient] = useState('');
  const [amount,setAmount] = useState(1);
  const recipients = politics.directory.filter(person=>person.id!==ownId && person.pixAvailable);
  const target = recipients.find(person=>person.id===recipient);
  const transfer = manualTransfer(target?.id ?? '',amount,politics.wallet,politics.paymentsLeft);
  const submit = ()=>{ if (transfer) send(transfer); };
  const submitFromKey = useEffectEvent(submit);
  useEffect(()=>{
    function keydown(event:KeyboardEvent) {
      if (event.key!=='1' || event.defaultPrevented || event.repeat || event.isComposing ||
          event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || isEditingText(event.target)) return;
      const dialog = panel.current?.closest('dialog:modal');
      if (!dialog) return;
      const active = document.activeElement?.closest('dialog:modal');
      if (active ? active!==dialog : document.querySelector('dialog:modal:not(#gameplay-dialog)')) return;
      event.preventDefault();
      submitFromKey();
    }
    document.addEventListener('keydown',keydown,true);
    return ()=>document.removeEventListener('keydown',keydown,true);
  },[]);
  return <section ref={panel} className="phone-pix" aria-label="Transferência Pix">
    <div className="pix-balance"><small>Saldo disponível</small><strong>{money(politics.wallet)}</strong></div>
    <h4>Para quem?</h4>
    {recipients.length===0 && <p>Nenhum destinatário disponível.</p>}
    <div className="phone-contacts">
      {recipients.map(person=><button className="phone-contact" type="button" key={person.id}
          aria-pressed={target?.id===person.id} onClick={()=>setRecipient(person.id)}>
        <PhoneContactFace person={person}/><strong>{person.name}</strong>
      </button>)}
    </div>
    <footer>
      <div className="pix-amount" aria-label="Valor da transferência">
        <button type="button" className="hud-icon-button" aria-label="Diminuir valor" disabled={amount<=1} onClick={()=>setAmount(amount-1)}>−</button>
        <output>{money(amount)}</output>
        <button type="button" className="hud-icon-button" aria-label="Aumentar valor" disabled={amount+1>politics.wallet} onClick={()=>setAmount(amount+1)}>+</button>
      </div>
      <button type="button" className="hud-button" aria-keyshortcuts="1" disabled={!transfer}
        onClick={submit}>{politics.paymentsLeft ? 'Transferir' : 'Limite de pagamentos atingido'} <kbd className="action-key" aria-hidden="true">1</kbd></button>
    </footer>
  </section>;
}
