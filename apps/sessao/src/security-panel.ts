import type { PhotoScene } from './photography';
import { securityCameras, type SecurityAction, type SecurityCameraId, type SecurityView } from './security';
import { createSurveillanceViewport } from './surveillance-viewport';

export function createSecurityPanel(send:(action:SecurityAction)=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#security-dialog')!;
  const channels = dialog.querySelector<HTMLElement>('.security-channels')!;
  const viewport = dialog.querySelector<HTMLElement>('.spy-viewport')!;
  const status = dialog.querySelector<HTMLElement>('[role="status"]')!;
  const buttons = securityCameras.map(({id,label})=>{
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hud-button hud-button--secondary spy-channel';
    button.textContent = label;
    button.setAttribute('aria-pressed','false');
    button.onclick = ()=>send({kind:'select',camera:id});
    return {id,button};
  });
  channels.replaceChildren(...buttons.map(({button})=>button));

  let requested = false;
  let selected:SecurityCameraId|undefined;
  let live:ReturnType<typeof createSurveillanceViewport>|undefined;

  function stop() {
    live?.destroy();
    live = undefined;
    viewport.classList.add('waiting-for-feed');
    status.textContent = 'Conectando à câmera…';
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
    status.textContent = 'Conectando à câmera…';
    viewport.classList.add('waiting-for-feed');
    for (const {id,button} of buttons) button.setAttribute('aria-pressed',String(id===camera));
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
      if (viewport.classList.contains('waiting-for-feed')) {
        viewport.classList.remove('waiting-for-feed');
        status.textContent = 'Ao vivo';
      }
    },
    destroy() {
      dialog.oncancel = null;
      dialog.querySelector('form')!.onsubmit = null;
      render();
      stop();
      channels.replaceChildren();
    },
  };
}
