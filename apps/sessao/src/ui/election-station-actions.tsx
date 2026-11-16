import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ELECTION_RULES,type ElectionAction} from '../elections';
import type {PlenaryView,Station} from '../plenary';
import {money} from '../politics';
import {StationActionButton} from './station-action-button';

const definitions = {
  advertise:{station:'press',label:'Veicular propaganda',icon:'chart',detail:`${money(ELECTION_RULES.advertisementCost)} · 1 por ciclo`},
  speech:{station:'panel',label:'Discursar',icon:'mic'},
  interview:{station:'tv',label:'Entrevista ao vivo',icon:'mic'},
  object:{station:'panel',label:'Contestar projeto',icon:'cross'},
} as const;
type StationElectionAction = keyof typeof definitions;

export function electionStationActions(view:PlenaryView|undefined,station:Station|undefined,hasVoice:boolean) {
  const actions:StationElectionAction[] = [];
  const election = view?.election;
  const personal = election?.personal;
  if (view?.phase!=='negotiation' || view.ballotCountdown!==undefined || !election?.canCampaign || !election.remaining || !personal) {
    return {actions,voiceHint:false};
  }
  if (station==='press' && !personal.advertised && (view.politics?.wallet ?? 0)>=ELECTION_RULES.advertisementCost) actions.push('advertise');
  if (station==='panel') {
    if (!personal.spoke) actions.push('speech');
    if (election.canObject) actions.push('object');
  }
  if (station==='tv' && election.canInterview && hasVoice) actions.push('interview');
  return {actions,voiceHint:station==='tv' && election.canInterview && !hasVoice};
}

export function ElectionStationActions({actions,voiceHint,send}:ReturnType<typeof electionStationActions>&{
  send:(action:ElectionAction)=>void;
}) {
  return <>
    {actions.map(kind=><StationActionButton key={kind} id={kind} {...definitions[kind]} activate={()=>send({kind})}/>)}
    {voiceHint ? <p id="interview-hint">Ative a voz para entrar ao vivo.</p> : null}
  </>;
}

export function mountElectionStationActions(element:HTMLElement,send:(action:ElectionAction)=>void) {
  const root = createRoot(element);
  let current = '';
  return {
    render(view:PlenaryView|undefined,station:Station|undefined,hasVoice:boolean) {
      const state = electionStationActions(view,station,hasVoice);
      const key = JSON.stringify(state);
      if (current!==key) {
        current = key;
        // The shared contextual bar reads these buttons to assign keyboard badges.
        flushSync(()=>root.render(<ElectionStationActions {...state} send={send}/>));
      }
      return state.voiceHint || state.actions.length>0;
    },
    destroy:()=>root.unmount(),
  };
}
