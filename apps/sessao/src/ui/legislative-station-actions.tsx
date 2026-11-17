import type {ContextKey} from './context-action-keys';
import {ContextActionButton} from './context-action-button';
import {type Action,type PlenaryView,type Station} from '../plenary';

type StationAction = Exclude<Action,'audit'> | 'denounce';

export const legislativeButtons = {
  denounce:{station:'audit',label:'Denunciar',icon:'alert'},
  panel:{station:'panel',label:'Corrigir',icon:'check'},
  fraud:{station:'panel',label:'Fraudar',icon:'alert'},
} as const satisfies Record<StationAction,{station:Station;label:string;icon:string}>;

export function legislativeStationActions(view:PlenaryView|undefined,station:Station|undefined):StationAction[] {
  if (view?.phase!=='negotiation' || view.isolationSeconds || view.ballotCountdown!==undefined) return [];
  if (station==='audit') return ['denounce'];
  if (view.mandate===false) return [];
  if (view.project===undefined || view.projectVoteExpired) return [];
  if (station!=='panel') return [];
  const actions:StationAction[] = [];
  if (view.audit==='fraud' && !view.reportedFraud) actions.push('panel');
  if (view.canFraud) actions.push('fraud');
  return actions;
}

export function LegislativeStationActions({actions,send,keys}:{
  keys?:readonly ContextKey[]; actions:readonly StationAction[];send:(action:StationAction)=>void;
}) {
  return actions.map((action,index)=><ContextActionButton key={action} {...legislativeButtons[action]} action={action} presentation={keys?.[index]}
    activate={()=>send(action)}/>);
}
