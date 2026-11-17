import type { ReactNode } from 'react';

export function DialogDismiss({children,label,className='hud-icon-button',onDismiss,id,shortcut}:{
  children?:ReactNode; label?:string; className?:string; onDismiss?:()=>void; id?:string; shortcut?:string;
}) {
  const button = <button id={id} type={onDismiss ? 'button' : 'submit'} className={className}
    aria-label={label ?? (children ? undefined : 'Fechar')} aria-keyshortcuts={shortcut} onClick={onDismiss}>
    {children ?? <svg className="hud-glyph" aria-hidden="true"><use href="#icon-cross"/></svg>}
  </button>;
  return onDismiss ? button : <form method="dialog">{button}</form>;
}
