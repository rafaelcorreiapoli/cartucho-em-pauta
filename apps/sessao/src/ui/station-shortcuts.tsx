import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import type {Player} from '../map';
import type {PlenaryView,Station} from '../plenary';
import {roomActivities,type RoomActivity} from '../room-activities';
import {canPublishEvidence} from './dossier';
import {cassationLabel,institutionalActions} from './institutional-actions';
import {StationActionButton} from './station-action-button';

type Shortcut = {
  kind:RoomActivity|'grant'|'hearing'|'cassation'|'publish';
  station:Station;
  label:string;
  icon:string;
};

export function stationShortcuts(view?:PlenaryView,player?:Player,station?:Station):Shortcut[] {
  if (!station || view?.phase!=='negotiation' || view.ballotCountdown!==undefined) return [];
  const actions:Shortcut[] = [];
  const {grant,hearing,cassation} = station==='cabinet' || station==='panel' ? institutionalActions(view,player) : {};
  if (station==='cabinet' && grant?.affordable) actions.push({kind:'grant',station,label:'Aplicar verba',icon:'wallet'});
  if (station==='panel' && hearing?.candidates.length) actions.push({kind:'hearing',station,label:'Pedir afastamento',icon:'ballot'});
  if (station==='panel' && cassation?.affordable) actions.push({kind:'cassation',station,label:cassationLabel(cassation.fee),icon:'ballot'});
  if (station==='press' && canPublishEvidence(view,player)) actions.push({kind:'publish',station,label:'Divulgar evidência',icon:'document'});
  if (Object.hasOwn(roomActivities,station)) {
    const activity = station as RoomActivity;
    const {label,icon} = roomActivities[activity];
    actions.push({kind:activity,station,label,icon});
  }
  return actions;
}

export function StationShortcuts({actions,select}:{actions:readonly Shortcut[];select:(kind:Shortcut['kind'])=>void}) {
  return actions.map(({kind,...button})=><StationActionButton key={kind} {...button} activate={()=>select(kind)}/>);
}

export function mountStationShortcuts(element:HTMLElement,select:(kind:Shortcut['kind'])=>void) {
  const root = createRoot(element);
  let current = '';
  return {
    render(view?:PlenaryView,player?:Player,station?:Station) {
      const actions = stationShortcuts(view,player,station);
      const key = JSON.stringify(actions);
      if (current!==key) {
        current = key;
        flushSync(()=>root.render(<StationShortcuts actions={actions} select={select}/>));
      }
      return actions.length>0;
    },
    destroy:()=>root.unmount(),
  };
}
