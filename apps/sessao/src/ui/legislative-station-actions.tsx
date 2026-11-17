import {StationActionButton} from './station-action-button';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {bankAuditCost,type Action,type PlenaryView,type Station} from '../plenary';
import {money} from '../politics';

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

export function LegislativeStationActions({actions,send,auditFee=0}:{
  actions:readonly Action[];send:(action:Action)=>void;auditFee?:number;
}) {
  return actions.map(action=><StationActionButton key={action} {...definitions[action]} action={action}
    detail={action==='audit' && auditFee ? `${money(auditFee)} se revelar registro sigiloso` : undefined}
    activate={()=>send(action)}/>);
}

export function mountLegislativeStationActions(element:HTMLElement,send:(action:Action)=>void) {
  const root = createRoot(element);
  let current = '';
  return {
    render(view:PlenaryView|undefined,station:Station|undefined) {
      const actions = legislativeStationActions(view,station);
      const auditFee = actions.includes('audit') ? bankAuditCost(view?.policies) : 0;
      const key = actions.join(',')+':'+auditFee;
      if (key!==current) {
        current = key;
        // Keyboard badges are assigned alongside the other contextual actions in this same update.
        flushSync(()=>root.render(<LegislativeStationActions actions={actions} send={send} auditFee={auditFee}/>));
      }
      return actions.length>0;
    },
    destroy:()=>root.unmount(),
  };
}
