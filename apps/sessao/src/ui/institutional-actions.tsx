import {DialogDismiss} from './dialog-dismiss';
import {useState} from 'react';
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
  return <div id="politics-actions">
    <header className="social-header">
      <h2>Ações institucionais</h2>
      {close && <DialogDismiss label="Fechar ações institucionais" onDismiss={close}/>}
    </header>
    {grant && <form id="cabinet-form" onSubmit={event=>{
      event.preventDefault();
      if (grant.affordable) send({kind:'grant',diverted});
    }}>
      <div className="section-label">Destino da verba</div>
      <div className="choice-grid" role="group" aria-label="Destino da verba">
        {splits.map(value=><button key={value} type="button" className="hud-button hud-button--secondary game-choice"
          aria-pressed={value===diverted} onClick={()=>setDiverted(value)}>{value ? `Desviar ${money(value)}` : 'Aplicar tudo'}</button>)}
      </div>
      <button className="hud-button" type="submit" disabled={!grant.affordable}>Aplicar verba de {money(CABINET_GRANT)}</button>
    </form>}
    {cassation && <button className="hud-button" type="button" disabled={!cassation.affordable}
      onClick={()=>send({kind:'call-cassation'})}>{cassationLabel(cassation.fee)}</button>}
    {hearing && <form id="hearing-form" onSubmit={event=>{
      event.preventDefault();
      if (nominee && hearing.affordable) send({kind:'hearing',target:nominee.id});
    }}>
      <div className="section-label">Afastamento temporário</div>
      <div className="choice-grid" role="group" aria-label="Alvo do afastamento">
        {hearing.candidates.map(candidate=><button key={candidate.id} type="button" className="hud-button hud-button--secondary game-choice"
          aria-pressed={candidate===nominee} onClick={()=>setTarget(candidate.id)}>{candidate.name} · {candidate.popularity} pop.</button>)}
      </div>
      <button className="hud-button" type="submit" disabled={!nominee || !hearing.affordable}>
        Convocar votação{hearing.fee ? ' · '+money(hearing.fee) : ''}
      </button>
    </form>}
  </div>;
}
