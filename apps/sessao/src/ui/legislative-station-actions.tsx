import {StationActionButton} from './station-action-button';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {type Action,type PlenaryView,type Station} from '../plenary';

type StationAction = Exclude<Action,'audit'> | 'denounce';

const definitions = {
  amendment:{station:'amendment',label:'Propor emenda',icon:'document'},
  denounce:{station:'audit',label:'Denunciar',icon:'alert'},
  panel:{station:'panel',label:'Corrigir',icon:'check'},
  fraud:{station:'panel',label:'Fraudar',icon:'alert'},
} as const satisfies Record<StationAction,{station:Station;label:string;icon:string}>;

export function legislativeStationActions(view:PlenaryView|undefined,station:Station|undefined):StationAction[] {
  if (view?.phase!=='negotiation' || view.isolationSeconds || view.ballotCountdown!==undefined) return [];
  if (station==='audit') return ['denounce'];
  if (view.mandate===false) return [];
  if (view.project===undefined) return [];
  if (station==='amendment') return view.amended ? [] : ['amendment'];
  if (station!=='panel') return [];
  const actions:StationAction[] = [];
  if (view.audit==='fraud' && !view.reportedFraud) actions.push('panel');
  if (view.canFraud) actions.push('fraud');
  return actions;
}

export function LegislativeStationActions({actions,send}:{
  actions:readonly StationAction[];send:(action:StationAction)=>void;
}) {
  return actions.map(action=><StationActionButton key={action} {...definitions[action]} action={action}
    activate={()=>send(action)}/>);
}

export function mountLegislativeStationActions(element:HTMLElement,send:(action:StationAction)=>void) {
  const root = createRoot(element);
  let current = '';
  return {
    render(view:PlenaryView|undefined,station:Station|undefined) {
      const actions = legislativeStationActions(view,station);
      const key = actions.join(',');
      if (key!==current) {
        current = key;
        // Keyboard badges are assigned alongside the other contextual actions in this same update.
        flushSync(()=>root.render(<LegislativeStationActions actions={actions} send={send}/>));
      }
      return actions.length>0;
    },
    destroy:()=>root.unmount(),
  };
}
