import type {ReactNode} from 'react';
import {DialogDismiss} from './dialog-dismiss';

export function DialogHeader({id,title,titleClass,dismissLabel,dismissClass,onDismiss}:{
  id:string;title:ReactNode;titleClass?:string;dismissLabel:string;dismissClass?:string;onDismiss?:()=>void;
}) {
  return <header>
    <h2 id={id} className={titleClass}>{title}</h2>
    <DialogDismiss label={dismissLabel} className={dismissClass} onDismiss={onDismiss}/>
  </header>;
}
