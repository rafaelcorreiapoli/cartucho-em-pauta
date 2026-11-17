import {createRoot} from 'react-dom/client';
import type {Player} from './map';
import type {PoliticsAction} from './politics';
import type {PlenaryView} from './plenary';
import {Dossier,dossierModel} from './ui/dossier';
import {InstitutionalActions,institutionalActions} from './ui/institutional-actions';

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

export function createPoliticsPanel(id:string,send:(action:PoliticsAction)=>void,focusMap:()=>void) {
  const dossierDialog = el<HTMLDialogElement>('dossier-dialog');
  const institutional = el<HTMLDialogElement>('institutional-dialog');
  const dossierRoot = createRoot(el('dossier-content'));
  const institutionalRoot = createRoot(el('institutional-actions'));
  let dossierKey = '';
  let institutionalKey = '';
  let players:Player[] = [];
  let view:PlenaryView|undefined;
  const canOpenDossier = () => !!view?.politics && view.phase==='negotiation';
  let hasInstitutionalActions = false;
  function restoreFocus() {
    if (!document.querySelector('dialog:modal')) focusMap();
  }
  dossierDialog.addEventListener('close',restoreFocus);
  institutional.addEventListener('close',restoreFocus);

  function sendInstitutional(action:PoliticsAction) {
    send(action);
    if (action.kind==='call-cassation' || action.kind==='grant') institutional.close();
    restoreFocus();
  }

  function closeDossier() { dossierDialog.close(); }
  function closeInstitutional() { institutional.close(); }

  function openDossier() {
    if (!canOpenDossier() || dossierDialog.open) return;
    dossierDialog.showModal();
    el('dossier-content').querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus();
  }

  function renderPanels() {
    const dossier = dossierModel(id,view,players);
    const nextDossierKey = JSON.stringify(dossier) ?? '';
    if (nextDossierKey!==dossierKey) {
      dossierKey = nextDossierKey;
      dossierRoot.render(dossier ? <Dossier model={dossier} send={send} close={closeDossier}/> : null);
    }

    const model = institutionalActions(view,players.find(player=>player.id===id));
    hasInstitutionalActions = !!(model.grant || model.hearing || model.cassation);
    if (!hasInstitutionalActions && institutional.open) closeInstitutional();
    const key = JSON.stringify(model);
    if (key===institutionalKey) return;
    institutionalKey = key;
    institutionalRoot.render(<InstitutionalActions model={model} send={sendInstitutional} close={closeInstitutional}/>);
  }

  return {
    sendInstitutional,
    openInstitutional() {
      if (!hasInstitutionalActions || institutional.open) return;
      institutional.showModal();
      el('institutional-actions').querySelector<HTMLElement>('.game-choice')?.focus();
    },
    openDossier,
    toggleDossier() {
      if (!canOpenDossier()) return false;
      if (dossierDialog.open) closeDossier();
      else openDossier();
      return true;
    },
    render(next:PlenaryView) {
      view = next;
      if (!canOpenDossier() && dossierDialog.open) closeDossier();
      renderPanels();
    },
    destroy() {
      dossierDialog.removeEventListener('close',restoreFocus);
      institutional.removeEventListener('close',restoreFocus);
      closeDossier();
      closeInstitutional();
      dossierRoot.unmount();
      institutionalRoot.unmount();
    },
    players(next:Player[]) {
      players = next;
      renderPanels();
    },
  };
}
