import {createRoot} from 'react-dom/client';
import type {Player} from './map';
import type {PoliticsAction} from './politics';
import type {PlenaryView} from './plenary';
import {Dossier,dossierModel} from './ui/dossier';
import {InstitutionalActions,institutionalActions} from './ui/institutional-actions';

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.querySelector<T>('#'+id)!;

export function createPoliticsPanel(id:string,send:(action:PoliticsAction)=>void,focusMap:()=>void) {
  const dock = el<HTMLDetailsElement>('politics-dock');
  const institutional = el<HTMLDetailsElement>('institutional-dock');
  const dossierRoot = createRoot(el('dossier-content'));
  const institutionalRoot = createRoot(el('institutional-actions'));
  let dossierKey = '';
  let institutionalKey = '';
  let players:Player[] = [];
  let view:PlenaryView|undefined;
  dock.open = institutional.open = false;

  function sendInstitutional(action:PoliticsAction) {
    send(action);
    if (action.kind==='call-cassation') institutional.open = false;
    if (action.kind!=='hearing') focusMap();
  }

  function renderPanels() {
    const dossier = dossierModel(id,view,players);
    const nextDossierKey = JSON.stringify(dossier) ?? '';
    if (nextDossierKey!==dossierKey) {
      dossierKey = nextDossierKey;
      dossierRoot.render(dossier ? <Dossier model={dossier} send={send}/> : null);
    }

    const model = institutionalActions(view,players.find(player=>player.id===id));
    const key = JSON.stringify(model);
    if (key===institutionalKey) return;
    institutionalKey = key;
    institutionalRoot.render(<InstitutionalActions model={model} send={sendInstitutional}/>);
  }

  return {
    sendInstitutional,
    openGrant() {
      institutional.open = true;
      el('institutional-actions').querySelector<HTMLElement>('.game-choice')?.focus();
    },
    openDossier() {
      dock.open = true;
      el('dossier-content').querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus();
    },
    render(next:PlenaryView) {
      view = next;
      dock.hidden = !view.politics;
      institutional.hidden = !view.politics || view.phase!=='negotiation';
      el('personal-stats').textContent = view.politics?.incoming.length ? 'Nova oferta' : '';
      renderPanels();
    },
    destroy() {
      dossierRoot.unmount();
      institutionalRoot.unmount();
    },
    players(next:Player[]) {
      players = next;
      renderPanels();
    },
  };
}
