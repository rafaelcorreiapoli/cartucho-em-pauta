import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {SecurityDialogContent} from './ui/security-dialog';
import type { PhotoScene } from './photography';
import type { SecurityAction, SecurityCameraId, SecurityView } from './security';
import { createSurveillanceViewport } from './surveillance-viewport';

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
