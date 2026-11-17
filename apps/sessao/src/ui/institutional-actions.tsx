import {DialogDismiss} from './dialog-dismiss';
import {useState} from 'react';
import {useDialogKeys} from './use-dialog-keys';
import type {Player} from '../map';
import {canReachStation,hearingPolicyFee,type PlenaryView} from '../plenary';
import {CABINET_GRANT,money,splits,type PoliticsAction,type Split} from '../politics';

export function institutionalActions(view?:PlenaryView,player?:Player) {
  const politics = view?.politics;
  if (!politics || view.phase!=='negotiation' || !player) return {};
  const grant = canReachStation(player,'cabinet') && view.mandate && !politics.grantUsed && !politics.suspended
    ? {affordable:view.budget>=CABINET_GRANT} : undefined;
  const fee = view.policies?.hearing ? hearingPolicyFee : 0;
  const atPanel = canReachStation(player,'panel');
  const summons = {fee,affordable:politics.wallet>=fee};
  const cassation = atPanel && view.canCallCassation ? summons : undefined;
  const hearing = atPanel && politics.canCallHearing ? {
    ...summons,
    candidates:politics.directory.filter(contact=>contact.id!==player.id && contact.eligible)
      .map(({id,name,popularity})=>({id,name,popularity})),
  } : undefined;
  return {grant,hearing,cassation};
}

export function cassationLabel(fee:number) {
  return 'Convocar cassação'+(fee ? ' · '+money(fee) : '');
}

export function InstitutionalActions({model,send,close}:{close?:()=>void;model:ReturnType<typeof institutionalActions>;send:(action:PoliticsAction)=>void}) {
  const [diverted,setDiverted] = useState<Split>(0);
  const [target,setTarget] = useState('');
  const {grant,hearing,cassation} = model;
  const nominee = hearing?.candidates.find(candidate=>candidate.id===target);
  const applyGrant = ()=>{if (grant?.affordable) send({kind:'grant',diverted});};
  const callCassation = ()=>{if (cassation?.affordable) send({kind:'call-cassation'});};
  const callHearing = ()=>{if (nominee && hearing?.affordable) send({kind:'hearing',target:nominee.id});};
  const grantLabel = 'Aplicar verba de '+money(CABINET_GRANT);
  const hearingLabel = 'Convocar votação'+(hearing?.fee ? ' · '+money(hearing.fee) : '');
  const splitLabel = (value:Split)=>value ? `Desviar ${money(value)}` : 'Aplicar tudo';
  const actions = useDialogKeys<HTMLDivElement>(()=>undefined,[
    ...(close ? [{name:'Fechar ações institucionais',activate:close}] : []),
    ...(grant ? splits.map(value=>({name:splitLabel(value),activate:()=>setDiverted(value)})) : []),
    ...(grant?.affordable ? [{name:grantLabel,activate:applyGrant}] : []),
    ...(cassation?.affordable ? [{name:cassationLabel(cassation.fee),activate:callCassation}] : []),
    ...(hearing?.candidates.map(candidate=>({name:candidate.name+' · '+candidate.popularity+' pop.',
      activate:()=>setTarget(candidate.id)})) ?? []),
    ...(nominee && hearing?.affordable ? [{name:hearingLabel,activate:callHearing}] : []),
  ]);
  return <div id="politics-actions" ref={actions}>
    <header className="social-header">
      <h2 id="institutional-title">Ações institucionais</h2>
      {close && <DialogDismiss label="Fechar ações institucionais" onDismiss={close}/>}
    </header>
    {grant && <form id="cabinet-form" onSubmit={event=>{
      event.preventDefault();
      applyGrant();
    }}>
      <div className="section-label">Destino da verba</div>
      <div className="choice-grid" role="group" aria-label="Destino da verba">
        {splits.map(value=><button key={value} type="button" className="hud-button hud-button--secondary game-choice"
          aria-pressed={value===diverted} onClick={()=>setDiverted(value)}>{splitLabel(value)}</button>)}
      </div>
      <button className="hud-button" type="submit" disabled={!grant.affordable}>{grantLabel}</button>
    </form>}
    {cassation && <button className="hud-button" type="button" disabled={!cassation.affordable}
      onClick={callCassation}>{cassationLabel(cassation.fee)}</button>}
    {hearing && <form id="hearing-form" onSubmit={event=>{
      event.preventDefault();
      callHearing();
    }}>
      <div className="section-label">Afastamento temporário</div>
      <div className="choice-grid" role="group" aria-label="Alvo do afastamento">
        {hearing.candidates.map(candidate=><button key={candidate.id} type="button" className="hud-button hud-button--secondary game-choice"
          aria-pressed={candidate===nominee} onClick={()=>setTarget(candidate.id)}>{candidate.name} · {candidate.popularity} pop.</button>)}
      </div>
      <button className="hud-button" type="submit" disabled={!nominee || !hearing.affordable}>
        {hearingLabel}
      </button>
    </form>}
  </div>;
}
