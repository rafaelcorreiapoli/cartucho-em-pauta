import type { ReactNode, Ref } from 'react';
import { DialogDismiss } from './dialog-dismiss';

export function SurveillanceDialogContent({channels,monitor,camera}:{
  channels:ReactNode; monitor:ReactNode; camera?:{name:string;attach:Ref<HTMLDivElement>};
}) {
  return <>
    <header>
      <h2 id="surveillance-title">Central de Vigilância</h2>
      <DialogDismiss className="hud-button hud-button--secondary" label="Fechar vigilância"/>
    </header>
    <div className="spy-console">
      <div id="spy-channels">{channels}</div>
      <section id="spy-monitor">
        {camera && <><h3>{camera.name}</h3><div className="spy-viewport" aria-label="Visão ao vivo da câmera" ref={camera.attach}/></>}
        {monitor}
      </section>
    </div>
  </>;
}
