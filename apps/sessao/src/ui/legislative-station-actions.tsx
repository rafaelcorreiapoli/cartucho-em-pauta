import {StationActionButton} from './station-action-button';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import type {Action,PlenaryView,Station} from '../plenary';

const definitions = {
  amendment:{station:'amendment',label:'Propor emenda',icon:'document'},
  audit:{station:'audit',label:'Auditar',icon:'search'},
  panel:{station:'panel',label:'Corrigir',icon:'check'},
  fraud:{station:'panel',label:'Fraudar',icon:'alert'},
} as const satisfies Record<Action,{station:Station;label:string;icon:string}>;

export function legislativeStationActions(view:PlenaryView|undefined,station:Station|undefined):Action[] {
  if (view?.phase!=='negotiation' || view.mandate===false || view.isolationSeconds || view.ballotCountdown!==undefined) return [];
  if (station==='audit') return ['audit'];
  if (view.project===undefined) return [];
  if (station==='amendment') return view.amended ? [] : ['amendment'];
  if (station!=='panel') return [];
  const actions:Action[] = [];
  if (view.audit==='fraud' && !view.reportedFraud) actions.push('panel');
  if (view.canFraud) actions.push('fraud');
  return actions;
}

export function LegislativeStationActions({actions,send}:{actions:readonly Action[];send:(action:Action)=>void}) {
  return actions.map(action=>{
    return <StationActionButton key={action} {...definitions[action]} action={action} activate={()=>send(action)}/>;
  });
}

export function mountLegislativeStationActions(element:HTMLElement,send:(action:Action)=>void) {
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
