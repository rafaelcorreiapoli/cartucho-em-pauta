import type { ReactNode } from 'react';

export function DialogDismiss({children,label,className = 'hud-icon-button'}:{
  children:ReactNode; label?:string; className?:string;
}) {
  return <form method="dialog">
    <button type="submit" className={className} aria-label={label}>{children}</button>
  </form>;
}
