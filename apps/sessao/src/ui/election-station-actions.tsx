import type {ContextKey} from './context-action-keys';
import {ELECTION_RULES,type ElectionAction} from '../elections';
import type {PlenaryView,Station} from '../plenary';
import {money} from '../politics';
import {ContextActionButton} from './context-action-button';

export const electionButtons = {
  advertise:{station:'press',label:'Veicular propaganda',icon:'chart',detail:`${money(ELECTION_RULES.advertisementCost)} · 1 por ciclo`},
  speech:{station:'panel',label:'Discursar',icon:'mic'},
  interview:{station:'tv',label:'Entrevista ao vivo',icon:'mic'},
  object:{station:'panel',label:'Contestar projeto',icon:'cross'},
} as const;
type StationElectionAction = keyof typeof electionButtons;

export function electionStationActions(view:PlenaryView|undefined,station:Station|undefined,hasVoice:boolean) {
  const actions:StationElectionAction[] = [];
  const election = view?.election;
  const personal = election?.personal;
  if (view?.phase!=='negotiation' || view.ballotCountdown!==undefined || !election?.canCampaign || !personal) {
    return {actions,voiceHint:false};
  }
  if (station==='press' && election.remaining>0 && !personal.advertised && (view.politics?.wallet ?? 0)>=ELECTION_RULES.advertisementCost) actions.push('advertise');
  if (station==='panel') {
    if (!personal.spoke) actions.push('speech');
    if (view.project!==undefined && election.canObject) actions.push('object');
  }
  if (station==='tv' && election.canInterview && hasVoice) actions.push('interview');
  return {actions,voiceHint:station==='tv' && election.canInterview && !hasVoice};
}

export function ElectionStationActions({actions,voiceHint,send,keys}:ReturnType<typeof electionStationActions>&{
  keys?:readonly ContextKey[]; send:(action:ElectionAction)=>void;
}) {
  return <>
    {actions.map((kind,index)=><ContextActionButton key={kind} id={kind} presentation={keys?.[index]} {...electionButtons[kind]} activate={()=>send({kind})}/>)}
    {voiceHint ? <p id="interview-hint">Ative a voz para entrar ao vivo.</p> : null}
  </>;
}
