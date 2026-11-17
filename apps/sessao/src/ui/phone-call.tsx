import {usePhoneKeys} from './use-phone-keys';
import {HudIcon} from './hud-icon';
import {CharacterPortrait} from './character-portrait';
import type {GameplayAction,PhoneCall} from '../gameplay';
import type {DirectoryContact} from '../politics';

export function PhoneContactFace({person}:{person:DirectoryContact}) {
  const character = person.character;
  if (character===undefined) return <span className="phone-contact-face" aria-hidden="true">{person.name.slice(0,1).toUpperCase()}</span>;
  return <CharacterPortrait character={character} className="phone-contact-face"/>;
}

export function PhoneCalls({call,contacts,available,send}:{
  call?:PhoneCall; contacts:readonly DirectoryContact[]; available:boolean; send:(action:GameplayAction)=>void;
}) {
  const incoming = call?.state==='incoming';
  const dial = (id:string)=>send({kind:'call',target:id});
  const answer = ()=>send({kind:'answer'});
  const hangup = ()=>send({kind:'hangup'});
  const panel = usePhoneKeys<HTMLDivElement>(key=>{
    if (call) {
      if (key==='1') return incoming ? answer : hangup;
      if (incoming && key==='2') return hangup;
      return;
    }
    if (!available || !/^[1-9]$/.test(key)) return;
    const person = contacts[Number(key)-1];
    if (person) return ()=>dial(person.id);
  });
  if (call) {
    const person = contacts.find(contact=>contact.id===call.peer.id) ?? call.peer;
    return <>
      <div ref={panel} className="phone-caller">
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
  if (!available) return <p>Ligações ficam disponíveis durante a articulação.</p>;
  if (!contacts.length) return <p>Ninguém mais na sala.</p>;
  return <div ref={panel} className="phone-contacts">
    {contacts.map((person,index)=>{
      const shortcut = index<9 ? String(index+1) : undefined;
      return <button key={person.id} type="button" className="phone-contact" aria-label={`Ligar para ${person.name}`}
        aria-keyshortcuts={shortcut} onClick={()=>dial(person.id)}>
        <PhoneContactFace person={person}/><strong>{person.name}</strong><HudIcon name="handset" className="phone-contact-dial"/>
        {shortcut && <kbd className="action-key" aria-hidden="true">{shortcut}</kbd>}
      </button>;
    })}
  </div>;
}
