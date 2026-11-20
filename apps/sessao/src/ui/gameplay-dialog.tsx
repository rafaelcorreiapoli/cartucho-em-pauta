import {PhoneBackIcon} from './phone-back';
import {Backpack} from 'lucide';
import type {GameplayAction} from '../gameplay';
import type {Decoration} from '../photography';
import {decorationLabel} from '../world-art';
import {DialogDismiss} from './dialog-dismiss';
import {useDialogKeys} from './use-dialog-keys';
import type {ShortcutEntry} from '../action-shortcuts';
import {PhoneContactFace} from './phone-call';

export function GameplayDialogHeader({title,bag,back}:{title:string;bag?:boolean;back?:()=>void}) {
  return <>
    <h2 id="gameplay-title">{bag && <svg className="hud-glyph bag-title-icon" viewBox="0 0 24 24" aria-hidden="true">
      {Backpack.map(([tag,attributes],index)=>{
        const Tag = tag as 'path'|'rect'|'line'|'circle';
        return <Tag key={index} {...attributes}/>;
      })}
    </svg>}{title}</h2>
    {back ? <span className="phone-back-slot"><span id="phone-back-mount"/><DialogDismiss id="phone-back" label="Fechar aplicativo" shortcut="Escape" onDismiss={back}><PhoneBackIcon/></DialogDismiss></span> :
      <DialogDismiss label="Fechar"/>}
  </>;
}

export function DecorationCard({decoration,ownId,exploring,canRemove,send,close}:{
  decoration:Decoration; ownId:string; exploring:boolean; canRemove:boolean; send:(action:GameplayAction)=>void; close?:()=>void;
}) {
  const {id,kind,owner,character,marked,privateOffice} = decoration;
  const entries:ShortcutEntry[] = close ? [{name:'Fechar',activate:close}] : [];
  const panel = useDialogKeys<HTMLElement>(()=>undefined,entries);
  const control = (label:string,action:GameplayAction['kind'],disabled=false)=>{
    const activate = ()=>send({kind:action,item:id});
    if (!disabled) entries.push({name:label,activate});
    return <button type="button" className="hud-button hud-button--secondary" disabled={disabled} onClick={activate}>{label}</button>;
  };
  return <article ref={panel} className="object-card">
    <h3>{decorationLabel(decoration)}</h3>
    {kind==='portrait' && <PhoneContactFace person={{...owner,character}}/>}
    {marked && <p>Retrato rabiscado</p>}
    {kind==='vip' && <p>Área reservada por {owner.name}</p>}
    {exploring && !privateOffice && (kind==='pizza' ? control('Pegar uma fatia','slice') : <>
      {kind==='portrait' && !marked && owner.id!==ownId && control('Rabiscar','mark')}
      {control(kind==='portrait' && owner.id!==ownId ? 'Arrancar retrato' : 'Retirar','uninstall',!canRemove && (kind!=='portrait' || owner.id===ownId))}
    </>)}
  </article>;
}
