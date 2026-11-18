import type {ShortcutEntry} from '../action-shortcuts';
import {useState} from 'react';
import {useDialogKeys} from './use-dialog-keys';
import {manualTransfer,money,type PoliticsAction,type PoliticsView} from '../politics';
import {PhoneContactFace} from './phone-call';

export function PhonePix({politics,ownId,send,close}:{politics:PoliticsView;ownId:string;send:(action:PoliticsAction)=>void;close?:()=>void}) {
  const [recipient,setRecipient] = useState('');
  const [amount,setAmount] = useState(1);
  const recipients = politics.directory.filter(person=>person.id!==ownId && person.pixAvailable);
  const target = recipients.find(person=>person.id===recipient);
  const transfer = manualTransfer(target?.id ?? '',amount,politics.wallet,politics.paymentsLeft);
  const submit = ()=>{ if (transfer) send(transfer); };
  const decrease = amount>1 ? ()=>setAmount(amount-1) : undefined;
  const increase = amount+1<=politics.wallet ? ()=>setAmount(amount+1) : undefined;
  const options = recipients.map((person,index)=>({
    person,choose:()=>setRecipient(person.id),shortcut:index<8 ? String(index+2) : undefined,
  }));
  const entries:ShortcutEntry[] = options.map(({person,choose})=>({name:person.name,activate:choose}));
  if (close) entries.unshift({name:'Fechar aplicativo',activate:close});
  if (decrease) entries.push({name:'Diminuir valor',activate:decrease});
  if (increase) entries.push({name:'Aumentar valor',activate:increase});
  if (transfer) entries.push({name:'Transferir',activate:submit});
  const panel = useDialogKeys(key=>{
    if (key==='1') return transfer ? submit : undefined;
    if (key==='ArrowLeft') return decrease;
    if (key==='ArrowRight') return increase;
    return options.find(option=>option.shortcut===key)?.choose;
  },entries);
  return <section ref={panel} className="phone-pix" aria-label="Transferência Pix">
    <div className="pix-balance"><small>Saldo disponível</small><strong>{money(politics.wallet)}</strong></div>
    <h4>Para quem?</h4>
    {recipients.length===0 && <p>Nenhum destinatário disponível.</p>}
    {options.length>0 && <ul className="phone-contacts" aria-label="Contatos para Pix">
      {options.map(({person,choose,shortcut})=><li key={person.id}>
        <button className="phone-contact" type="button"
          aria-pressed={target?.id===person.id} aria-keyshortcuts={shortcut} onClick={choose}>
          <PhoneContactFace person={person}/><strong>{person.name}</strong>
          {shortcut && <kbd className="action-key" aria-hidden="true">{shortcut}</kbd>}
        </button>
      </li>)}
    </ul>}
    <footer>
      <div className="pix-amount" aria-label="Valor da transferência">
        <button type="button" className="hud-icon-button" aria-label="Diminuir valor" aria-keyshortcuts="ArrowLeft" disabled={!decrease} onClick={decrease}>−</button>
        <output>{money(amount)}</output>
        <button type="button" className="hud-icon-button" aria-label="Aumentar valor" aria-keyshortcuts="ArrowRight" disabled={!increase} onClick={increase}>+</button>
      </div>
      <button type="button" className="hud-button" aria-keyshortcuts="1" disabled={!transfer}
        onClick={submit}>{politics.paymentsLeft ? 'Transferir' : 'Limite de pagamentos atingido'} <kbd className="action-key" aria-hidden="true">1</kbd></button>
    </footer>
  </section>;
}
