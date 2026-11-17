import {Backpack} from 'lucide';
import type {GameplayAction} from '../gameplay';
import type {Decoration} from '../photography';
import {decorationLabel} from '../photo-renderer';
import {DialogDismiss} from './dialog-dismiss';
import {PhoneContactFace} from './phone-call';

export function GameplayDialogHeader({title,bag,back}:{title:string;bag?:boolean;back?:()=>void}) {
  return <>
    <h2 id="gameplay-title">{bag && <svg className="hud-glyph bag-title-icon" viewBox="0 0 24 24" aria-hidden="true">
      {Backpack.map(([tag,attributes],index)=>{
        const Tag = tag as 'path'|'rect'|'line'|'circle';
        return <Tag key={index} {...attributes}/>;
      })}
    </svg>}{title}</h2>
    {back ? <DialogDismiss id="phone-back" label="Fechar aplicativo" shortcut="Escape" onDismiss={back}/> :
      <DialogDismiss label="Fechar"/>}
  </>;
}

export function DecorationCard({decoration,ownId,exploring,send}:{
  decoration:Decoration; ownId:string; exploring:boolean; send:(action:GameplayAction)=>void;
}) {
  const {id,kind,owner,character,marked,privateOffice} = decoration;
  const control = (label:string,action:GameplayAction['kind'])=>
    <button type="button" className="hud-button hud-button--secondary" onClick={()=>send({kind:action,item:id})}>{label}</button>;
  return <article className="object-card">
    <h3>{decorationLabel(decoration)}</h3>
    {kind==='portrait' && <PhoneContactFace person={{...owner,character}}/>}
    {marked && <p>Retrato rabiscado</p>}
    {kind==='vip' && <p>Área reservada por {owner.name}</p>}
    {exploring && !privateOffice && (kind==='pizza' ? control('Pegar uma fatia','slice') : <>
      {kind==='portrait' && !marked && owner.id!==ownId && control('Rabiscar','mark')}
      {control(kind==='portrait' && owner.id!==ownId ? 'Arrancar retrato' : 'Retirar','uninstall')}
    </>)}
  </article>;
}
