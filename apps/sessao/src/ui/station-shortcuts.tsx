import type {ContextKey} from './context-action-keys';
import type {Player} from '../map';
import type {PlenaryView,Station} from '../plenary';
import {roomActivities,type RoomActivity} from '../room-activities';
import {canPublishEvidence} from './dossier';
import {institutionalActions} from './institutional-actions';
import {ContextActionButton} from './context-action-button';

export type Shortcut = {
  kind:RoomActivity|'grant'|'publish';
  station:Station;
  label:string;
  icon:string;
};

export function stationShortcuts(view?:PlenaryView,player?:Player,station?:Station):Shortcut[] {
  if (!station || view?.phase!=='negotiation' || view.ballotCountdown!==undefined) return [];
  const actions:Shortcut[] = [];
  const {grant} = station==='cabinet' ? institutionalActions(view,player) : {};
  if (station==='cabinet' && grant) actions.push({kind:'grant',station,label:'Aplicar verba',icon:'wallet'});
  if (station==='press' && canPublishEvidence(view,player)) actions.push({kind:'publish',station,label:'Divulgar evidência',icon:'document'});
  if (Object.hasOwn(roomActivities,station)) {
    const activity = station as RoomActivity;
    const {label,icon} = roomActivities[activity];
    actions.push({kind:activity,station,label,icon});
  }
  return actions;
}

export function StationShortcuts({actions,select,keys}:{keys?:readonly ContextKey[];actions:readonly Shortcut[];select:(kind:Shortcut['kind'])=>void}) {
  return actions.map(({kind,...button},index)=><ContextActionButton key={kind} {...button} presentation={keys?.[index]} activate={()=>select(kind)}/>);
}
