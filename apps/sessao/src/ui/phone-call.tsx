import type {ShortcutEntry} from '../action-shortcuts';
import {useDialogKeys} from './use-dialog-keys';
import {HudIcon} from './hud-icon';
import {CharacterPortrait} from './character-portrait';
import type {GameplayAction,PhoneCall} from '../gameplay';
import type {DirectoryContact} from '../politics';

export function PhoneContactFace({person}:{person:DirectoryContact}) {
  const character = person.character;
  if (character===undefined) return <span className="phone-contact-face" aria-hidden="true">{person.name.slice(0,1).toUpperCase()}</span>;
  return <CharacterPortrait character={character} className="phone-contact-face"/>;
}

export function PhoneCalls({call,contacts,available,send,close}:{
  call?:PhoneCall; contacts:readonly DirectoryContact[]; available:boolean; send:(action:GameplayAction)=>void; close?:()=>void;
}) {
  const incoming = call?.state==='incoming';
  const dial = (id:string)=>send({kind:'call',target:id});
  const answer = ()=>send({kind:'answer'});
  const hangup = ()=>send({kind:'hangup'});
  const options = available ? contacts.map((person,index)=>({
    person,shortcut:index<9 ? String(index+1) : undefined,activate:()=>dial(person.id),
  })) : [];
  const entries:ShortcutEntry[] = close ? [{name:'Fechar aplicativo',activate:close}] : [];
  if (call) {
    if (incoming) entries.push({name:'Atender',activate:answer});
    entries.push({name:incoming ? 'Recusar' : 'Encerrar',activate:hangup});
  } else entries.push(...options.map(({person,activate})=>({name:`Ligar para ${person.name}`,activate})));
  const panel = useDialogKeys<HTMLElement>(key=>{
    if (call) {
      if (key==='1') return incoming ? answer : hangup;
      if (incoming && key==='2') return hangup;
      return;
    }
    return options.find(option=>option.shortcut===key)?.activate;
  },entries);
  const attach = (element:HTMLElement|null)=>{panel.current = element;};
  if (call) {
    const person = contacts.find(contact=>contact.id===call.peer.id) ?? call.peer;
    return <>
      <div ref={attach} className="phone-caller">
        <PhoneContactFace person={person}/><strong>{person.name}</strong>
        <span role="status">{incoming ? 'Chamada recebida' : call.state==='outgoing' ? 'Chamando…' : 'Em ligação'}</span>
      </div>
      {incoming && <button type="button" className="hud-button hud-button--secondary phone-answer" aria-keyshortcuts="1"
        onClick={answer}><HudIcon name="handset"/>Atender<kbd className="action-key" aria-hidden="true">1</kbd></button>}
      <button type="button" className="hud-button hud-button--secondary phone-hangup" aria-keyshortcuts={incoming ? '2' : '1'}
        onClick={hangup}><HudIcon name="cross"/>{incoming ? 'Recusar' : 'Encerrar'}
        <kbd className="action-key" aria-hidden="true">{incoming ? '2' : '1'}</kbd></button>
    </>;
  }
  if (!available) return <p ref={attach}>Ligações ficam disponíveis durante a articulação.</p>;
  if (!contacts.length) return <p ref={attach}>Ninguém mais na sala.</p>;
  return <ul ref={attach} className="phone-contacts" aria-label="Contatos para ligar">
    {options.map(({person,shortcut,activate})=><li key={person.id}>
      <button type="button" className="phone-contact" aria-label={`Ligar para ${person.name}`}
        aria-keyshortcuts={shortcut} onClick={activate}>
        <PhoneContactFace person={person}/><strong>{person.name}</strong><HudIcon name="handset" className="phone-contact-dial"/>
        {shortcut && <kbd className="action-key" aria-hidden="true">{shortcut}</kbd>}
      </button>
    </li>)}
  </ul>;
}
