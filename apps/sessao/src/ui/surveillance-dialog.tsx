import {useDialogKeys} from './use-dialog-keys';
import {DialogHeader} from './dialog-header';
import type { ReactNode, Ref } from 'react';

export function SurveillanceDialogContent({channels,monitor,camera,actionForKey}:{
  actionForKey?:(key:string)=>(()=>void)|undefined;
  channels:ReactNode; monitor:ReactNode; camera?:{name:string;attach:Ref<HTMLDivElement>};
}) {
  const panel = useDialogKeys<HTMLDivElement>(key=>actionForKey?.(key));
  return <>
    <DialogHeader id="surveillance-title" title="Central de Vigilância" dismissLabel="Fechar vigilância" dismissClass="hud-button hud-button--secondary"/>
    <div className="spy-console" ref={panel}>
      <div id="spy-channels">{channels}</div>
      <section id="spy-monitor">
        {camera && <><h3>{camera.name}</h3><div className="spy-viewport" aria-label="Visão ao vivo da câmera" ref={camera.attach}/></>}
        {monitor}
      </section>
    </div>
  </>;
}
