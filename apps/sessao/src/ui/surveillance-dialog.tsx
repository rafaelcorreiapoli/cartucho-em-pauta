import type { ReactNode } from 'react';
import { DialogDismiss } from './dialog-dismiss';

export function SurveillanceDialogContent({channels,monitor}:{channels:ReactNode; monitor:ReactNode}) {
  return <>
    <header>
      <h2 id="surveillance-title">Central de Vigilância</h2>
      <DialogDismiss className="hud-button hud-button--secondary" label="Fechar vigilância">✕</DialogDismiss>
    </header>
    <div className="spy-console"><div id="spy-channels">{channels}</div><section id="spy-monitor">{monitor}</section></div>
  </>;
}
