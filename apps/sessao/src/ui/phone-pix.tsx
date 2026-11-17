import {useState} from 'react';
import {manualTransfer,money,type PoliticsAction,type PoliticsView} from '../politics';
import {PhoneContactFace} from './phone-call';

export function PhonePix({politics,ownId,send}:{politics:PoliticsView;ownId:string;send:(action:PoliticsAction)=>void}) {
  const [recipient,setRecipient] = useState('');
  const [amount,setAmount] = useState(1);
  const recipients = politics.directory.filter(person=>person.id!==ownId && person.pixAvailable);
  const target = recipients.find(person=>person.id===recipient);
  const transfer = manualTransfer(target?.id ?? '',amount,politics.wallet,politics.paymentsLeft);
  return <section className="phone-pix" aria-label="Transferência Pix">
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
        onClick={()=>{if (transfer) send(transfer);}}>{politics.paymentsLeft ? 'Transferir' : 'Limite de pagamentos atingido'} <kbd className="action-key" aria-hidden="true">1</kbd></button>
    </footer>
  </section>;
}
