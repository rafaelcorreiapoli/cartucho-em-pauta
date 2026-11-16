import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {DialogDismiss} from './ui/dialog-dismiss';
import type { PhotoScene } from './photography';
import { securityCameras, type SecurityAction, type SecurityCameraId, type SecurityView } from './security';
import { createSurveillanceViewport } from './surveillance-viewport';

export function SecurityDialogContent({camera,ready,send}:{
  camera?:SecurityCameraId; ready:boolean; send:(action:SecurityAction)=>void;
}) {
  return <>
    <header>
      <h2 id="security-title">Sala de Segurança</h2>
      <DialogDismiss label="Fechar terminal" className="hud-button hud-button--secondary">✕</DialogDismiss>
    </header>
    <div className="security-console">
      <div className="security-channels" role="group" aria-label="Câmeras">
        {securityCameras.map(({id,label})=><button key={id} type="button" className="hud-button hud-button--secondary spy-channel"
          aria-pressed={id===camera} onClick={()=>send({kind:'select',camera:id})}>{label}</button>)}
      </div>
      <section aria-label="Imagem da câmera">
        <div className={ready ? 'spy-viewport' : 'spy-viewport waiting-for-feed'}/>
        <small role="status">{ready ? 'Ao vivo' : 'Conectando à câmera…'}</small>
      </section>
    </div>
  </>;
}

export function createSecurityPanel(send:(action:SecurityAction)=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#security-dialog')!;
  const root = createRoot(dialog);

  let requested = false;
  let selected:SecurityCameraId|undefined;
  let ready = false;
  let live:ReturnType<typeof createSurveillanceViewport>|undefined;

  function paint() {
    flushSync(()=>root.render(<SecurityDialogContent camera={selected} ready={ready} send={send}/>));
  }

  paint();
  const viewport = dialog.querySelector<HTMLElement>('.spy-viewport')!;

  function stop() {
    live?.destroy();
    live = undefined;
    ready = false;
    paint();
  }

  function dismiss(event:Event) {
    event.preventDefault();
    requested = false;
    dialog.close();
    stop();
    send({kind:'close'});
  }
  dialog.oncancel = dismiss;
  dialog.querySelector('form')!.onsubmit = dismiss;

  function render(view?:SecurityView) {
    if (!view) requested = false;
    const camera = view?.camera;
    if (camera===selected) return;
    selected = camera;
    if (!camera) {
      dialog.close();
      stop();
      return;
    }
    if (requested && !dialog.open) dialog.showModal();
    ready = false;
    paint();
  }

  return {
    open() {
      requested = true;
      if (selected && !dialog.open) dialog.showModal();
      send({kind:'open'});
    },
    render,
    frame({camera,scene}:{camera:SecurityCameraId;scene:PhotoScene}) {
      if (!dialog.open || camera!==selected) return;
      live ??= createSurveillanceViewport(viewport);
      live.receive(scene);
      if (!ready) {
        ready = true;
        paint();
      }
    },
    destroy() {
      dialog.oncancel = null;
      dialog.querySelector('form')!.onsubmit = null;
      dialog.close();
      live?.destroy();
      root.unmount();
    },
  };
}
